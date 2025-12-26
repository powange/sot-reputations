<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Factions - Administration'
})

// Redirection si non admin/moderateur
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value || !isAdminOrModerator.value) {
      navigateTo('/')
    }
  }
})

interface Emblem {
  id: number
  key: string
  name: string
  description: string | null
  image: string | null
  maxGrade: number
  sortOrder: number
  userCount: number
  validated: number
  gradesConfigured: number
}

interface Campaign {
  id: number
  key: string
  name: string
  description: string | null
  sortOrder: number
  emblems: Emblem[]
}

interface Faction {
  id: number
  key: string
  name: string
  motto: string | null
  campaigns: Campaign[]
}

const { data: factions, status, refresh } = await useFetch<Faction[]>('/api/admin/factions')

// Compteurs
const stats = computed(() => {
  if (!factions.value) return { factions: 0, campaigns: 0, emblems: 0 }

  let campaigns = 0
  let emblems = 0

  for (const faction of factions.value) {
    campaigns += faction.campaigns.length
    for (const campaign of faction.campaigns) {
      emblems += campaign.emblems.length
    }
  }

  return {
    factions: factions.value.length,
    campaigns,
    emblems
  }
})

// Accordéon ouvert
const openFactions = ref<string[]>([])
const openCampaigns = ref<string[]>([])

function toggleFaction(key: string) {
  const index = openFactions.value.indexOf(key)
  if (index === -1) {
    openFactions.value.push(key)
  } else {
    openFactions.value.splice(index, 1)
  }
}

function toggleCampaign(key: string) {
  const index = openCampaigns.value.indexOf(key)
  if (index === -1) {
    openCampaigns.value.push(key)
  } else {
    openCampaigns.value.splice(index, 1)
  }
}

function isFactionOpen(key: string) {
  return openFactions.value.includes(key)
}

function isCampaignOpen(key: string) {
  return openCampaigns.value.includes(key)
}

// Edition des grades
const editingEmblem = ref<Emblem | null>(null)
const isEditModalOpen = computed({
  get: () => editingEmblem.value !== null,
  set: (value) => {
    if (!value) editingEmblem.value = null
  }
})

function editEmblemGrades(emblem: Emblem) {
  editingEmblem.value = emblem
}

function onGradesSaved() {
  // On pourrait rafraîchir les données ici si nécessaire
}

// Validation des emblèmes
const validatingEmblems = ref<number[]>([])

async function validateEmblem(emblem: Emblem) {
  validatingEmblems.value.push(emblem.id)
  try {
    await $fetch(`/api/admin/emblems/${emblem.id}/validate`, { method: 'POST' })
    toast.add({
      title: 'Accomplissement valide',
      description: `"${emblem.name}" est maintenant visible`,
      color: 'success'
    })
    await refresh()
  } catch {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de valider l\'accomplissement',
      color: 'error'
    })
  } finally {
    validatingEmblems.value = validatingEmblems.value.filter(id => id !== emblem.id)
  }
}

// Filtre emblèmes non validés
const showOnlyUnvalidated = ref(false)

// Filtre emblèmes avec grades incomplets
const showOnlyIncompleteGrades = ref(false)

// Recherche d'emblèmes
const searchQuery = ref('')

// Compteur d'emblèmes non validés
const unvalidatedCount = computed(() => {
  if (!factions.value) return 0
  let count = 0
  for (const faction of factions.value) {
    for (const campaign of faction.campaigns) {
      count += campaign.emblems.filter(e => e.validated === 0).length
    }
  }
  return count
})

// Compteur d'emblèmes avec grades incomplets (maxGrade > 1 et gradesConfigured < maxGrade)
const incompleteGradesCount = computed(() => {
  if (!factions.value) return 0
  let count = 0
  for (const faction of factions.value) {
    for (const campaign of faction.campaigns) {
      count += campaign.emblems.filter(e => e.maxGrade > 1 && e.gradesConfigured < e.maxGrade).length
    }
  }
  return count
})

// Toggle filtre et ouvrir les accordéons contenant des non validés
function toggleUnvalidatedFilter() {
  showOnlyUnvalidated.value = !showOnlyUnvalidated.value

  if (showOnlyUnvalidated.value && factions.value) {
    // Ouvrir automatiquement les factions/campagnes avec des emblèmes non validés
    for (const faction of factions.value) {
      const hasUnvalidated = faction.campaigns.some(c => c.emblems.some(e => e.validated === 0))
      if (hasUnvalidated) {
        if (!openFactions.value.includes(faction.key)) {
          openFactions.value.push(faction.key)
        }
        for (const campaign of faction.campaigns) {
          const campaignKey = `${faction.key}-${campaign.key}`
          if (campaign.emblems.some(e => e.validated === 0) && !openCampaigns.value.includes(campaignKey)) {
            openCampaigns.value.push(campaignKey)
          }
        }
      }
    }
  }
}

