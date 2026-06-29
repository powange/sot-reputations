<script setup lang="ts">
const { t, locale } = useI18n()
const { isAuthenticated } = useAuth()
const route = useRoute()
// URL unique /chest : le mode public (catalogue « Le coffre », sans données ni
// filtres liés à l'utilisateur) dépend de la connexion, pas de l'URL.
const isPublic = computed(() => !isAuthenticated.value)

useSeoMeta({
  title: () => `${isPublic.value ? t('yourChest.publicTitle') : t('yourChest.title')} - SoT Reputations`
})

interface ChestItem {
  id: number
  uid: string
  category: string
  subcategory: string | null
  name: string
  description: string | null
  image: string | null
  owned: boolean
  colors: string[]
  cost: { gold?: number, doubloons?: number, ancientCoins?: number } | null
  prerequisites: {
    commendations?: Array<{ name: string, grade: number | null }>
    factionLevels?: Record<string, number>
    legendary?: boolean
    requires?: string
  } | null
  eligibility: {
    status: 'met' | 'locked' | 'unknown'
    commendations: Array<{ name: string, requiredGrade: number, userGrade: number | null, met: boolean, maxGrade: number | null, emblemId: number | null }>
    factions: Array<{ key: string, requiredLevel: number, userLevel: number | null, met: boolean }>
  } | null
  groupOwners: Array<{ group: string, members: string[] }>
}

interface TaxonomyMap {
  categories: Record<string, Record<string, string | null>>
  subcategories: Record<string, Record<string, Record<string, string | null>>>
}

// La locale est passée au serveur pour résoudre les noms d'items (FR/EN/ES) ;
// useFetch refait l'appel automatiquement au changement de langue.
const { data, status, error } = await useFetch<ChestItem[]>(
  () => (isPublic.value ? '/api/chest' : '/api/my-chest'),
  { query: { locale } }
)
const { data: taxonomy } = await useFetch<TaxonomyMap>('/api/chest-taxonomy')
const { data: palette } = await useFetch<Array<{ name: string, hex: string }>>('/api/chest-colors')
const items = computed(() => data.value || [])
const isLoading = computed(() => status.value === 'pending')
// Nombre d'items que l'utilisateur possède réellement (le reste du catalogue
// vient des imports d'autres utilisateurs).
const ownedCount = computed(() => items.value.reduce((n, i) => n + (i.owned ? 1 : 0), 0))

// --- Modale de zoom : clic sur une vignette -> image en pleine résolution (1024px) ---
const selectedItem = ref<ChestItem | null>(null)
const isImageModalOpen = ref(false)
function openItem(item: ChestItem) {
  if (!item.image) return
  selectedItem.value = item
  isImageModalOpen.value = true
}

// --- Popup détail d'un emblème (depuis un prérequis de commendation) ---
const selectedEmblemId = ref<number | null>(null)
const isEmblemModalOpen = ref(false)
function openEmblem(emblemId: number) {
  selectedEmblemId.value = emblemId
  isEmblemModalOpen.value = true
}

// --- Coût de l'item (icône de devise + montant) ---
// Libellés des devises via i18n (réactifs à la locale) ; l'icône reste statique.
const CURRENCY_META: Record<string, { icon: string }> = {
  gold: { icon: '/img/currencies/gold.png' },
  doubloons: { icon: '/img/currencies/doubloons.png' },
  ancientCoins: { icon: '/img/currencies/ancient-coins.png' }
}
function currencyLabel(key: string): string {
  return t(`yourChest.currency.${key}`)
}
function costEntries(item: ChestItem): Array<{ key: string, icon: string, label: string, value: number }> {
  const cost = item.cost
  if (!cost) return []
  return (['gold', 'doubloons', 'ancientCoins'] as const)
    .filter(k => cost[k] != null)
    .map(k => ({ key: k, icon: CURRENCY_META[k]!.icon, label: currencyLabel(k), value: cost[k]! }))
}

// --- Prérequis d'obtention (depuis le wiki) ---
// Nom de faction localisé à partir de la clé courte du wiki (hoarder, merchant,
// souls, hunter, seadog, reaper, athena), via i18n (factionNames.<clé>).
function factionLabel(key: string): string {
  return t(`factionNames.${key}`)
}

// Libellé traduit (selon la locale courante) avec repli sur la clé humanisée
// (humanizeKey est auto-importé depuis app/utils)
function catLabel(category: string): string {
  return taxonomy.value?.categories?.[category]?.[locale.value] || humanizeKey(category)
}
function subLabel(category: string, sub: string | null): string {
  if (!sub) return ''
  return taxonomy.value?.subcategories?.[category]?.[sub]?.[locale.value] || humanizeKey(sub)
}

