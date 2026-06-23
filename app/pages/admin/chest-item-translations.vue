<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Traductions des objets - Administration'
})

// Redirection si non admin/modérateur
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value) {
      saveRedirectUrl()
      navigateTo('/')
    } else if (!isAdminOrModerator.value) {
      navigateTo('/')
    }
  }
})

interface ApiItem {
  id: number
  itemKey: string
  name: string
  image: string | null
  en: string | null
  es: string | null
}
interface ItemRow {
  id: number
  itemKey: string
  name: string
  image: string | null
  en: string
  es: string
}

const q = ref('')
const results = ref<ItemRow[]>([])
const searching = ref(false)
const saving = ref(false)
const hasSearched = ref(false)

let debounce: ReturnType<typeof setTimeout> | null = null

async function runSearch() {
  const term = q.value.trim()
  if (term.length < 2) {
    results.value = []
    hasSearched.value = false
    return
  }
  searching.value = true
  try {
    const res = await $fetch<{ items: ApiItem[] }>('/api/admin/chest-item-translations', { query: { q: term } })
    results.value = res.items.map(i => ({
      id: i.id,
      itemKey: i.itemKey,
      name: i.name,
      image: i.image,
      en: i.en || '',
      es: i.es || ''
    }))
    hasSearched.value = true
  } catch {
    toast.add({ title: 'Erreur de recherche', color: 'error' })
  } finally {
    searching.value = false
  }
}

// Recherche auto (debounce) au fil de la frappe.
watch(q, () => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(runSearch, 350)
})

async function saveAll() {
  if (results.value.length === 0) return
  const entries = results.value.map(r => ({
    itemKey: r.itemKey,
    translations: [
      { locale: 'en', name: r.en },
      { locale: 'es', name: r.es }
    ]
  }))
  saving.value = true
  try {
    await $fetch('/api/admin/chest-item-translations', { method: 'PUT', body: { entries } })
    toast.add({ title: 'Traductions enregistrées', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-5xl">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        Traductions des objets
      </h1>
      <p class="text-muted mt-2">
        Corriger les traductions EN / ES des noms d'objets du coffre. Le nom FR (langue
        de base, capté à l'import) sert de référence et n'est pas modifiable ici.
      </p>
    </div>

    <!-- Recherche + sauvegarde -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <UInput
        v-model="q"
        icon="i-lucide-search"
        placeholder="Rechercher un objet par son nom (FR)…"
        class="flex-1 min-w-64"
        :loading="searching"
      />
      <UButton
        icon="i-lucide-save"
        label="Enregistrer"
        :loading="saving"
        :disabled="results.length === 0"
        @click="saveAll"
      />
    </div>

    <!-- Résultats -->
    <div
      v-if="results.length > 0"
      class="space-y-2"
    >
      <UCard
        v-for="item in results"
        :key="item.itemKey"
      >
        <div class="flex flex-wrap items-center gap-3">
          <img
            v-if="item.image"
            :src="item.image"
            :alt="item.name"
            class="w-12 h-12 rounded object-cover bg-muted/30 shrink-0"
          >
          <div
            v-else
            class="w-12 h-12 rounded bg-muted/30 shrink-0 flex items-center justify-center"
          >
            <UIcon
              name="i-lucide-image-off"
              class="w-5 h-5 text-muted"
            />
          </div>
          <div class="w-48 shrink-0">
            <span class="text-sm font-medium">{{ item.name }}</span>
            <UBadge
              color="neutral"
              variant="subtle"
              size="xs"
              class="ml-2"
            >
              FR
            </UBadge>
          </div>
          <UInput
            v-model="item.en"
            placeholder="EN"
            class="flex-1 min-w-32"
          />
          <UInput
            v-model="item.es"
            placeholder="ES"
            class="flex-1 min-w-32"
          />
        </div>
      </UCard>
    </div>

    <div
      v-else-if="searching"
      class="flex justify-center py-8"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-muted"
      />
    </div>

    <div
      v-else-if="hasSearched"
      class="text-center py-8 text-muted"
    >
      Aucun objet ne correspond à « {{ q }} ».
    </div>

    <div
      v-else
      class="text-center py-8 text-muted"
    >
      Saisissez au moins 2 caractères pour rechercher un objet.
    </div>
  </UContainer>
</template>