// Factions filtrées
const filteredFactions = computed(() => {
  if (!factions.value) return []

  const query = searchQuery.value
  const hasSearch = query.trim().length > 0
  const hasUnvalidatedFilter = showOnlyUnvalidated.value
  const hasIncompleteGradesFilter = showOnlyIncompleteGrades.value

  // Pas de filtre actif
  if (!hasSearch && !hasUnvalidatedFilter && !hasIncompleteGradesFilter) return factions.value

  return factions.value
    .map(faction => ({
      ...faction,
      campaigns: faction.campaigns
        .map(campaign => ({
          ...campaign,
          emblems: campaign.emblems.filter(e => {
            const matchesSearch = emblemMatchesSearch(e, query, { includeKey: true })
            const matchesUnvalidated = !hasUnvalidatedFilter || e.validated === 0
            const matchesIncompleteGrades = !hasIncompleteGradesFilter || (e.maxGrade > 1 && e.gradesConfigured < e.maxGrade)
            return matchesSearch && matchesUnvalidated && matchesIncompleteGrades
          })
        }))
        .filter(campaign => campaign.emblems.length > 0)
    }))
    .filter(faction => faction.campaigns.length > 0)
})

// Ouvrir les accordéons quand il y a une recherche ou un filtre
function openFilteredAccordions() {
  for (const faction of filteredFactions.value) {
    if (!openFactions.value.includes(faction.key)) {
      openFactions.value.push(faction.key)
    }
    for (const campaign of faction.campaigns) {
      const campaignKey = `${faction.key}-${campaign.key}`
      if (!openCampaigns.value.includes(campaignKey)) {
        openCampaigns.value.push(campaignKey)
      }
    }
  }
}

watch(searchQuery, (query) => {
  if (query.trim() && factions.value) {
    openFilteredAccordions()
  }
})

watch(showOnlyIncompleteGrades, (value) => {
  if (value && factions.value) {
    openFilteredAccordions()
  }
})
</script>

