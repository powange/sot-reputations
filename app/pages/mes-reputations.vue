<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type {
  UserInfo,
  EmblemInfo,
  EmblemProgress,
  FactionWithCampaigns,
  SingleUserTableRow
} from '~/types/reputation'
import { formatLastImport } from '~/utils/format'
import { createSuccessColumn, createMaxColumn, createProgressColumn } from '~/utils/emblem-columns'

interface MyReputationsData {
  user: UserInfo
  factions: FactionWithCampaigns<EmblemProgress | null>[]
}

const { t, locale } = useI18n()
const toast = useToast()
const { isAuthenticated } = useAuth()

// Helper pour obtenir le nom/description traduit
function getTranslatedText(
  emblem: { name: string; description: string; translations?: Record<string, { name: string | null; description: string | null }> },
  field: 'name' | 'description'
): string {
  const currentLocale = locale.value
  // Si français ou pas de traduction disponible, retourner le texte original
  if (currentLocale === 'fr' || !emblem.translations) {
    return emblem[field]
  }
  // Chercher la traduction dans la langue courante
  const translation = emblem.translations[currentLocale]
  if (translation && translation[field]) {
    return translation[field]!
  }
  // Fallback vers le texte original (français)
  return emblem[field]
}

// Rediriger si non connecté
if (!isAuthenticated.value) {
  navigateTo('/')
}

// Récupérer les données
const { data, error, refresh, status } = await useFetch<MyReputationsData>('/api/my-reputations')
const isLoading = computed(() => status.value === 'pending')

if (error.value) {
  navigateTo('/')
}

// Modal Import
const isImportModalOpen = ref(false)

// Modal Suppression
const isDeleteModalOpen = ref(false)
const isDeleting = ref(false)
const deleteAccountToo = ref(false)
const loadingChefGroups = ref(false)

interface ChefGroupInfo {
  groupId: number
  groupUid: string
  groupName: string
  memberCount: number
  members: Array<{ userId: number; username: string; role: string }>
}
const chefGroups = ref<ChefGroupInfo[]>([])
const chefTransfers = ref<Record<number, number>>({})

// Charger les groupes dont l'utilisateur est chef quand le switch est activé
watch(deleteAccountToo, async (newValue) => {
  if (newValue) {
    loadingChefGroups.value = true
    try {
      const response = await $fetch<{ chefGroups: ChefGroupInfo[] }>('/api/my-account/chef-groups')
      chefGroups.value = response.chefGroups
      // Réinitialiser les transferts
      chefTransfers.value = {}
    } catch {
      chefGroups.value = []
    } finally {
      loadingChefGroups.value = false
    }
  } else {
    chefGroups.value = []
    chefTransfers.value = {}
  }
})

// Vérifier si on peut supprimer (tous les chefs doivent être désignés)
const canDelete = computed(() => {
  if (!deleteAccountToo.value) return true
  if (loadingChefGroups.value) return false
  // Vérifier que chaque groupe a un nouveau chef désigné
  return chefGroups.value.every(group => chefTransfers.value[group.groupId])
})

// Réinitialiser le modal quand il se ferme
watch(isDeleteModalOpen, (open) => {
  if (!open) {
    deleteAccountToo.value = false
    chefGroups.value = []
    chefTransfers.value = {}
  }
})

// Modal Stats par faction
const isStatsModalOpen = ref(false)

const user = computed(() => data.value?.user)
const factions = computed(() => data.value?.factions || [])
const hasImportedData = computed(() => !!user.value?.lastImportAt)

// Statistiques de complétion
const completionStats = computed(() => {
  if (!hasImportedData.value) {
    return { completed: 0, total: 0, percentage: 0, totalEmblems: 0 }
  }

  let completed = 0
  let total = 0
  let totalEmblems = 0

  for (const faction of factions.value) {
    for (const campaign of faction.campaigns) {
      for (const emblem of campaign.emblems) {
        totalEmblems++
        const progress = emblem.progress
        // Ne compter que les emblèmes avec des données de progression
        if (progress !== null && progress !== undefined) {
          total++
          if (progress.completed) {
            completed++
          }
        }
      }
    }
  }

  return {
    completed,
    total,
    percentage: total > 0 ? (completed === total ? 100 : Math.floor((completed / total) * 100)) : 0,
    totalEmblems
  }
})

