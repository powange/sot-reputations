<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface UserInfo {
  id: number
  username: string
  lastImportAt: string | null
}

interface FactionInfo {
  id: number
  key: string
  name: string
  motto: string
}

interface EmblemInfo {
  id: number
  key: string
  name: string
  description: string
  image: string
  maxGrade: number
  campaignId: number
  factionKey: string
  campaignName: string
}

interface EmblemProgress {
  userId: number
  value: number
  threshold: number
  grade: number
  completed: boolean
}

interface CampaignWithEmblems {
  id: number
  key: string
  name: string
  description: string
  factionId: number
  emblems: Array<EmblemInfo & { progress: EmblemProgress | null }>
}

interface FactionWithCampaigns extends FactionInfo {
  campaigns: CampaignWithEmblems[]
}

interface MyReputationsData {
  user: UserInfo
  factions: FactionWithCampaigns[]
}

interface TableRow {
  id: number
  name: string
  description: string
  image: string
  progress: string
  completed: boolean
  hasProgress: boolean
}

const toast = useToast()
const route = useRoute()
const router = useRouter()
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
const importJsonText = ref('')
const isImporting = ref(false)

// Modal Suppression
const isDeleteModalOpen = ref(false)
const isDeleting = ref(false)

// Filtres - initialisés depuis l'URL
const selectedFactionKeys = ref<string[]>(
  route.query.factions
    ? (route.query.factions as string).split(',').filter(k => k)
    : []
)
const selectedCampaignIds = ref<number[]>(
  route.query.campaigns
    ? (route.query.campaigns as string).split(',').map(Number).filter(n => !isNaN(n))
    : []
)
const emblemCompletionFilter = ref<'all' | 'incomplete' | 'complete'>(
  (['all', 'incomplete', 'complete'].includes(route.query.completion as string)
    ? route.query.completion as 'all' | 'incomplete' | 'complete'
    : 'all')
)
const ignoreWithoutData = ref(route.query.ignoreEmpty === '1')
const searchQuery = ref((route.query.search as string) || '')

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
const allFactionsSelected = computed(() => selectedFactionKeys.value.length === 0)

// Synchroniser les filtres avec l'URL (mise à jour légère sans Vue Router)
let urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null

function updateUrlWithFilters() {
  if (!import.meta.client) return

  const params = new URLSearchParams()

  if (searchQuery.value.trim()) {
    params.set('search', searchQuery.value.trim())
  }
  if (selectedFactionKeys.value.length > 0) {
    params.set('factions', selectedFactionKeys.value.join(','))
  }
  if (selectedCampaignIds.value.length > 0) {
    params.set('campaigns', selectedCampaignIds.value.join(','))
  }
  if (emblemCompletionFilter.value !== 'all') {
    params.set('completion', emblemCompletionFilter.value)
  }
  if (ignoreWithoutData.value) {
    params.set('ignoreEmpty', '1')
  }

  const queryString = params.toString()
  const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname
  window.history.replaceState({}, '', newUrl)
}

watch(
  [searchQuery, selectedFactionKeys, selectedCampaignIds, emblemCompletionFilter, ignoreWithoutData],
  () => {
    if (urlUpdateTimeout) {
      clearTimeout(urlUpdateTimeout)
    }
    urlUpdateTimeout = setTimeout(updateUrlWithFilters, 300)
  },
  { deep: true }
)

const user = computed(() => data.value?.user)
const factions = computed(() => data.value?.factions || [])
const hasImportedData = computed(() => !!user.value?.lastImportAt)

// Factions sélectionnées (filtrées par selectedFactionKeys si défini)
const selectedFactions = computed(() => {
  if (allFactionsSelected.value) return factions.value
  return factions.value.filter(f => selectedFactionKeys.value.includes(f.key))
})

// Factions avec leurs campagnes filtrées
const filteredFactionsCampaigns = computed(() => {
  return selectedFactions.value.map(faction => ({
    faction,
    campaigns: faction.campaigns.filter(c =>
      selectedCampaignIds.value.includes(c.id) &&
      (c.key !== 'default' || faction.campaigns.length === 1)
    )
  }))
})

