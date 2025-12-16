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
const selectedFactionKey = defineModel<string>('selectedFactionKey', { default: '' })
const selectedCampaignIds = defineModel<number[]>('selectedCampaignIds', { default: () => [] })
const emblemCompletionFilter = defineModel<'all' | 'incomplete' | 'complete'>('emblemCompletionFilter', { default: 'all' })

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
const allFactionsSelected = computed(() => selectedFactionKey.value === '')

const selectedFaction = computed(() => {
  return props.factions.find(f => f.key === selectedFactionKey.value)
})

const hasMultipleCampaigns = computed(() => {
  if (!selectedFaction.value?.campaigns) return false
  return selectedFaction.value.campaigns.length > 1 ||
    (selectedFaction.value.campaigns.length === 1 && selectedFaction.value.campaigns[0].key !== 'default')
})

// Sélectionner toutes les campagnes quand on change de faction
watch(selectedFaction, (faction) => {
  if (faction?.campaigns) {
    selectedCampaignIds.value = faction.campaigns.map(c => c.id)
  }
}, { immediate: true })

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
</script>

<template>
  <UCard class="mb-6">
    <div class="space-y-4">
      <!-- Recherche -->
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-muted">Recherche :</span>
        <UInput
          v-model="searchQuery"
          placeholder="Rechercher un succes..."
          icon="i-lucide-search"
          class="max-w-xs"
        />
      </div>

      <!-- Faction -->
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

      <!-- Campagnes -->
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

      <!-- Slot pour filtres additionnels (ex: utilisateurs) -->
      <slot name="extra-filters" :is-search-active="isSearchActive" />

      <!-- Filtre completion -->
      <div v-if="!isSearchActive && showCompletionFilter" class="flex items-center gap-3 flex-wrap">
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

        <!-- Slot pour options additionnelles du filtre completion -->
        <slot name="completion-extra" />
      </div>
    </div>
  </UCard>
</template>
