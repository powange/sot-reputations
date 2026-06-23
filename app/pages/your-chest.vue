<script setup lang="ts">
const { t, locale } = useI18n()
const { isAuthenticated, saveRedirectUrl } = useAuth()

useSeoMeta({
  title: () => `${t('yourChest.title')} - SoT Reputations`
})

// Rediriger si non connecté (en sauvegardant l'URL pour y revenir après connexion)
if (!isAuthenticated.value) {
  saveRedirectUrl()
  navigateTo('/')
}

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
  groupOwners: Array<{ group: string, members: string[] }>
}

interface TaxonomyMap {
  categories: Record<string, Record<string, string | null>>
  subcategories: Record<string, Record<string, Record<string, string | null>>>
}

// La locale est passée au serveur pour résoudre les noms d'items (FR/EN/ES) ;
// useFetch refait l'appel automatiquement au changement de langue.
const { data, status, error } = await useFetch<ChestItem[]>('/api/my-chest', {
  query: { locale }
})
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

// --- Coût de l'item (icône de devise + montant) ---
const CURRENCY_META: Record<string, { icon: string, label: string }> = {
  gold: { icon: '/img/currencies/gold.png', label: 'Or' },
  doubloons: { icon: '/img/currencies/doubloons.png', label: 'Doublons' },
  ancientCoins: { icon: '/img/currencies/ancient-coins.png', label: 'Pièces anciennes' }
}
function costEntries(item: ChestItem): Array<{ key: string, icon: string, label: string, value: number }> {
  const cost = item.cost
  if (!cost) return []
  return (['gold', 'doubloons', 'ancientCoins'] as const)
    .filter(k => cost[k] != null)
    .map(k => ({ key: k, icon: CURRENCY_META[k]!.icon, label: CURRENCY_META[k]!.label, value: cost[k]! }))
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

// Infobulle au survol : co-membres possédant aussi l'item, regroupés par groupe.
function groupOwnersText(item: ChestItem): string {
  if (!item.groupOwners.length) return ''
  const lines = item.groupOwners.map(g => `${g.group} : ${g.members.join(', ')}`)
  return `${t('yourChest.alsoOwnedBy')} :\n${lines.join('\n')}`
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
const route = useRoute()
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

const filteredItems = computed(() => {
  let list = items.value
  if (ownershipFilter.value === 'owned') {
    list = list.filter(i => i.owned)
  } else if (ownershipFilter.value === 'notowned') {
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
    secondaryColorsMatchAll
  ],
  () => {
    currentPage.value = 1
  }
)
watch(totalPages, (newTotal) => {
  if (currentPage.value > newTotal && newTotal > 0) currentPage.value = newTotal
}, { immediate: true })

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
    secondaryColorsMatchAll
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
            {{ $t('yourChest.title') }}
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

      <!-- Aucun item importé (l'utilisateur ne possède rien) -->
      <div
        v-else-if="ownedCount === 0"
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
            v-model="ownershipFilter"
            :items="ownershipOptions"
            value-key="value"
            class="w-full sm:w-48"
          />
          <span class="text-sm text-muted ml-auto">
            {{ $t('yourChest.itemsCount', { count: filteredItems.length }) }}
          </span>
        </div>

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
            @click="toggleCategory(cat)"
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
              @click="toggleSubcategory(subKey(group.category, sub))"
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

        <!-- Grille -->
        <div
          v-if="filteredItems.length > 0"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4"
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
              :title="groupOwnersText(item)"
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
                v-if="!item.owned"
                color="error"
                variant="solid"
                size="xs"
                class="absolute top-1 right-1"
              >
                {{ $t('yourChest.notOwnedBadge') }}
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
                  {{ c.value.toLocaleString('fr-FR') }}
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

        <!-- Pagination -->
        <div
          v-if="totalPages > 1"
          class="flex justify-center mt-6"
        >
          <UPagination
            v-model:page="currentPage"
            :total="filteredItems.length"
            :items-per-page="pageSize"
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
        <div class="p-4 flex flex-col items-center">
          <NuxtImg
            v-if="selectedItem?.image"
            :src="selectedItem.image"
            :alt="selectedItem.name"
            width="1024"
            height="1024"
            format="webp"
            :quality="90"
            class="max-w-full max-h-[70vh] object-contain"
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
              {{ c.value.toLocaleString('fr-FR') }}
              <img
                :src="c.icon"
                :alt="c.label"
                class="w-4 h-4"
              >
            </span>
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
