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
const { isAuthenticated } = useAuth()

// Rediriger si non connecté
if (!isAuthenticated.value) {
  navigateTo('/')
}

// Récupérer les données
const { data, error, refresh } = await useFetch<MyReputationsData>('/api/my-reputations')

if (error.value) {
  navigateTo('/')
}

// Modal Import
const isImportModalOpen = ref(false)
const importJsonText = ref('')
const isImporting = ref(false)

// Filtres
const selectedFactionKey = ref<string>('')
const selectedCampaignIds = ref<number[]>([])
const emblemCompletionFilter = ref<'all' | 'incomplete' | 'complete'>('all')
const searchQuery = ref('')

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
const allFactionsSelected = computed(() => selectedFactionKey.value === '')

const user = computed(() => data.value?.user)
const factions = computed(() => data.value?.factions || [])

const selectedFaction = computed(() => {
  return factions.value.find(f => f.key === selectedFactionKey.value)
})

watch(selectedFaction, (faction) => {
  if (faction?.campaigns) {
    selectedCampaignIds.value = faction.campaigns.map(c => c.id)
  }
}, { immediate: true })

const hasMultipleCampaigns = computed(() => {
  if (!selectedFaction.value?.campaigns) return false
  return selectedFaction.value.campaigns.length > 1 ||
    (selectedFaction.value.campaigns.length === 1 && selectedFaction.value.campaigns[0].key !== 'default')
})

const filteredCampaigns = computed(() => {
  if (!selectedFaction.value?.campaigns) return []
  return selectedFaction.value.campaigns.filter(c => selectedCampaignIds.value.includes(c.id))
})

const allFactionsCampaigns = computed(() => {
  return factions.value.map(faction => ({
    faction,
    campaigns: faction.campaigns.filter(c => c.key !== 'default' || faction.campaigns.length === 1)
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

function filterEmblems<T extends { progress: EmblemProgress | null }>(emblems: T[]): T[] {
  if (emblemCompletionFilter.value === 'all') {
    return emblems
  }

  return emblems.filter(emblem => {
    const completed = emblem.progress?.completed || false
    if (emblemCompletionFilter.value === 'complete') {
      return completed
    } else {
      return !completed
    }
  })
}

const columns = computed<TableColumn<TableRow>[]>(() => [
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
  },
  {
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
  }
])

function getTableData(emblems: Array<EmblemInfo & { progress: EmblemProgress | null }>): TableRow[] {
  const filteredEmblems = filterEmblems(emblems)

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

function toggleCampaign(campaignId: number) {
  const allCampaignIds = selectedFaction.value?.campaigns.map(c => c.id) || []
  const allSelected = selectedCampaignIds.value.length === allCampaignIds.length

  if (allSelected) {
    selectedCampaignIds.value = [campaignId]
  } else {
    const index = selectedCampaignIds.value.indexOf(campaignId)
    if (index === -1) {
      selectedCampaignIds.value.push(campaignId)
    } else if (selectedCampaignIds.value.length > 1) {
      selectedCampaignIds.value.splice(index, 1)
    }
  }
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
</script>

<template>
  <UContainer class="py-8">
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

      <UButton
        icon="i-lucide-upload"
        label="Importer"
        @click="isImportModalOpen = true"
      />
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
      <UCard class="mb-6">
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-muted">Recherche :</span>
            <UInput
              v-model="searchQuery"
              placeholder="Rechercher un succes..."
              icon="i-lucide-search"
              class="max-w-xs"
            />
          </div>

          <div v-if="!isSearchActive" class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-medium text-muted">Faction :</span>
            <UButton
              :color="allFactionsSelected ? 'primary' : 'neutral'"
              :variant="allFactionsSelected ? 'solid' : 'outline'"
              size="sm"
              @click="selectedFactionKey = ''"
            >
              Toutes
            </UButton>
            <UButton
              v-for="faction in factions"
              :key="faction.key"
              :color="selectedFactionKey === faction.key ? 'primary' : 'neutral'"
              :variant="selectedFactionKey === faction.key ? 'solid' : 'outline'"
              size="sm"
              @click="selectedFactionKey = faction.key"
            >
              {{ faction.name }}
            </UButton>
          </div>

          <div
            v-if="!isSearchActive && !allFactionsSelected && hasMultipleCampaigns"
            class="flex items-center gap-3 flex-wrap"
          >
            <span class="text-sm font-medium text-muted">Campagnes :</span>
            <UButton
              v-for="campaign in selectedFaction?.campaigns"
              :key="campaign.id"
              :color="selectedCampaignIds.includes(campaign.id) ? 'info' : 'neutral'"
              :variant="selectedCampaignIds.includes(campaign.id) ? 'solid' : 'outline'"
              size="sm"
              @click="toggleCampaign(campaign.id)"
            >
              {{ campaign.name }}
            </UButton>
          </div>

          <div v-if="!isSearchActive" class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-medium text-muted">Filtrer succes :</span>
            <UButton
              :color="emblemCompletionFilter === 'all' ? 'primary' : 'neutral'"
              :variant="emblemCompletionFilter === 'all' ? 'solid' : 'outline'"
              size="sm"
              @click="emblemCompletionFilter = 'all'"
            >
              Tous
            </UButton>
            <UButton
              :color="emblemCompletionFilter === 'incomplete' ? 'warning' : 'neutral'"
              :variant="emblemCompletionFilter === 'incomplete' ? 'solid' : 'outline'"
              size="sm"
              @click="emblemCompletionFilter = 'incomplete'"
            >
              Non completes
            </UButton>
            <UButton
              :color="emblemCompletionFilter === 'complete' ? 'success' : 'neutral'"
              :variant="emblemCompletionFilter === 'complete' ? 'solid' : 'outline'"
              size="sm"
              @click="emblemCompletionFilter = 'complete'"
            >
              Completes
            </UButton>
          </div>
        </div>
      </UCard>

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

      <!-- Toutes les factions -->
      <template v-else-if="allFactionsSelected">
        <template v-for="{ faction, campaigns } in allFactionsCampaigns" :key="faction.key">
          <div v-if="campaigns.some(c => filterEmblems(c.emblems).length > 0)" class="mb-8">
            <h2 class="text-2xl font-pirate">{{ faction.name }}</h2>
            <p v-if="faction.motto" class="text-muted italic mb-4">« {{ faction.motto }} »</p>

            <template v-for="campaign in campaigns" :key="campaign.id">
              <div v-if="filterEmblems(campaign.emblems).length > 0" class="mb-6">
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

      <!-- Faction spécifique -->
      <template v-else-if="selectedFaction">
        <div class="mb-6">
          <h2 class="text-2xl font-pirate">{{ selectedFaction.name }}</h2>
          <p v-if="selectedFaction.motto" class="text-muted italic">« {{ selectedFaction.motto }} »</p>
        </div>

        <template v-for="campaign in filteredCampaigns" :key="campaign.id">
          <div v-if="filterEmblems(campaign.emblems).length > 0" class="mb-8">
            <div v-if="campaign.key !== 'default'" class="mb-4">
              <h3 class="text-lg font-semibold">{{ campaign.name }}</h3>
              <p v-if="campaign.description" class="text-sm text-muted italic">{{ campaign.description }}</p>
            </div>
            <UTable :data="getTableData(campaign.emblems)" :columns="columns" />
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
  </UContainer>
</template>
