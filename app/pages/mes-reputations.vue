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

const { t } = useI18n()
const toast = useToast()
const { isAuthenticated } = useAuth()

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

const user = computed(() => data.value?.user)
const factions = computed(() => data.value?.factions || [])
const hasImportedData = computed(() => !!user.value?.lastImportAt)

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
      const matchingEmblems = campaign.emblems.filter(e => emblemMatchesSearch(e, query))

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

function getTableData(emblems: Array<EmblemInfo & { progress: EmblemProgress | null }>): SingleUserTableRow[] {
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
      name: emblem.name,
      description: emblem.description,
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
    await $fetch('/api/my-reputations', { method: 'DELETE' })
    toast.add({ title: t('common.success'), description: t('reputations.dataDeleted'), color: 'success' })
    isDeleteModalOpen.value = false
    await refresh()
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
                {{ $t('reputations.deleteMyData') }}
              </h2>
            </template>
            <div class="space-y-4">
              <UAlert
                icon="i-lucide-alert-triangle"
                color="error"
                :title="$t('reputations.deleteWarning')"
              >
                <template #description>
                  {{ $t('reputations.deleteWarningMessage') }}
                </template>
              </UAlert>
              <p>{{ $t('reputations.deleteConfirm') }}</p>
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
                  @click="handleDelete"
                />
              </div>
            </template>
          </UCard>
        </template>
      </UModal>
    </template>
  </UContainer>
</template>
