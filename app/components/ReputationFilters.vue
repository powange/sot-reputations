<script setup lang="ts">
interface Faction {
  id: number
  key: string
  name: string
  campaigns: Campaign[]
}

interface Campaign {
  id: number
  key: string
  name: string
}

const props = defineProps<{
  factions: Faction[]
  showCompletionFilter?: boolean
}>()

const searchQuery = defineModel<string>('searchQuery', { default: '' })
const selectedFactionKeys = defineModel<string[]>('selectedFactionKeys', { default: () => [] })
const selectedCampaignIds = defineModel<number[]>('selectedCampaignIds', { default: () => [] })
const emblemCompletionFilter = defineModel<'all' | 'incomplete' | 'complete'>('emblemCompletionFilter', { default: 'all' })

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
    f.campaigns.length > 1 ||
    (f.campaigns.length === 1 && f.campaigns[0].key !== 'default')
  )
})

const hasMultipleCampaigns = computed(() => factionsWithCampaigns.value.length > 0)

// Sélectionner toutes les campagnes quand on change de factions
watch(selectedFactions, (factions) => {
  const allCampaignIds = factions.flatMap(f => f.campaigns.map(c => c.id))
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

function selectAllFactions() {
  selectedFactionKeys.value = []
}

function toggleCampaign(campaignId: number) {
  const allCampaignIds = selectedFactions.value.flatMap(f => f.campaigns.map(c => c.id))
  const allSelected = selectedCampaignIds.value.length === allCampaignIds.length

  if (allSelected) {
    selectedCampaignIds.value = [campaignId]
  } else {
    const index = selectedCampaignIds.value.indexOf(campaignId)
    if (index === -1) {
      selectedCampaignIds.value = [...selectedCampaignIds.value, campaignId]
    } else if (selectedCampaignIds.value.length > 1) {
      selectedCampaignIds.value = selectedCampaignIds.value.filter(id => id !== campaignId)
    }
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
      <div v-if="!isSearchActive" class="flex items-center gap-3 flex-wrap">
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
          @click="toggleFaction(faction.key)"
        >
          {{ faction.name }}
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
            {{ factionsWithCampaigns.length > 1 ? `${faction.name} :` : $t('reputations.campaigns') }}
          </span>
          <UButton
            v-for="campaign in faction.campaigns"
            :key="campaign.id"
            :color="selectedCampaignIds.includes(campaign.id) ? 'info' : 'neutral'"
            :variant="selectedCampaignIds.includes(campaign.id) ? 'solid' : 'outline'"
            size="sm"
            @click="toggleCampaign(campaign.id)"
          >
            {{ campaign.name }}
          </UButton>
        </div>
      </template>

      <!-- Slot pour filtres additionnels (ex: utilisateurs) -->
      <slot name="extra-filters" :is-search-active="isSearchActive" />

      <!-- Filtre completion -->
      <div v-if="!isSearchActive && showCompletionFilter" class="flex items-center gap-3 flex-wrap">
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
    </div>
  </UCard>
</template>
