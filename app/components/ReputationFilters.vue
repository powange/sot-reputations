<script setup lang="ts">
interface Faction {
  id: number
  key: string
  name: string
  motto?: string | null
  translations?: Record<string, { name: string | null, motto: string | null }>
  campaigns: Campaign[]
}

interface Campaign {
  id: number
  key: string
  name: string
  description?: string | null
  translations?: Record<string, { name: string | null, description: string | null }>
}

const props = defineProps<{
  factions: Faction[]
  showCompletionFilter?: boolean
}>()

const { locale } = useI18n()

const searchQuery = defineModel<string>('searchQuery', { default: '' })
const selectedFactionKeys = defineModel<string[]>('selectedFactionKeys', { default: () => [] })
const selectedCampaignIds = defineModel<number[]>('selectedCampaignIds', { default: () => [] })
const emblemCompletionFilter = defineModel<'all' | 'incomplete' | 'complete'>('emblemCompletionFilter', { default: 'all' })
const highSeasOnlyFilter = defineModel<boolean>('highSeasOnlyFilter', { default: false })

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
const allFactionsSelected = computed(() => selectedFactionKeys.value.length === 0)

// Factions sélectionnées
const selectedFactions = computed(() => {
  if (allFactionsSelected.value) return props.factions
  return props.factions.filter(f => selectedFactionKeys.value.includes(f.key))
})

// Vérifier si on a des campagnes à afficher (exclure les factions avec seulement 'default')
const factionsWithCampaigns = computed(() => {
  return selectedFactions.value.filter(f =>
    f.campaigns.length > 1
    || (f.campaigns.length === 1 && f.campaigns[0]?.key !== 'default')
  )
})

const hasMultipleCampaigns = computed(() => factionsWithCampaigns.value.length > 0)

// Sélectionner toutes les campagnes quand on change de factions
// Mais préserver la sélection initiale venant de l'URL
let isFirstRun = true
watch(selectedFactions, (factions) => {
  const allCampaignIds = factions.flatMap(f => f.campaigns.map(c => c.id))

  if (isFirstRun) {
    isFirstRun = false
    // Au premier run, garder les campagnes de l'URL si elles sont valides
    const validFromUrl = selectedCampaignIds.value.filter(id => allCampaignIds.includes(id))
    if (validFromUrl.length > 0) {
      selectedCampaignIds.value = validFromUrl
      return
    }
  }

  selectedCampaignIds.value = allCampaignIds
}, { immediate: true })

function toggleFaction(factionKey: string) {
  const index = selectedFactionKeys.value.indexOf(factionKey)
  if (index === -1) {
    // Ajouter la faction
    selectedFactionKeys.value = [...selectedFactionKeys.value, factionKey]
  } else {
    // Retirer la faction (sauf si c'est la dernière et on veut garder au moins une sélection)
    selectedFactionKeys.value = selectedFactionKeys.value.filter(k => k !== factionKey)
  }
}

// Clic sur une faction : sélection simple (remplace l'existante). Ctrl/Cmd+clic :
// multi-sélection (ajoute/retire). Re-cliquer la seule faction sélectionnée revient
// à « toutes » (sélection vide).
function onFactionClick(factionKey: string, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    toggleFaction(factionKey)
    return
  }
  if (selectedFactionKeys.value.length === 1 && selectedFactionKeys.value[0] === factionKey) {
    selectedFactionKeys.value = []
  } else {
    selectedFactionKeys.value = [factionKey]
  }
}

function selectAllFactions() {
  selectedFactionKeys.value = []
}

// Clic sur une campagne : sélection simple (remplace). Ctrl/Cmd+clic : multi-sélection
// (toggle, en gardant au moins une campagne). Re-cliquer la seule campagne sélectionnée
// revient à « toutes » (toutes les campagnes des factions sélectionnées).
function onCampaignClick(campaignId: number, event: MouseEvent) {
  const allCampaignIds = selectedFactions.value.flatMap(f => f.campaigns.map(c => c.id))
  if (event.ctrlKey || event.metaKey) {
    if (selectedCampaignIds.value.includes(campaignId)) {
      if (selectedCampaignIds.value.length > 1) {
        selectedCampaignIds.value = selectedCampaignIds.value.filter(id => id !== campaignId)
      }
    } else {
      selectedCampaignIds.value = [...selectedCampaignIds.value, campaignId]
    }
    return
  }
  if (selectedCampaignIds.value.length === 1 && selectedCampaignIds.value[0] === campaignId) {
    selectedCampaignIds.value = allCampaignIds
  } else {
    selectedCampaignIds.value = [campaignId]
  }
}
</script>

