<script setup lang="ts">
const { t } = useI18n()
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
}

const { data, status, error } = await useFetch<ChestItem[]>('/api/my-chest')
const items = computed(() => data.value || [])
const isLoading = computed(() => status.value === 'pending')

// "ShipDecoration" -> "Ship Decoration", "FlintlockDoubleBarrel" -> "Flintlock Double Barrel"
function humanizeKey(key: string | null): string {
  if (!key) return ''
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').trim()
}

// --- Filtres ---
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const selectedSubcategory = ref<string | null>(null)

// Catégories présentes (dans l'ordre renvoyé par le serveur = ordre du jeu)
const categories = computed(() => {
  const seen = new Set<string>()
  for (const it of items.value) seen.add(it.category)
  return [...seen]
})

// Sous-catégories de la catégorie sélectionnée (ou toutes)
const subcategories = computed(() => {
  const seen = new Set<string>()
  for (const it of items.value) {
    if (selectedCategory.value && it.category !== selectedCategory.value) continue
    if (it.subcategory) seen.add(it.subcategory)
  }
  return [...seen]
})

const categoryOptions = computed(() => [
  { label: t('yourChest.allCategories'), value: null },
  ...categories.value.map(c => ({ label: humanizeKey(c), value: c }))
])

const subcategoryOptions = computed(() => [
  { label: t('yourChest.allSubcategories'), value: null },
  ...subcategories.value.map(s => ({ label: humanizeKey(s), value: s }))
])

// Réinitialiser la sous-catégorie quand la catégorie change
watch(selectedCategory, () => {
  selectedSubcategory.value = null
})

const filteredItems = computed(() => {
  let list = items.value
  if (selectedCategory.value) {
    list = list.filter(i => i.category === selectedCategory.value)
  }
  if (selectedSubcategory.value) {
    list = list.filter(i => i.subcategory === selectedSubcategory.value)
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

watch([searchQuery, selectedCategory, selectedSubcategory], () => {
  currentPage.value = 1
})
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

      <!-- Aucun item importé -->
      <div
        v-else-if="items.length === 0"
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
        <!-- Filtres -->
        <div class="flex flex-wrap items-center gap-3 mb-6">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            :placeholder="$t('yourChest.searchPlaceholder')"
            class="w-full sm:w-72"
          />
          <USelectMenu
            v-model="selectedCategory"
            :items="categoryOptions"
            value-key="value"
            class="w-full sm:w-56"
          />
          <USelectMenu
            v-model="selectedSubcategory"
            :items="subcategoryOptions"
            value-key="value"
            :disabled="subcategories.length === 0"
            class="w-full sm:w-56"
          />
          <span class="text-sm text-muted ml-auto">
            {{ $t('yourChest.itemsCount', { count: filteredItems.length }) }}
          </span>
        </div>

        <!-- Grille -->
        <div
          v-if="filteredItems.length > 0"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
        >
          <UCard
            v-for="item in paginatedItems"
            :key="item.id"
            :ui="{ body: 'p-0 sm:p-0' }"
            class="overflow-hidden"
          >
            <div class="aspect-square bg-muted/20 flex items-center justify-center overflow-hidden">
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
                {{ humanizeKey(item.subcategory) }}
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