const searchResults = computed(() => {
  if (!isSearchActive.value) return []

  const query = searchQuery.value.toLowerCase().trim()
  const results: Array<{
    factionName: string
    campaignName: string
    campaignKey: string
    emblems: Array<EmblemInfo & { progress: EmblemProgress | null }>
  }> = []

  for (const faction of factions.value) {
    for (const campaign of faction.campaigns) {
      const matchingEmblems = campaign.emblems.filter(e =>
        e.name.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query)
      )

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

function formatLastImport(dateStr: string | null): string {
  if (!dateStr) return 'Jamais importe'
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

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

const columns = computed<TableColumn<TableRow>[]>(() => {
  const cols: TableColumn<TableRow>[] = [
    {
      accessorKey: 'name',
      header: 'Succes',
      cell: ({ row }) => {
        const children = []

        if (row.original.image) {
          children.push(h('img', {
            src: row.original.image,
            alt: row.original.name,
            class: 'w-10 h-10 object-contain shrink-0'
          }))
        }

        children.push(h('div', {}, [
          h('div', { class: 'font-medium' }, row.original.name),
          h('div', { class: 'text-xs text-muted' }, row.original.description)
        ]))

        return h('div', { class: 'flex items-center gap-3' }, children)
      }
    }
  ]

  if (hasImportedData.value) {
    cols.push({
      accessorKey: 'progress',
      header: 'Progression',
      cell: ({ row }) => {
        let colorClass = 'text-muted'
        if (row.original.completed) {
          colorClass = 'text-success font-medium'
        } else if (row.original.hasProgress) {
          colorClass = 'text-warning'
        }

        return h('span', { class: colorClass }, row.original.progress)
      }
    })
  }

  return cols
})

function getTableData(emblems: Array<EmblemInfo & { progress: EmblemProgress | null }>): TableRow[] {
  const filteredEmblems = filterEmblemsList(emblems)

  return filteredEmblems.map(emblem => {
    const progress = emblem.progress
    let progressDisplay = '-'
    let completed = false
    let hasProgress = false

    if (progress) {
      progressDisplay = progress.threshold > 0
        ? `${progress.value}/${progress.threshold}`
        : (progress.completed ? 'Oui' : 'Non')
      completed = progress.completed
      hasProgress = progress.value > 0
    }

    return {
      id: emblem.id,
      name: emblem.name,
      description: emblem.description,
      image: emblem.image || '',
      progress: progressDisplay,
      completed,
      hasProgress
    }
  })
}

async function handleImport() {
  if (!importJsonText.value.trim()) {
    toast.add({ title: 'Erreur', description: 'JSON requis', color: 'error' })
    return
  }

  let jsonData: unknown
  try {
    jsonData = JSON.parse(importJsonText.value)
  } catch {
    toast.add({ title: 'Erreur', description: 'JSON invalide', color: 'error' })
    return
  }

  isImporting.value = true
  try {
    await $fetch('/api/import', {
      method: 'POST',
      body: {
        username: user.value?.username,
        password: '',
        jsonData
      }
    })
    toast.add({ title: 'Succes', description: 'Donnees importees', color: 'success' })
    isImportModalOpen.value = false
    importJsonText.value = ''
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isImporting.value = false
  }
}

async function handleDelete() {
  isDeleting.value = true
  try {
    await $fetch('/api/my-reputations', { method: 'DELETE' })
    toast.add({ title: 'Succes', description: 'Donnees supprimees', color: 'success' })
    isDeleteModalOpen.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <UContainer class="py-8">
    <!-- Chargement -->
    <div v-if="isLoading" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex justify-between items-start mb-8">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <NuxtLink to="/" class="text-muted hover:text-foreground">
            <UIcon name="i-lucide-arrow-left" class="w-5 h-5" />
          </NuxtLink>
          <h1 class="text-3xl font-pirate">
            Mes Reputations
          </h1>
        </div>
        <p class="text-muted">
          Dernier import : {{ formatLastImport(user?.lastImportAt || null) }}
        </p>
      </div>

      <div class="flex gap-2">
        <UButton
          v-if="hasImportedData"
          icon="i-lucide-trash-2"
          label="Supprimer"
          color="error"
          variant="outline"
          @click="isDeleteModalOpen = true"
        />
        <UButton
          icon="i-lucide-upload"
          label="Importer"
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
        Aucune donnee de reputation
      </h2>
      <p class="text-muted mb-4">
        Importez vos donnees de reputation pour les visualiser.
      </p>
      <UButton
        icon="i-lucide-upload"
        label="Importer mes donnees"
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
          <div v-if="emblemCompletionFilter === 'incomplete'" class="flex items-center gap-2 ml-4 pl-4 border-l border-muted">
            <USwitch v-model="ignoreWithoutData" size="sm" />
            <span class="text-sm text-muted">Ignorer sans donnees</span>
          </div>
        </template>
      </ReputationFilters>

      <!-- Message si pas de données importées -->
      <UAlert
        v-if="!hasImportedData"
        icon="i-lucide-info"
        color="info"
        title="Importez vos donnees"
        class="mb-6"
      >
        <template #description>
          Pour voir votre progression sur chaque succes,
          <button class="underline font-medium" @click="isImportModalOpen = true">importez vos donnees</button>
          ou consultez le <NuxtLink to="/tutoriel" class="underline font-medium">tutoriel</NuxtLink>.
        </template>
      </UAlert>

      <!-- Résultats de recherche -->
      <template v-if="isSearchActive">
        <div v-if="searchResults.length === 0" class="text-center py-8 text-muted">
          Aucun succes trouve pour "{{ searchQuery }}"
        </div>
        <div
          v-for="(result, index) in searchResults"
          :key="`${result.factionName}-${result.campaignKey}-${index}`"
          class="mb-8"
        >
          <h3 class="text-lg font-semibold mb-4">
            {{ result.factionName }}
            <span v-if="result.campaignKey !== 'default'" class="text-muted font-normal">
              / {{ result.campaignName }}
            </span>
          </h3>
          <UTable :data="getTableData(result.emblems)" :columns="columns" />
        </div>
      </template>

      <!-- Factions (toutes ou filtrées) -->
      <template v-else>
        <template v-for="{ faction, campaigns } in filteredFactionsCampaigns" :key="faction.key">
          <div v-if="campaigns.some(c => filterEmblemsList(c.emblems).length > 0)" class="mb-8">
            <h2 class="text-2xl font-pirate">{{ faction.name }}</h2>
            <p v-if="faction.motto" class="text-muted italic mb-4">« {{ faction.motto }} »</p>

            <template v-for="campaign in campaigns" :key="campaign.id">
              <div v-if="filterEmblemsList(campaign.emblems).length > 0" class="mb-6">
                <div v-if="campaign.key !== 'default'" class="mb-4">
                  <h3 class="text-lg font-semibold">{{ campaign.name }}</h3>
                  <p v-if="campaign.description" class="text-sm text-muted italic">{{ campaign.description }}</p>
                </div>
                <UTable :data="getTableData(campaign.emblems)" :columns="columns" />
              </div>
            </template>
          </div>
        </template>
      </template>
    </template>

    <!-- Modal Import -->
    <UModal v-model:open="isImportModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Importer mes donnees</h2>
          </template>
          <div class="space-y-4">
            <UAlert icon="i-lucide-info" color="info" title="Astuce">
              <template #description>
                <NuxtLink to="/tutoriel" class="underline" target="_blank">Voir le tutoriel</NuxtLink>
                pour savoir comment recuperer vos donnees.
              </template>
            </UAlert>
            <UFormField label="Donnees JSON">
              <UTextarea
                v-model="importJsonText"
                placeholder="Collez ici le JSON..."
                :rows="10"
                class="w-full"
              />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Annuler" color="neutral" variant="outline" @click="isImportModalOpen = false" />
              <UButton label="Importer" icon="i-lucide-upload" :loading="isImporting" @click="handleImport" />
            </div>
          </template>
        </UCard>
      </template>
      </UModal>

      <!-- Modal Suppression -->
      <UModal v-model:open="isDeleteModalOpen">
        <template #content>
          <UCard>
            <template #header>
              <h2 class="text-xl font-semibold text-error">Supprimer mes donnees</h2>
            </template>
            <div class="space-y-4">
              <UAlert icon="i-lucide-alert-triangle" color="error" title="Attention">
                <template #description>
                  Cette action est irreversible. Toutes vos donnees de progression seront supprimees.
                </template>
              </UAlert>
              <p>Etes-vous sur de vouloir supprimer toutes vos donnees de reputation ?</p>
            </div>
            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton label="Annuler" color="neutral" variant="outline" @click="isDeleteModalOpen = false" />
                <UButton label="Supprimer" icon="i-lucide-trash-2" color="error" :loading="isDeleting" @click="handleDelete" />
              </div>
            </template>
          </UCard>
        </template>
      </UModal>
    </template>
  </UContainer>
</template>