// Stats par faction
const factionStats = computed(() => {
  if (!hasImportedData.value) return []

  return factions.value.map(faction => {
    let completed = 0
    let total = 0

    for (const campaign of faction.campaigns) {
      for (const emblem of campaign.emblems) {
        const progress = emblem.progress
        if (progress !== null && progress !== undefined) {
          total++
          if (progress.completed) {
            completed++
          }
        }
      }
    }

    return {
      name: faction.name,
      key: faction.key,
      completed,
      total,
      percentage: total > 0 ? (completed === total ? 100 : Math.floor((completed / total) * 100)) : 0
    }
  }).sort((a, b) => b.percentage - a.percentage)
})

// Utiliser le composable de filtres
const {
  searchQuery,
  selectedFactionKeys,
  selectedCampaignIds,
  emblemCompletionFilter,
  ignoreWithoutData,
  isSearchActive,
  selectedFactions,
  filteredFactionsCampaigns
} = useEmblemFilters({
  factions
})

// Résultats de recherche
const searchResults = computed(() => {
  if (!isSearchActive.value) return []

  const query = searchQuery.value
  const results: Array<{
    factionName: string
    campaignName: string
    campaignKey: string
    emblems: Array<EmblemInfo & { progress: EmblemProgress | null }>
  }> = []

  for (const faction of factions.value) {
    for (const campaign of faction.campaigns) {
      const matchingEmblems = campaign.emblems.filter(e => emblemMatchesSearch(e, query, { locale: locale.value }))

      if (matchingEmblems.length > 0) {
        results.push({
          factionName: faction.name,
          campaignName: campaign.name,
          campaignKey: campaign.key,
          emblems: matchingEmblems
        })
      }
    }
  }

  return results
})

function filterEmblemsList<T extends { progress: EmblemProgress | null }>(emblems: T[]): T[] {
  return filterEmblems(
    emblems,
    {
      completionFilter: emblemCompletionFilter.value,
      ignoreWithoutData: ignoreWithoutData.value
    },
    {
      isCompleted: (emblem) => emblem.progress?.completed || false,
      hasData: (emblem) => emblem.progress !== null
    }
  )
}

const columns = computed<TableColumn<SingleUserTableRow>[]>(() => {
  const cols: TableColumn<SingleUserTableRow>[] = [
    createSuccessColumn<SingleUserTableRow>(),
    createMaxColumn<SingleUserTableRow>()
  ]

  if (hasImportedData.value) {
    cols.push(createProgressColumn<SingleUserTableRow>())
  }

  return cols
})

function getTableData(emblems: Array<EmblemInfo & { progress: EmblemProgress | null; translations?: Record<string, { name: string | null; description: string | null }> }>): SingleUserTableRow[] {
  const filteredEmblems = filterEmblemsList(emblems)

  return filteredEmblems.map(emblem => {
    const progress = emblem.progress
    let progressDisplay = '-'
    let completed = false
    let hasProgress = false

    if (progress) {
      progressDisplay = progress.threshold > 0
        ? String(progress.value)
        : (progress.completed ? t('reputations.yes') : t('reputations.no'))
      completed = progress.completed
      hasProgress = progress.value > 0
    }

    return {
      id: emblem.id,
      name: getTranslatedText(emblem, 'name'),
      description: getTranslatedText(emblem, 'description'),
      image: emblem.image || '',
      maxGrade: emblem.maxGrade,
      maxThreshold: emblem.maxThreshold,
      gradeThresholds: emblem.gradeThresholds || [],
      progress: progressDisplay,
      completed,
      hasProgress
    }
  })
}