<template>
  <UCard class="mb-6">
    <div class="space-y-4">
      <!-- Recherche -->
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-muted shrink-0">{{ $t('common.search') }} :</span>
        <UInput
          v-model="searchQuery"
          :placeholder="$t('reputations.searchPlaceholder')"
          icon="i-lucide-search"
          class="flex-1 max-w-2xl"
        />
      </div>

      <!-- Faction -->
      <div
        v-if="!isSearchActive"
        class="flex items-center gap-3 flex-wrap"
      >
        <span class="text-sm font-medium text-muted">{{ $t('reputations.factions') }}</span>
        <UButton
          :color="allFactionsSelected ? 'primary' : 'neutral'"
          :variant="allFactionsSelected ? 'solid' : 'outline'"
          size="sm"
          @click="selectAllFactions"
        >
          {{ $t('common.all') }}
        </UButton>
        <UButton
          v-for="faction in factions"
          :key="faction.key"
          :color="selectedFactionKeys.includes(faction.key) ? 'primary' : 'neutral'"
          :variant="selectedFactionKeys.includes(faction.key) ? 'solid' : 'outline'"
          size="sm"
          :title="$t('reputations.factionFilterHint')"
          @click="onFactionClick(faction.key, $event)"
        >
          {{ translateFactionField(faction, 'name', locale) }}
        </UButton>
      </div>

      <!-- Campagnes (groupées par faction si plusieurs factions) -->
      <template v-if="!isSearchActive && !allFactionsSelected && hasMultipleCampaigns">
        <div
          v-for="faction in factionsWithCampaigns"
          :key="faction.key"
          class="flex items-center gap-3 flex-wrap"
        >
          <span class="text-sm font-medium text-muted">
            {{ factionsWithCampaigns.length > 1 ? `${translateFactionField(faction, 'name', locale)} :` : $t('reputations.campaigns') }}
          </span>
          <UButton
            v-for="campaign in faction.campaigns"
            :key="campaign.id"
            :color="selectedCampaignIds.includes(campaign.id) ? 'info' : 'neutral'"
            :variant="selectedCampaignIds.includes(campaign.id) ? 'solid' : 'outline'"
            size="sm"
            :title="$t('reputations.campaignFilterHint')"
            @click="onCampaignClick(campaign.id, $event)"
          >
            {{ translateCampaignField(campaign, 'name', locale) }}
          </UButton>
        </div>
      </template>

      <!-- Slot pour filtres additionnels (ex: utilisateurs) -->
      <slot
        name="extra-filters"
        :is-search-active="isSearchActive"
      />

      <!-- Filtre completion -->
      <div
        v-if="!isSearchActive && showCompletionFilter"
        class="flex items-center gap-3 flex-wrap"
      >
        <span class="text-sm font-medium text-muted">{{ $t('reputations.filterAchievements') }}</span>
        <UButton
          :color="emblemCompletionFilter === 'all' ? 'primary' : 'neutral'"
          :variant="emblemCompletionFilter === 'all' ? 'solid' : 'outline'"
          size="sm"
          @click="emblemCompletionFilter = 'all'"
        >
          {{ $t('common.all') }}
        </UButton>
        <UButton
          :color="emblemCompletionFilter === 'incomplete' ? 'warning' : 'neutral'"
          :variant="emblemCompletionFilter === 'incomplete' ? 'solid' : 'outline'"
          size="sm"
          @click="emblemCompletionFilter = 'incomplete'"
        >
          {{ $t('reputations.notCompleted') }}
        </UButton>
        <UButton
          :color="emblemCompletionFilter === 'complete' ? 'success' : 'neutral'"
          :variant="emblemCompletionFilter === 'complete' ? 'solid' : 'outline'"
          size="sm"
          @click="emblemCompletionFilter = 'complete'"
        >
          {{ $t('reputations.completed') }}
        </UButton>

        <!-- Slot pour options additionnelles du filtre completion -->
        <slot name="completion-extra" />
      </div>

      <!-- Filtre « High Seas only » (mode de jeu) -->
      <div
        v-if="!isSearchActive"
        class="flex items-center gap-3 flex-wrap"
      >
        <span class="text-sm font-medium text-muted">{{ $t('reputations.modeFilter') }}</span>
        <UButton
          :color="highSeasOnlyFilter ? 'primary' : 'neutral'"
          :variant="highSeasOnlyFilter ? 'solid' : 'outline'"
          size="sm"
          icon="i-lucide-waves"
          :title="$t('reputations.highSeasOnlyHint')"
          @click="highSeasOnlyFilter = !highSeasOnlyFilter"
        >
          {{ $t('reputations.highSeasOnly') }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>