// Nombre de co-membres distincts possédant l'item (pour l'indicateur).
function groupOwnersCount(item: ChestItem): number {
  const set = new Set<string>()
  for (const g of item.groupOwners) {
    for (const m of g.members) set.add(m)
  }
  return set.size
}

// --- Filtres (synchronisés avec l'URL : liens partageables + retour arrière fidèle) ---
const router = useRouter()

// Une valeur de query peut être string | string[] | undefined selon l'URL.
function queryToString(v: unknown): string {
  if (Array.isArray(v)) return v[0] != null ? String(v[0]) : ''
  return typeof v === 'string' ? v : ''
}
function queryToArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(x => String(x).split(',')).filter(Boolean)
  return typeof v === 'string' ? v.split(',').filter(Boolean) : []
}

const ownershipFromUrl = queryToString(route.query.own)
const searchQuery = ref(queryToString(route.query.q))
const selectedCategories = ref<string[]>(queryToArray(route.query.cat))
const selectedSubcategories = ref<string[]>(queryToArray(route.query.sub))
// Deux filtres couleur : couleur principale (colors[0]) et couleurs secondaires (le reste).
const selectedPrimaryColors = ref<string[]>(queryToArray(route.query.pcolor))
const selectedSecondaryColors = ref<string[]>(queryToArray(route.query.scolor))
// Mode de combinaison des couleurs secondaires : false = OU (au moins une, défaut),
// true = ET (l'objet doit avoir toutes les couleurs sélectionnées).
const secondaryColorsMatchAll = ref(queryToString(route.query.smatch) === 'all')
// Filtre devises (coût) : or / pièces anciennes / doublons (multi-sélection, OU).
const selectedCurrencies = ref<string[]>(queryToArray(route.query.cur))
// Filtre prérequis (éligibilité) : tous / débloquables / verrouillés / avec prérequis.
type EligFilter = 'all' | 'met' | 'locked' | 'prereq'
const eligFromUrl = queryToString(route.query.elig)
const eligibilityFilter = ref<EligFilter>(
  (['met', 'locked', 'prereq'] as string[]).includes(eligFromUrl) ? eligFromUrl as EligFilter : 'all'
)
const eligibilityOptions = computed<Array<{ label: string, value: EligFilter }>>(() => [
  { label: t('yourChest.eligibility.all'), value: 'all' },
  { label: t('yourChest.eligibility.met'), value: 'met' },
  { label: t('yourChest.eligibility.locked'), value: 'locked' },
  { label: t('yourChest.eligibility.prereq'), value: 'prereq' }
])
const ownershipFilter = ref<'owned' | 'notowned' | 'all'>(
  ownershipFromUrl === 'notowned' || ownershipFromUrl === 'all' ? ownershipFromUrl : 'owned'
)

function colorLabel(name: string): string {
  return t(`chestColors.${name}`)
}

function colorHex(name: string): string {
  return (palette.value || []).find(c => c.name === name)?.hex || '#888888'
}

function toggleColor(which: 'primary' | 'secondary', name: string) {
  const list = which === 'primary' ? selectedPrimaryColors : selectedSecondaryColors
  const i = list.value.indexOf(name)
  if (i === -1) list.value.push(name)
  else list.value.splice(i, 1)
}

// Options du filtre devises (icône + libellé via CURRENCY_META) et bascule.
const CURRENCY_KEYS = ['gold', 'ancientCoins', 'doubloons'] as const
const currencyOptions = computed(() => CURRENCY_KEYS.map(k => ({ key: k as string, icon: CURRENCY_META[k]!.icon, label: currencyLabel(k) })))
function toggleCurrency(key: string) {
  const i = selectedCurrencies.value.indexOf(key)
  if (i === -1) selectedCurrencies.value.push(key)
  else selectedCurrencies.value.splice(i, 1)
}

const ownershipOptions = computed(() => [
  { label: t('yourChest.owned'), value: 'owned' },
  { label: t('yourChest.notOwned'), value: 'notowned' },
  { label: t('yourChest.allOwnership'), value: 'all' }
])

const allCategoriesSelected = computed(() => selectedCategories.value.length === 0)

// Catégories présentes (dans l'ordre renvoyé par le serveur = ordre du jeu)
const categories = computed(() => {
  const seen = new Set<string>()
  for (const it of items.value) seen.add(it.category)
  return [...seen]
})

