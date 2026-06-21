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
}

interface TaxonomyMap {
  categories: Record<string, Record<string, string | null>>
  subcategories: Record<string, Record<string, Record<string, string | null>>>
}

const { data, status, error } = await useFetch<ChestItem[]>('/api/my-chest')
const { data: taxonomy } = await useFetch<TaxonomyMap>('/api/chest-taxonomy')
const items = computed(() => data.value || [])
const isLoading = computed(() => status.value === 'pending')
// Nombre d'items que l'utilisateur possède réellement (le reste du catalogue
// vient des imports d'autres utilisateurs).
const ownedCount = computed(() => items.value.reduce((n, i) => n + (i.owned ? 1 : 0), 0))

// Libellé traduit (selon la locale courante) avec repli sur la clé humanisée
// (humanizeKey est auto-importé depuis app/utils)
function catLabel(category: string): string {
  return taxonomy.value?.categories?.[category]?.[locale.value] || humanizeKey(category)
}
function subLabel(category: string, sub: string | null): string {
  if (!sub) return ''
  return taxonomy.value?.subcategories?.[category]?.[sub]?.[locale.value] || humanizeKey(sub)
}

// --- Filtres ---
const searchQuery = ref('')
const selectedCategories = ref<string[]>([])
const selectedSubcategories = ref<string[]>([])
const ownershipFilter = ref<'owned' | 'notowned' | 'all'>('owned')

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
const currentPage = ref(1)
const totalPages = computed(() => Math.ceil(filteredItems.value.length / pageSize))
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredItems.value.slice(start, start + pageSize)
})

watch(
  [searchQuery, ownershipFilter, () => selectedCategories.value.join(','), () => selectedSubcategories.value.join(',')],
  () => {
    currentPage.value = 1
  }
)
watch(totalPages, (newTotal) => {
  if (currentPage.value > newTotal && newTotal > 0) currentPage.value = newTotal
})
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
            <div class="relative aspect-square bg-muted/20 flex items-center justify-center overflow-hidden">
              <img
                v-if="item.image"
                :src="item.image"
                :alt="item.name"
                loading="lazy"
                class="w-full h-full object-cover"
              >
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
  </UContainer>
</template>