<template>
  <UContainer class="py-8 max-w-6xl">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        Factions & Accomplissements
      </h1>
      <p class="text-muted mt-2">
        Gestion des factions, campagnes et accomplissements
      </p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-primary">{{ stats.factions }}</div>
          <div class="text-sm text-muted">Factions</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-primary">{{ stats.campaigns }}</div>
          <div class="text-sm text-muted">Campagnes</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-primary">{{ stats.emblems }}</div>
          <div class="text-sm text-muted">Accomplissements</div>
        </div>
      </UCard>
      <UCard
        :class="[
          unvalidatedCount > 0 ? 'ring-2 ring-warning cursor-pointer hover:bg-muted/10' : '',
          showOnlyUnvalidated ? 'bg-warning/10' : ''
        ]"
        @click="unvalidatedCount > 0 && toggleUnvalidatedFilter()"
      >
        <div class="text-center">
          <div class="text-3xl font-bold" :class="unvalidatedCount > 0 ? 'text-warning' : 'text-success'">
            {{ unvalidatedCount }}
          </div>
          <div class="text-sm text-muted flex items-center justify-center gap-1">
            <span>A valider</span>
            <UIcon v-if="showOnlyUnvalidated" name="i-lucide-filter" class="w-3 h-3" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Recherche et filtres -->
    <div class="mb-6 flex flex-wrap items-center gap-4">
      <UInput
        v-model="searchQuery"
        placeholder="Rechercher un accomplissement..."
        icon="i-lucide-search"
        size="lg"
        class="w-full sm:w-80"
      />
      <USwitch
        v-model="showOnlyIncompleteGrades"
        :label="`Grades a configurer (${incompleteGradesCount})`"
        :disabled="incompleteGradesCount === 0"
      />
    </div>

    <!-- Loading -->
    <div v-if="status === 'pending'" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>

    <!-- Factions -->
    <div v-else-if="filteredFactions && filteredFactions.length > 0" class="space-y-4">
      <UCard v-for="faction in filteredFactions" :key="faction.id">
        <!-- Header Faction -->
        <div
          class="flex items-center justify-between cursor-pointer"
          @click="toggleFaction(faction.key)"
        >
          <div class="flex items-center gap-3">
            <UIcon
              :name="isFactionOpen(faction.key) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="w-5 h-5 text-muted"
            />
            <div>
              <h3 class="font-semibold">{{ faction.name }}</h3>
              <p v-if="faction.motto" class="text-sm text-muted italic">{{ faction.motto }}</p>
            </div>
          </div>
          <div class="flex items-center gap-4 text-sm text-muted">
            <span>{{ faction.campaigns.length }} campagne{{ faction.campaigns.length > 1 ? 's' : '' }}</span>
            <UBadge color="neutral" size="xs">{{ faction.key }}</UBadge>
          </div>
        </div>

        <!-- Campagnes -->
        <div v-if="isFactionOpen(faction.key)" class="mt-4 ml-8 space-y-3">
          <div
            v-for="campaign in faction.campaigns"
            :key="campaign.id"
            class="border border-muted/30 rounded-lg overflow-hidden"
          >
            <!-- Header Campagne -->
            <div
              class="flex items-center justify-between p-3 bg-muted/10 cursor-pointer"
              @click="toggleCampaign(`${faction.key}-${campaign.key}`)"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="isCampaignOpen(`${faction.key}-${campaign.key}`) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  class="w-4 h-4 text-muted"
                />
                <span class="font-medium">{{ campaign.name }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm text-muted">
                <span>{{ campaign.emblems.length }} accomplissement{{ campaign.emblems.length > 1 ? 's' : '' }}</span>
                <UBadge color="neutral" size="xs">{{ campaign.key }}</UBadge>
              </div>
            </div>

            <!-- Emblèmes -->
            <div v-if="isCampaignOpen(`${faction.key}-${campaign.key}`)" class="p-3">
              <table v-if="campaign.emblems.length > 0" class="w-full text-sm">
                <thead>
                  <tr class="border-b border-muted/30">
                    <th class="text-left py-2 px-2 font-medium">Accomplissement</th>
                    <th class="text-left py-2 px-2 font-medium">Key</th>
                    <th class="text-center py-2 px-2 font-medium">Grades</th>
                    <th class="text-center py-2 px-2 font-medium">Joueurs</th>
                    <th class="w-10" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="emblem in campaign.emblems"
                    :key="emblem.id"
                    class="border-b border-muted/20 last:border-0"
                  >
                    <td class="py-2 px-2">
                      <div class="flex items-center gap-2">
                        <img
                          v-if="emblem.image"
                          :src="emblem.image"
                          :alt="emblem.name"
                          class="w-8 h-8 rounded"
                        />
                        <div v-else class="w-8 h-8 rounded bg-muted/30 flex items-center justify-center">
                          <UIcon name="i-lucide-image-off" class="w-4 h-4 text-muted" />
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="font-medium">{{ emblem.name }}</span>
                            <UBadge v-if="emblem.validated === 0" color="warning" size="xs">
                              Non valide
                            </UBadge>
                          </div>
                          <div v-if="emblem.description" class="text-xs text-muted truncate max-w-xs">
                            {{ emblem.description }}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-2 px-2">
                      <code class="text-xs bg-muted/30 px-1 py-0.5 rounded">{{ emblem.key }}</code>
                    </td>
                    <td class="py-2 px-2 text-center">
                      {{ emblem.maxGrade }}
                    </td>
                    <td class="py-2 px-2 text-center">
                      <UBadge v-if="emblem.userCount > 0" color="success" size="xs">
                        {{ emblem.userCount }}
                      </UBadge>
                      <span v-else class="text-muted">-</span>
                    </td>
                    <td class="py-2 px-2 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <UButton
                          v-if="emblem.validated === 0"
                          icon="i-lucide-check"
                          size="xs"
                          variant="ghost"
                          color="success"
                          :loading="validatingEmblems.includes(emblem.id)"
                          @click.stop="validateEmblem(emblem)"
                        />
                        <UButton
                          v-if="emblem.maxGrade > 1"
                          icon="i-lucide-pencil"
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          @click.stop="editEmblemGrades(emblem)"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="text-muted text-center py-4">Aucun accomplissement</p>
            </div>
          </div>

          <p v-if="faction.campaigns.length === 0" class="text-muted text-center py-4">
            Aucune campagne
          </p>
        </div>
      </UCard>
    </div>

    <div v-else class="text-center py-8 text-muted">
      <template v-if="searchQuery.trim()">
        Aucun accomplissement trouve pour "{{ searchQuery }}"
      </template>
      <template v-else>
        Aucune faction
      </template>
    </div>

    <!-- Modal edition grades -->
    <UModal v-model:open="isEditModalOpen">
      <template #content>
        <UCard>
          <EmblemGradesEditor
            v-if="editingEmblem"
            :emblem="editingEmblem"
            @close="editingEmblem = null"
            @saved="onGradesSaved"
          />
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