// Sous-catégories des catégories sélectionnées, groupées par catégorie
// (affichées seulement quand au moins une catégorie est choisie).
const subcategoryGroups = computed(() => {
  if (allCategoriesSelected.value) return []
  const groups: Array<{ category: string, subcategories: string[] }> = []
  for (const cat of selectedCategories.value) {
    const seen = new Set<string>()
    for (const it of items.value) {
      if (it.category === cat && it.subcategory) seen.add(it.subcategory)
    }
    if (seen.size > 0) {
      groups.push({ category: cat, subcategories: [...seen].sort((a, b) => a.localeCompare(b)) })
    }
  }
  return groups
})

// Les sous-catégories sont identifiées par une clé composite catégorie::sous-cat
// (une même clé de sous-catégorie peut exister dans plusieurs catégories).
function subKey(category: string, sub: string): string {
  return `${category}::${sub}`
}

function clearCategories() {
  selectedCategories.value = []
  selectedSubcategories.value = []
}

function toggleCategory(cat: string) {
  const i = selectedCategories.value.indexOf(cat)
  if (i === -1) {
    // Ajout : on conserve les sous-catégories déjà sélectionnées des autres catégories.
    selectedCategories.value.push(cat)
  } else {
    // Retrait : on ne purge que les sous-catégories de cette catégorie.
    selectedCategories.value.splice(i, 1)
    selectedSubcategories.value = selectedSubcategories.value.filter(k => !k.startsWith(`${cat}::`))
  }
}

function toggleSubcategory(key: string) {
  const i = selectedSubcategories.value.indexOf(key)
  if (i === -1) selectedSubcategories.value.push(key)
  else selectedSubcategories.value.splice(i, 1)
}

// Clic catégorie : sélection simple (remplace). Ctrl/Cmd+clic : multi-sélection (toggle).
// Re-cliquer la seule catégorie sélectionnée revient à « toutes ».
function onCategoryClick(cat: string, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    toggleCategory(cat)
    return
  }
  if (selectedCategories.value.length === 1 && selectedCategories.value[0] === cat) {
    clearCategories()
  } else {
    selectedCategories.value = [cat]
    // Ne garder que les sous-catégories appartenant à la catégorie retenue.
    selectedSubcategories.value = selectedSubcategories.value.filter(k => k.startsWith(`${cat}::`))
  }
}

// Clic sous-catégorie : sélection simple (remplace). Ctrl/Cmd+clic : multi (toggle).
// Re-cliquer la seule sous-catégorie sélectionnée revient à « toutes ».
function onSubcategoryClick(key: string, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    toggleSubcategory(key)
    return
  }
  if (selectedSubcategories.value.length === 1 && selectedSubcategories.value[0] === key) {
    selectedSubcategories.value = []
  } else {
    selectedSubcategories.value = [key]
  }
}

const filteredItems = computed(() => {
  let list = items.value
  // Filtres liés à l'utilisateur : ignorés en mode public.
  if (!isPublic.value && ownershipFilter.value === 'owned') {
    list = list.filter(i => i.owned)
  } else if (!isPublic.value && ownershipFilter.value === 'notowned') {
    list = list.filter(i => !i.owned)
  }
  if (selectedCategories.value.length) {
    list = list.filter(i => selectedCategories.value.includes(i.category))
  }
  if (selectedSubcategories.value.length) {
    list = list.filter(i => !!i.subcategory && selectedSubcategories.value.includes(subKey(i.category, i.subcategory)))
  }
  if (selectedPrimaryColors.value.length) {
    list = list.filter(i => i.colors.length > 0 && selectedPrimaryColors.value.includes(i.colors[0]!))
  }
  if (selectedSecondaryColors.value.length) {
    const sel = selectedSecondaryColors.value
    list = secondaryColorsMatchAll.value
      ? list.filter(i => sel.every(c => i.colors.slice(1).includes(c))) // ET : toutes présentes
      : list.filter(i => i.colors.slice(1).some(c => sel.includes(c))) // OU : au moins une
  }
  if (selectedCurrencies.value.length) {
    // OU : l'item a un coût dans au moins une des devises sélectionnées.
    list = list.filter(i => !!i.cost && selectedCurrencies.value.some(c => (i.cost as Record<string, number | undefined>)[c] != null))
  }
  if (!isPublic.value && eligibilityFilter.value !== 'all') {
    list = eligibilityFilter.value === 'prereq'
      ? list.filter(i => i.eligibility != null)
      : list.filter(i => i.eligibility?.status === eligibilityFilter.value)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(i =>
      i.name.toLowerCase().includes(q)
      || (i.description || '').toLowerCase().includes(q)
    )
  }
  return list
})