async function handleDelete() {
  isDeleting.value = true
  try {
    if (deleteAccountToo.value) {
      // Supprimer le compte complet
      const transfers = Object.entries(chefTransfers.value).map(([groupId, newChefId]) => ({
        groupId: Number(groupId),
        newChefId
      }))
      await $fetch('/api/my-account', {
        method: 'DELETE',
        body: { chefTransfers: transfers }
      })
      toast.add({ title: t('common.success'), description: t('reputations.accountDeleted'), color: 'success' })
      // Rediriger vers la page d'accueil
      navigateTo('/')
    } else {
      // Supprimer seulement les données de réputation
      await $fetch('/api/my-reputations', { method: 'DELETE' })
      toast.add({ title: t('common.success'), description: t('reputations.dataDeleted'), color: 'success' })
      isDeleteModalOpen.value = false
      await refresh()
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: t('common.error'), description: err.data?.message || t('common.error'), color: 'error' })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <UContainer class="py-8">
    <!-- Chargement -->
    <div
      v-if="isLoading"
      class="flex justify-center py-16"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-primary"
      />
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex justify-between items-start mb-8">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <NuxtLink
              to="/"
              class="text-muted hover:text-foreground"
            >
              <UIcon
                name="i-lucide-arrow-left"
                class="w-5 h-5"
              />
            </NuxtLink>
            <h1 class="text-3xl font-pirate">
              {{ $t('reputations.title') }}
            </h1>
          </div>
          <p class="text-muted">
            {{ $t('reputations.lastImport', { date: formatLastImport(user?.lastImportAt || null) }) }}
          </p>
        </div>

        <div class="flex gap-2">
          <UButton
            v-if="hasImportedData"
            icon="i-lucide-trash-2"
            :label="$t('common.delete')"
            color="error"
            variant="outline"
            @click="isDeleteModalOpen = true"
          />
          <UButton
            icon="i-lucide-upload"
            :label="$t('common.import')"
            @click="isImportModalOpen = true"
          />
        </div>
      </div>

      <!-- Message si pas de données -->
      <div
        v-if="factions.length === 0"
        class="text-center py-16"
      >
        <UIcon
          name="i-lucide-anchor"
          class="w-16 h-16 text-muted mx-auto mb-4"
        />
        <h2 class="text-xl font-semibold mb-2">
          {{ $t('reputations.noData') }}
        </h2>
        <p class="text-muted mb-4">
          {{ $t('reputations.noDataDescription') }}
        </p>
        <UButton
          icon="i-lucide-upload"
          :label="$t('reputations.importMyData')"
          @click="isImportModalOpen = true"
        />
      </div>

      <template v-else>
        <!-- Statistiques -->
        <div
          v-if="hasImportedData"
          class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        >
          <div class="bg-muted/30 rounded-lg p-4">
            <div class="text-2xl font-bold text-success">
              {{ completionStats.completed }}
            </div>
            <div class="text-sm text-muted">
              {{ $t('myReputations.completedEmblems') }}
            </div>
          </div>
          <div
            class="bg-muted/30 rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            @click="isStatsModalOpen = true"
          >
            <div class="text-2xl font-bold text-primary">
              {{ completionStats.percentage }}%
            </div>
            <div class="text-sm text-muted flex items-center gap-1">
              {{ $t('myReputations.completionRate') }}
              <UIcon name="i-lucide-chevron-right" class="w-4 h-4" />
            </div>
          </div>
          <div class="bg-muted/30 rounded-lg p-4">
            <div class="text-2xl font-bold">
              {{ completionStats.totalEmblems }}
            </div>
            <div class="text-sm text-muted">
              {{ $t('myReputations.totalEmblems') }}
            </div>
          </div>
        </div>

        <!-- Filtres -->
        <ReputationFilters
          v-model:search-query="searchQuery"
          v-model:selected-faction-keys="selectedFactionKeys"
          v-model:selected-campaign-ids="selectedCampaignIds"
          v-model:emblem-completion-filter="emblemCompletionFilter"
          :factions="factions"
          :show-completion-filter="hasImportedData"
        >
          <template #completion-extra>
            <div
              v-if="emblemCompletionFilter === 'incomplete'"
              class="flex items-center gap-2 ml-4 pl-4 border-l border-muted"
            >
              <USwitch
                v-model="ignoreWithoutData"
                size="sm"
              />
              <span class="text-sm text-muted">{{ $t('reputations.ignoreWithoutData') }}</span>
            </div>
          </template>
        </ReputationFilters>

        <!-- Message si pas de données importées -->
        <UAlert
          v-if="!hasImportedData"
          icon="i-lucide-info"
          color="info"
          :title="$t('reputations.importMyData')"
          class="mb-6"
        >
          <template #description>
            <button
              class="underline font-medium"
              @click="isImportModalOpen = true"
            >
              {{ $t('reputations.importMyData') }}
            </button>
            -
            <NuxtLink
              to="/tutoriel"
              class="underline font-medium"
            >
              {{ $t('nav.tutorial') }}
            </NuxtLink>
          </template>
        </UAlert>

        <!-- Résultats de recherche -->
        <template v-if="isSearchActive">
          <div
            v-if="searchResults.length === 0"
            class="text-center py-8 text-muted"
          >
            {{ $t('reputations.noAchievementFound', { query: searchQuery }) }}
          </div>
          <div
            v-for="(result, index) in searchResults"
            :key="`${result.factionName}-${result.campaignKey}-${index}`"
            class="mb-8"
          >
            <h3 class="text-lg font-semibold mb-4">
              {{ result.factionName }}
              <span
                v-if="result.campaignKey !== 'default'"
                class="text-muted font-normal"
              >
                / {{ result.campaignName }}
              </span>
            </h3>
            <TableLoader>
              <UTable
                :data="getTableData(result.emblems)"
                :columns="columns"
              >
                <template #name-cell="{ row }">
                  <EmblemNameCell
                    :name="row.original.name"
                    :description="row.original.description"
                    :image="row.original.image"
                  />
                </template>
                <template #maxThreshold-cell="{ row }">
                  <MaxThresholdCell
                    :max-threshold="row.original.maxThreshold"
                    :max-grade="row.original.maxGrade"
                    :grade-thresholds="row.original.gradeThresholds"
                  />
                </template>
              </UTable>
            </TableLoader>
          </div>
        </template>

        <!-- Factions (toutes ou filtrées) -->
        <template v-else>
          <template
            v-for="{ faction, campaigns } in filteredFactionsCampaigns"
            :key="faction.key"
          >
            <div
              v-if="campaigns.some(c => filterEmblemsList(c.emblems).length > 0)"
              class="mb-8"
            >
              <h2 class="text-2xl font-pirate">
                {{ faction.name }}
              </h2>
              <p
                v-if="faction.motto"
                class="text-muted italic mb-4"
              >
                « {{ faction.motto }} »
              </p>

              <template
                v-for="campaign in campaigns"
                :key="campaign.id"
              >
                <div
                  v-if="filterEmblemsList(campaign.emblems).length > 0"
                  class="mb-6"
                >
                  <div
                    v-if="campaign.key !== 'default'"
                    class="mb-4"
                  >
                    <h3 class="text-lg font-semibold">
                      {{ campaign.name }}
                    </h3>
                    <p
                      v-if="campaign.description"
                      class="text-sm text-muted italic"
                    >
                      {{ campaign.description }}
                    </p>
                  </div>
                  <TableLoader>
                    <UTable
                      :data="getTableData(campaign.emblems)"
                      :columns="columns"
                    >
                      <template #name-cell="{ row }">
                        <EmblemNameCell
                          :name="row.original.name"
                          :description="row.original.description"
                          :image="row.original.image"
                        />
                      </template>
                      <template #maxThreshold-cell="{ row }">
                        <MaxThresholdCell
                          :max-threshold="row.original.maxThreshold"
                          :max-grade="row.original.maxGrade"
                          :grade-thresholds="row.original.gradeThresholds"
                        />
                      </template>
                    </UTable>
                  </TableLoader>
                </div>
              </template>
            </div>
          </template>
        </template>
      </template>

      <!-- Modal Import -->
      <ImportModal
        v-model:open="isImportModalOpen"
        :username="user?.username || ''"
        @imported="refresh()"
      />

      <!-- Modal Suppression -->
      <UModal v-model:open="isDeleteModalOpen">
        <template #content>
          <UCard>
            <template #header>
              <h2 class="text-xl font-semibold text-error">
                {{ deleteAccountToo ? $t('reputations.deleteMyAccount') : $t('reputations.deleteMyData') }}
              </h2>
            </template>
            <div class="space-y-4">
              <UAlert
                icon="i-lucide-alert-triangle"
                color="error"
                :title="$t('reputations.deleteWarning')"
              >
                <template #description>
                  {{ deleteAccountToo ? $t('reputations.deleteAccountWarningMessage') : $t('reputations.deleteWarningMessage') }}
                </template>
              </UAlert>

              <!-- Switch pour supprimer le compte -->
              <div class="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <USwitch v-model="deleteAccountToo" />
                <div>
                  <div class="font-medium">{{ $t('reputations.deleteAccountToo') }}</div>
                  <div class="text-sm text-muted">{{ $t('reputations.deleteAccountTooDescription') }}</div>
                </div>
              </div>

              <!-- Sélection des nouveaux chefs si nécessaire -->
              <div v-if="deleteAccountToo && loadingChefGroups" class="flex justify-center py-4">
                <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-primary" />
              </div>

              <div v-if="deleteAccountToo && !loadingChefGroups && chefGroups.length > 0" class="space-y-4">
                <UAlert
                  icon="i-lucide-crown"
                  color="warning"
                  :title="$t('reputations.transferChefTitle')"
                >
                  <template #description>
                    {{ $t('reputations.transferChefDescription') }}
                  </template>
                </UAlert>

                <div
                  v-for="group in chefGroups"
                  :key="group.groupId"
                  class="p-3 border border-muted rounded-lg space-y-2"
                >
                  <div class="font-medium">{{ group.groupName }}</div>
                  <USelect
                    v-model="chefTransfers[group.groupId]"
                    :placeholder="$t('reputations.selectNewChef')"
                    :items="group.members.map(m => ({ label: m.username, value: m.userId }))"
                    class="w-full"
                  />
                </div>
              </div>

              <p v-if="!deleteAccountToo">{{ $t('reputations.deleteConfirm') }}</p>
              <p v-else>{{ $t('reputations.deleteAccountConfirm') }}</p>
            </div>
            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton
                  :label="$t('common.cancel')"
                  color="neutral"
                  variant="outline"
                  @click="isDeleteModalOpen = false"
                />
                <UButton
                  :label="$t('common.delete')"
                  icon="i-lucide-trash-2"
                  color="error"
                  :loading="isDeleting"
                  :disabled="!canDelete"
                  @click="handleDelete"
                />
              </div>
            </template>
          </UCard>
        </template>
      </UModal>

      <!-- Modal Stats par faction -->
      <UModal v-model:open="isStatsModalOpen">
        <template #content>
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold">
                  {{ $t('myReputations.completionByFaction') }}
                </h2>
                <div class="text-2xl font-bold text-primary">
                  {{ completionStats.percentage }}%
                </div>
              </div>
            </template>
            <div class="space-y-3 max-h-96 overflow-y-auto">
              <div
                v-for="faction in factionStats"
                :key="faction.key"
                class="flex items-center gap-3"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-medium truncate">{{ faction.name }}</span>
                    <span class="text-sm text-muted ml-2">
                      {{ faction.completed }}/{{ faction.total }}
                    </span>
                  </div>
                  <div class="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="faction.percentage === 100 ? 'bg-success' : 'bg-primary'"
                      :style="{ width: `${faction.percentage}%` }"
                    />
                  </div>
                </div>
                <div
                  class="w-12 text-right font-bold"
                  :class="faction.percentage === 100 ? 'text-success' : 'text-primary'"
                >
                  {{ faction.percentage }}%
                </div>
              </div>
            </div>
            <template #footer>
              <div class="flex justify-end">
                <UButton
                  :label="$t('common.close')"
                  color="neutral"
                  variant="outline"
                  @click="isStatsModalOpen = false"
                />
              </div>
            </template>
          </UCard>
        </template>
      </UModal>
    </template>
  </UContainer>
</template>
