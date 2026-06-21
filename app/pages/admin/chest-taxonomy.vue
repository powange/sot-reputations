<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Catégories du coffre - Administration'
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

interface Translations { fr?: string | null, en?: string | null, es?: string | null }
interface ApiCategory {
  category: string
  translations: Translations
  subcategories: Array<{ subcategory: string, translations: Translations }>
}

interface Label { fr: string, en: string, es: string }
interface CategoryForm {
  category: string
  label: Label
  subcategories: Array<{ subcategory: string, label: Label }>
}

const { data, status } = await useFetch<{ categories: ApiCategory[] }>('/api/admin/chest-taxonomy')

function toLabel(t: Translations): Label {
  return { fr: t.fr || '', en: t.en || '', es: t.es || '' }
}

// Formulaire éditable (ref, pas computed) : v-model mute ces objets, et on ne
// reconstruit qu'au (re)chargement des données pour ne pas écraser des éditions.
const form = ref<CategoryForm[]>([])
watch(data, (val) => {
  form.value = (val?.categories || []).map(c => ({
    category: c.category,
    label: toLabel(c.translations),
    subcategories: c.subcategories.map(s => ({ subcategory: s.subcategory, label: toLabel(s.translations) }))
  }))
}, { immediate: true })

// humanizeKey est auto-importé depuis app/utils

// Accordéon
const open = ref<Set<string>>(new Set())
function toggle(category: string) {
  if (open.value.has(category)) open.value.delete(category)
  else open.value.add(category)
  // forcer la réactivité du Set
  open.value = new Set(open.value)
}

const savingCategory = ref<string | null>(null)

async function saveCategory(cat: CategoryForm) {
  const entries = [
    { category: cat.category, subcategory: '', translations: localesOf(cat.label) },
    ...cat.subcategories.map(s => ({
      category: cat.category,
      subcategory: s.subcategory,
      translations: localesOf(s.label)
    }))
  ]
  savingCategory.value = cat.category
  try {
    await $fetch('/api/admin/chest-taxonomy', { method: 'PUT', body: { entries } })
    toast.add({ title: `Catégorie « ${humanizeKey(cat.category)} » enregistrée`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement', color: 'error' })
  } finally {
    savingCategory.value = null
  }
}

function localesOf(label: Label) {
  return [
    { locale: 'fr', name: label.fr },
    { locale: 'en', name: label.en },
    { locale: 'es', name: label.es }
  ]
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
        Catégories du coffre
      </h1>
      <p class="text-muted mt-2">
        Traduire les noms des catégories et sous-catégories d'objets du coffre (FR / EN / ES).
        À vide, la clé du jeu « humanisée » est affichée.
      </p>
    </div>

    <div
      v-if="status === 'pending'"
      class="flex justify-center py-8"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-muted"
      />
    </div>

    <div
      v-else-if="form.length > 0"
      class="space-y-4"
    >
      <UCard
        v-for="cat in form"
        :key="cat.category"
      >
        <!-- En-tête catégorie -->
        <div class="flex flex-wrap items-end gap-3">
          <button
            type="button"
            class="flex items-center gap-2 mr-2"
            @click="toggle(cat.category)"
          >
            <UIcon
              :name="open.has(cat.category) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="w-5 h-5 text-muted"
            />
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ cat.category }}
            </UBadge>
          </button>
          <UFormField
            label="FR"
            class="flex-1 min-w-32"
          >
            <UInput
              v-model="cat.label.fr"
              :placeholder="humanizeKey(cat.category)"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="EN"
            class="flex-1 min-w-32"
          >
            <UInput
              v-model="cat.label.en"
              :placeholder="humanizeKey(cat.category)"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="ES"
            class="flex-1 min-w-32"
          >
            <UInput
              v-model="cat.label.es"
              :placeholder="humanizeKey(cat.category)"
              class="w-full"
            />
          </UFormField>
          <UButton
            icon="i-lucide-save"
            label="Enregistrer"
            :loading="savingCategory === cat.category"
            @click="saveCategory(cat)"
          />
        </div>

        <!-- Sous-catégories -->
        <div
          v-if="open.has(cat.category)"
          class="mt-4 pt-4 border-t border-muted/30 space-y-2"
        >
          <p
            v-if="cat.subcategories.length === 0"
            class="text-sm text-muted"
          >
            Aucune sous-catégorie.
          </p>
          <div
            v-for="sub in cat.subcategories"
            :key="sub.subcategory"
            class="flex flex-wrap items-center gap-3"
          >
            <UBadge
              color="neutral"
              variant="outline"
              size="sm"
              class="w-40 shrink-0 justify-center"
            >
              {{ sub.subcategory }}
            </UBadge>
            <UInput
              v-model="sub.label.fr"
              :placeholder="`FR — ${humanizeKey(sub.subcategory)}`"
              class="flex-1 min-w-32"
            />
            <UInput
              v-model="sub.label.en"
              :placeholder="`EN — ${humanizeKey(sub.subcategory)}`"
              class="flex-1 min-w-32"
            />
            <UInput
              v-model="sub.label.es"
              :placeholder="`ES — ${humanizeKey(sub.subcategory)}`"
              class="flex-1 min-w-32"
            />
          </div>
        </div>
      </UCard>
    </div>

    <div
      v-else
      class="text-center py-8 text-muted"
    >
      Aucune catégorie. Les catégories apparaissent après l'import d'un coffre.
    </div>
  </UContainer>
</template>
