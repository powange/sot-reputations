import type { FactionInfo, CampaignInfo } from '~/types/reputation'

interface FactionWithCampaigns extends FactionInfo {
  campaigns: CampaignInfo[]
}

interface UseEmblemFiltersOptions {
  factions: Ref<FactionWithCampaigns[]> | ComputedRef<FactionWithCampaigns[]>
  /** Paramètres URL supplémentaires à synchroniser */
  extraUrlParams?: () => Record<string, string | undefined>
}

export function useEmblemFilters(options: UseEmblemFiltersOptions) {
  const route = useRoute()

  // Filtres de base - initialisés depuis l'URL
  const searchQuery = ref((route.query.search as string) || '')

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

  // Computed
  const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
  const allFactionsSelected = computed(() => selectedFactionKeys.value.length === 0)

  const selectedFactions = computed(() => {
    if (allFactionsSelected.value) return options.factions.value
    return options.factions.value.filter(f => selectedFactionKeys.value.includes(f.key))
  })

  const selectedFactionCampaignIds = computed(() =>
    selectedFactions.value.flatMap(f => f.campaigns.map(c => c.id))
  )

  const allCampaignsSelected = computed(() =>
    areAllSelected(selectedCampaignIds.value, selectedFactionCampaignIds.value)
  )

  const filteredFactionsCampaigns = computed(() => {
    return selectedFactions.value.map(faction => ({
      faction,
      campaigns: faction.campaigns.filter(c =>
        selectedCampaignIds.value.includes(c.id) &&
        (c.key !== 'default' || faction.campaigns.length === 1)
      )
    }))
  })

  // Synchronisation URL
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
    if (selectedCampaignIds.value.length > 0 && !allCampaignsSelected.value) {
      params.set('campaigns', selectedCampaignIds.value.join(','))
    }
    if (emblemCompletionFilter.value !== 'all') {
      params.set('completion', emblemCompletionFilter.value)
    }
    if (ignoreWithoutData.value) {
      params.set('ignoreEmpty', '1')
    }

    // Ajouter les paramètres supplémentaires
    if (options.extraUrlParams) {
      const extra = options.extraUrlParams()
      for (const [key, value] of Object.entries(extra)) {
        if (value !== undefined) {
          params.set(key, value)
        }
      }
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

  return {
    // Refs
    searchQuery,
    selectedFactionKeys,
    selectedCampaignIds,
    emblemCompletionFilter,
    ignoreWithoutData,
    // Computed
    isSearchActive,
    allFactionsSelected,
    selectedFactions,
    selectedFactionCampaignIds,
    allCampaignsSelected,
    filteredFactionsCampaigns,
    // Functions
    updateUrlWithFilters
  }
}