// --- Pagination ---
const pageSize = 60
const currentPage = ref(Math.max(1, Number.parseInt(queryToString(route.query.page), 10) || 1))
// Conteneur de la grille : on y revient en haut au changement de page.
const gridRef = ref<HTMLElement | null>(null)
const totalPages = computed(() => Math.ceil(filteredItems.value.length / pageSize))
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredItems.value.slice(start, start + pageSize)
})

watch(
  [
    searchQuery,
    ownershipFilter,
    () => selectedCategories.value.join(','),
    () => selectedSubcategories.value.join(','),
    () => selectedPrimaryColors.value.join(','),
    () => selectedSecondaryColors.value.join(','),
    secondaryColorsMatchAll,
    () => selectedCurrencies.value.join(','),
    eligibilityFilter
  ],
  () => {
    currentPage.value = 1
  }
)
watch(totalPages, (newTotal) => {
  if (currentPage.value > newTotal && newTotal > 0) currentPage.value = newTotal
}, { immediate: true })

// Changement de page (pagination ou reset de filtre) -> revenir en haut de la liste.
watch(currentPage, () => {
  if (!import.meta.client) return
  nextTick(() => gridRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
})

// Reflète filtres + page dans l'URL. `replace` : pas d'entrée d'historique à chaque
// frappe. Les valeurs par défaut (possession « owned », page 1, filtres vides) sont
// omises pour garder l'URL propre.
function syncUrl() {
  const query: Record<string, string> = {}
  if (searchQuery.value.trim()) query.q = searchQuery.value
  if (ownershipFilter.value !== 'owned') query.own = ownershipFilter.value
  if (selectedCategories.value.length) query.cat = selectedCategories.value.join(',')
  if (selectedSubcategories.value.length) query.sub = selectedSubcategories.value.join(',')
  if (selectedPrimaryColors.value.length) query.pcolor = selectedPrimaryColors.value.join(',')
  if (selectedSecondaryColors.value.length) query.scolor = selectedSecondaryColors.value.join(',')
  if (secondaryColorsMatchAll.value) query.smatch = 'all'
  if (selectedCurrencies.value.length) query.cur = selectedCurrencies.value.join(',')
  if (eligibilityFilter.value !== 'all') query.elig = eligibilityFilter.value
  if (currentPage.value > 1) query.page = String(currentPage.value)
  router.replace({ query })
}

watch(
  [
    searchQuery,
    ownershipFilter,
    currentPage,
    () => selectedCategories.value.join(','),
    () => selectedSubcategories.value.join(','),
    () => selectedPrimaryColors.value.join(','),
    () => selectedSecondaryColors.value.join(','),
    secondaryColorsMatchAll,
    () => selectedCurrencies.value.join(','),
    eligibilityFilter
  ],
  () => syncUrl()
)
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
      <div class="mb-6">
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
            {{ isPublic ? $t('yourChest.publicTitle') : $t('yourChest.title') }}
          </h1>
        </div>
        <p class="text-muted">
          {{ $t('yourChest.subtitle') }}
        </p>
      </div>

      <!-- Erreur de chargement -->
      <div
        v-if="error"
        class="text-center py-16"
      >
        <UIcon
          name="i-lucide-alert-triangle"
          class="w-16 h-16 text-error mx-auto mb-4"
        />
        <h2 class="text-xl font-semibold mb-2">
          {{ $t('common.error') }}
        </h2>
        <p class="text-muted">
          {{ $t('yourChest.loadError') }}
        </p>
      </div>

      <!-- Aucun item importé (l'utilisateur ne possède rien) — masqué en mode public -->
      <div
        v-else-if="!isPublic && ownedCount === 0"
        class="text-center py-16"
      >
        <UIcon
          name="i-lucide-package-open"
          class="w-16 h-16 text-muted mx-auto mb-4"
        />
        <h2 class="text-xl font-semibold mb-2">
          {{ $t('yourChest.noData') }}
        </h2>
        <p class="text-muted mb-4">
          {{ $t('yourChest.noDataDescription') }}
        </p>
        <UButton
          to="/tutoriel"
          icon="i-lucide-book-open"
          :label="$t('nav.tutorial')"
        />
      </div>

      <template v-else>
        <!-- Recherche + possession + compteur -->
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            :placeholder="$t('yourChest.searchPlaceholder')"
            class="w-full sm:w-72"
          />
          <USelectMenu
            v-if="!isPublic"
            v-model="ownershipFilter"
            :items="ownershipOptions"
            value-key="value"
            class="w-full sm:w-48"
          />
          <span class="text-sm text-muted ml-auto">
            {{ $t('yourChest.itemsCount', { count: filteredItems.length }) }}
          </span>
        </div>

        <!-- Filtres (en ligne sur desktop, dans une modale sur mobile) -->
        <FilterPanel>
          <!-- Filtre catégories (multi-sélection) -->
          <div class="flex flex-wrap gap-2 mb-3">
            <UButton
              :color="allCategoriesSelected ? 'primary' : 'neutral'"
              :variant="allCategoriesSelected ? 'solid' : 'outline'"
              size="sm"
              @click="clearCategories"
            >
              {{ $t('yourChest.allCategories') }}
            </UButton>
            <UButton
              v-for="cat in categories"
              :key="cat"
              :color="selectedCategories.includes(cat) ? 'primary' : 'neutral'"
              :variant="selectedCategories.includes(cat) ? 'solid' : 'outline'"
              size="sm"
              :title="$t('yourChest.filterMultiSelectHint')"
              @click="onCategoryClick(cat, $event)"
            >
              {{ catLabel(cat) }}
            </UButton>
          </div>

          <!-- Filtre sous-catégories (des catégories sélectionnées) -->
          <template v-if="subcategoryGroups.length > 0">
            <div
              v-for="group in subcategoryGroups"
              :key="group.category"
              class="flex items-center gap-2 flex-wrap mb-2"
            >
              <span class="text-sm font-medium text-muted">{{ catLabel(group.category) }} :</span>
              <UButton
                v-for="sub in group.subcategories"
                :key="sub"
                :color="selectedSubcategories.includes(subKey(group.category, sub)) ? 'info' : 'neutral'"
                :variant="selectedSubcategories.includes(subKey(group.category, sub)) ? 'solid' : 'outline'"
                size="sm"
                :title="$t('yourChest.filterMultiSelectHint')"
                @click="onSubcategoryClick(subKey(group.category, sub), $event)"
              >
                {{ subLabel(group.category, sub) }}
              </UButton>
            </div>
          </template>

          <!-- Filtre couleur principale (colors[0]) -->
          <div
            v-if="(palette || []).length"
            class="flex items-center gap-2 flex-wrap mb-2"
          >
            <span class="text-sm font-medium text-muted">{{ $t('yourChest.primaryColor') }} :</span>
            <UButton
              v-for="c in (palette || [])"
              :key="c.name"
              :color="selectedPrimaryColors.includes(c.name) ? 'primary' : 'neutral'"
              :variant="selectedPrimaryColors.includes(c.name) ? 'solid' : 'outline'"
              size="sm"
              @click="toggleColor('primary', c.name)"
            >
              <span
                class="inline-block w-3 h-3 rounded-full border border-muted/40"
                :style="{ backgroundColor: c.hex }"
              />
              {{ colorLabel(c.name) }}
            </UButton>
          </div>

          <!-- Filtre couleurs secondaires (colors[1..]) -->
          <div
            v-if="(palette || []).length"
            class="flex items-center gap-2 flex-wrap mb-3"
          >
            <span class="text-sm font-medium text-muted">{{ $t('yourChest.secondaryColors') }} :</span>
            <label
              class="flex items-center gap-1.5 cursor-pointer"
              :title="$t('yourChest.secondaryColorsMatchAllTooltip')"
            >
              <USwitch
                v-model="secondaryColorsMatchAll"
                size="sm"
              />
              <span class="text-sm text-muted">{{ $t('yourChest.secondaryColorsMatchAll') }}</span>
            </label>
            <UButton
              v-for="c in (palette || [])"
              :key="c.name"
              :color="selectedSecondaryColors.includes(c.name) ? 'info' : 'neutral'"
              :variant="selectedSecondaryColors.includes(c.name) ? 'solid' : 'outline'"
              size="sm"
              @click="toggleColor('secondary', c.name)"
            >
              <span
                class="inline-block w-3 h-3 rounded-full border border-muted/40"
                :style="{ backgroundColor: c.hex }"
              />
              {{ colorLabel(c.name) }}
            </UButton>
          </div>

          <!-- Filtre devises (coût) -->
          <div class="flex items-center gap-2 flex-wrap mb-3">
            <span class="text-sm font-medium text-muted">{{ $t('yourChest.currencies') }} :</span>
            <UButton
              v-for="cur in currencyOptions"
              :key="cur.key"
              :color="selectedCurrencies.includes(cur.key) ? 'primary' : 'neutral'"
              :variant="selectedCurrencies.includes(cur.key) ? 'solid' : 'outline'"
              size="sm"
              @click="toggleCurrency(cur.key)"
            >
              <img
                :src="cur.icon"
                :alt="cur.label"
                class="w-4 h-4"
              >
              {{ cur.label }}
            </UButton>
          </div>

          <!-- Filtre prérequis (éligibilité) — masqué en public -->
          <div
            v-if="!isPublic"
            class="flex items-center gap-2 flex-wrap mb-3"
          >
            <span class="text-sm font-medium text-muted">{{ $t('yourChest.prerequisitesTitle') }} :</span>
            <UButton
              v-for="opt in eligibilityOptions"
              :key="opt.value"
              :label="opt.label"
              size="sm"
              :color="eligibilityFilter === opt.value ? 'primary' : 'neutral'"
              :variant="eligibilityFilter === opt.value ? 'solid' : 'outline'"
              @click="eligibilityFilter = opt.value"
            />
          </div>
        </FilterPanel>

        <!-- Grille -->
        <div
          v-if="filteredItems.length > 0"
          ref="gridRef"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 mt-4"
          style="scroll-margin-top: calc(var(--ui-header-height) + 1rem)"
        >
          <UCard
            v-for="item in paginatedItems"
            :key="item.id"
            :ui="{ body: 'p-0 sm:p-0' }"
            class="overflow-hidden"
          >
            <div
              class="relative aspect-square bg-muted/20 flex items-center justify-center overflow-hidden"
              :class="item.image ? 'cursor-pointer' : ''"
              @click="openItem(item)"
            >
              <NuxtImg
                v-if="item.image"
                :src="item.image"
                :alt="item.name"
                width="200"
                height="200"
                densities="x1 x2"
                format="webp"
                loading="lazy"
                class="w-full h-full object-cover transition-opacity hover:opacity-90"
              />
              <UIcon
                v-else
                name="i-lucide-image-off"
                class="w-8 h-8 text-muted"
              />
              <UBadge
                v-if="!isPublic && !item.owned"
                color="error"
                variant="solid"
                size="xs"
                class="absolute top-1 right-1"
              >
                {{ $t('yourChest.notOwnedBadge') }}
              </UBadge>
              <!-- Indicateur « a des prérequis » (haut-gauche) : statut si non possédé. -->
              <UBadge
                v-if="item.eligibility"
                :color="!item.owned && item.eligibility.status === 'locked' ? 'warning' : (!item.owned && item.eligibility.status === 'met' ? 'success' : 'neutral')"
                variant="solid"
                size="xs"
                class="absolute top-1 left-1"
                :title="!item.owned && item.eligibility.status === 'locked' ? $t('yourChest.eligibilityBadge.locked') : (!item.owned && item.eligibility.status === 'met' ? $t('yourChest.eligibilityBadge.met') : $t('yourChest.eligibilityBadge.prereq'))"
              >
                <UIcon
                  :name="!item.owned && item.eligibility.status === 'locked' ? 'i-lucide-lock' : (!item.owned && item.eligibility.status === 'met' ? 'i-lucide-lock-open' : 'i-lucide-scroll-text')"
                  class="w-3 h-3"
                />
              </UBadge>
              <UBadge
                v-if="item.groupOwners.length"
                color="primary"
                variant="solid"
                size="xs"
                class="absolute bottom-1 left-1 flex items-center gap-0.5"
              >
                <UIcon
                  name="i-lucide-users"
                  class="w-3 h-3"
                />
                {{ groupOwnersCount(item) }}
              </UBadge>
              <!-- Coût (bas-droite) : montant + icône de devise, si renseigné -->
              <div
                v-if="costEntries(item).length"
                class="absolute bottom-1 right-1 flex flex-col items-end gap-0.5"
              >
                <span
                  v-for="c in costEntries(item)"
                  :key="c.key"
                  class="inline-flex items-center gap-0.5 rounded bg-black/65 text-white px-1 py-0.5 text-xs font-medium leading-none"
                  :title="c.label"
                >
                  {{ c.value.toLocaleString(locale) }}
                  <img
                    :src="c.icon"
                    :alt="c.label"
                    class="w-3.5 h-3.5"
                  >
                </span>
              </div>
            </div>
            <div class="p-2">
              <p
                class="text-sm font-medium leading-tight line-clamp-2"
                :title="item.name"
              >
                {{ item.name }}
              </p>
              <p
                v-if="item.subcategory"
                class="text-xs text-muted mt-1"
              >
                {{ subLabel(item.category, item.subcategory) }}
              </p>
              <div
                v-if="item.colors.length"
                class="flex items-center gap-1 mt-1.5"
              >
                <span
                  v-for="col in item.colors"
                  :key="col"
                  class="inline-block w-3 h-3 rounded-full border border-muted/40"
                  :style="{ backgroundColor: colorHex(col) }"
                  :title="colorLabel(col)"
                />
              </div>
            </div>
          </UCard>
        </div>

        <!-- Aucun résultat -->
        <div
          v-else
          class="text-center py-12 text-muted"
        >
          {{ $t('yourChest.noResults') }}
        </div>

        <!-- Pagination (overflow-x-auto + peu de voisins : pas de débordement mobile) -->
        <div
          v-if="totalPages > 1"
          class="mt-6 flex justify-center max-w-full overflow-x-auto"
        >
          <UPagination
            v-model:page="currentPage"
            :total="filteredItems.length"
            :items-per-page="pageSize"
            :sibling-count="1"
            size="sm"
            show-edges
          />
        </div>
      </template>
    </template>

    <!-- Modale de zoom : image en pleine résolution 1024px, optimisée WebP par IPX -->
    <UModal
      v-model:open="isImageModalOpen"
      :title="selectedItem?.name"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #content>
        <div class="p-4 flex flex-col items-center max-h-[85vh] overflow-y-auto">
          <NuxtImg
            v-if="selectedItem?.image"
            :src="selectedItem.image"
            :alt="selectedItem.name"
            width="1024"
            height="1024"
            format="webp"
            :quality="90"
            class="max-w-full max-h-[45vh] sm:max-h-[60vh] object-contain"
          />
          <p class="mt-4 text-lg font-medium text-center">
            {{ selectedItem?.name }}
          </p>
          <p
            v-if="selectedItem?.subcategory"
            class="text-sm text-muted text-center"
          >
            {{ selectedItem ? subLabel(selectedItem.category, selectedItem.subcategory) : '' }}
          </p>
          <p
            v-if="selectedItem?.description"
            class="mt-2 text-sm text-muted text-center max-w-md"
          >
            {{ selectedItem.description }}
          </p>
          <div
            v-if="selectedItem?.colors.length"
            class="flex items-center gap-1.5 mt-3"
          >
            <span
              v-for="col in selectedItem.colors"
              :key="col"
              class="inline-block w-4 h-4 rounded-full border border-muted/40"
              :style="{ backgroundColor: colorHex(col) }"
              :title="colorLabel(col)"
            />
          </div>
          <div
            v-if="selectedItem && costEntries(selectedItem).length"
            class="flex items-center gap-3 mt-3"
          >
            <span
              v-for="c in costEntries(selectedItem)"
              :key="c.key"
              class="inline-flex items-center gap-1 text-sm font-medium"
              :title="c.label"
            >
              {{ c.value.toLocaleString(locale) }}
              <img
                :src="c.icon"
                :alt="c.label"
                class="w-4 h-4"
              >
            </span>
          </div>

          <!-- Prérequis d'obtention (depuis le wiki) -->
          <div
            v-if="selectedItem?.prerequisites"
            class="mt-4 w-full max-w-md text-sm border-t border-muted/20 pt-3"
          >
            <div class="flex items-center gap-2 mb-1.5">
              <UIcon
                name="i-lucide-list-checks"
                class="w-4 h-4 text-muted"
              />
              <span class="font-medium">{{ $t('yourChest.prerequisitesTitle') }}</span>
              <UBadge
                v-if="selectedItem.owned"
                color="primary"
                variant="subtle"
                size="xs"
              >
                {{ $t('yourChest.prereqStatus.owned') }}
              </UBadge>
              <UBadge
                v-else-if="selectedItem.eligibility?.status === 'met'"
                color="success"
                variant="subtle"
                size="xs"
              >
                {{ $t('yourChest.prereqStatus.met') }}
              </UBadge>
              <UBadge
                v-else-if="selectedItem.eligibility?.status === 'locked'"
                color="warning"
                variant="subtle"
                size="xs"
              >
                {{ $t('yourChest.prereqStatus.locked') }}
              </UBadge>
            </div>
            <ul class="space-y-1">
              <li
                v-for="c in (selectedItem.eligibility?.commendations || [])"
                :key="c.name"
                class="flex items-start gap-2"
              >
                <UIcon
                  :name="isPublic ? 'i-lucide-award' : (c.met ? 'i-lucide-circle-check' : (c.userGrade === null ? 'i-lucide-circle-help' : 'i-lucide-circle-x'))"
                  :class="isPublic ? 'text-muted' : (c.met ? 'text-success' : (c.userGrade === null ? 'text-muted' : 'text-warning'))"
                  class="w-4 h-4 shrink-0 mt-0.5"
                />
                <span>
                  {{ $t('yourChest.prereqCommendationLabel') }}
                  <button
                    v-if="c.emblemId"
                    type="button"
                    class="font-medium underline decoration-dotted hover:text-primary"
                    @click="openEmblem(c.emblemId)"
                  >{{ c.name }}</button>
                  <span
                    v-else
                    class="font-medium"
                  >{{ c.name }}</span>
                  <!-- Grade affiché seulement pour les emblèmes multi-grades ; un emblème
                       binaire (max_grade <= 1) demande juste d'être complété. -->
                  <template v-if="c.maxGrade == null || c.maxGrade > 1">
                    — {{ $t('yourChest.gradeLabel', { grade: c.requiredGrade }) }}
                    <span
                      v-if="!isPublic"
                      class="text-muted"
                    >{{ $t('yourChest.prereqYou', { value: c.userGrade === null ? '?' : c.userGrade }) }}</span>
                  </template>
                </span>
              </li>
              <li
                v-for="f in (selectedItem.eligibility?.factions || [])"
                :key="f.key"
                class="flex items-start gap-2"
              >
                <UIcon
                  :name="isPublic ? 'i-lucide-flag' : (f.met ? 'i-lucide-circle-check' : (f.userLevel === null ? 'i-lucide-flag' : 'i-lucide-circle-x'))"
                  :class="isPublic ? 'text-muted' : (f.met ? 'text-success' : (f.userLevel === null ? 'text-muted' : 'text-warning'))"
                  class="w-4 h-4 shrink-0 mt-0.5"
                />
                <span>
                  {{ $t('yourChest.prereqReputationLabel') }} <span class="font-medium">{{ factionLabel(f.key) }}</span> ≥ {{ f.requiredLevel }}
                  <span
                    v-if="!isPublic"
                    class="text-muted"
                  >{{ $t('yourChest.prereqYou', { value: f.userLevel === null ? '?' : f.userLevel }) }}</span>
                </span>
              </li>
              <li
                v-if="selectedItem.prerequisites.legendary"
                class="flex items-start gap-2 text-muted"
              >
                <UIcon
                  name="i-lucide-crown"
                  class="w-4 h-4 shrink-0 mt-0.5"
                />
                <span>{{ $t('yourChest.prereqLegendary') }}</span>
              </li>
              <li
                v-if="selectedItem.prerequisites.requires"
                class="flex items-start gap-2 text-muted"
              >
                <UIcon
                  name="i-lucide-info"
                  class="w-4 h-4 shrink-0 mt-0.5"
                />
                <span>{{ selectedItem.prerequisites.requires }}</span>
              </li>
              <li
                v-if="!isPublic && (selectedItem.eligibility?.factions || []).some(f => f.userLevel === null)"
                class="flex items-start gap-2 text-xs text-muted italic"
              >
                <UIcon
                  name="i-lucide-refresh-cw"
                  class="w-3.5 h-3.5 shrink-0 mt-0.5"
                />
                <span>{{ $t('yourChest.prereqReimport') }}</span>
              </li>
            </ul>
          </div>

          <!-- Co-membres qui possèdent aussi cet item (déplacé du survol). -->
          <div
            v-if="selectedItem?.groupOwners.length"
            class="mt-4 w-full max-w-md text-sm border-t border-muted/20 pt-3"
          >
            <div class="flex items-center gap-2 mb-1.5">
              <UIcon
                name="i-lucide-users"
                class="w-4 h-4 text-muted"
              />
              <span class="font-medium">{{ $t('yourChest.alsoOwnedBy') }}</span>
            </div>
            <ul class="space-y-0.5 text-muted">
              <li
                v-for="g in selectedItem.groupOwners"
                :key="g.group"
              >
                <span class="font-medium">{{ g.group }}</span> : {{ g.members.join(', ') }}
              </li>
            </ul>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Popup détail d'un emblème (prérequis de commendation) -->
    <EmblemDetailModal
      v-model:open="isEmblemModalOpen"
      :emblem-id="selectedEmblemId"
    />
  </UContainer>
</template>
