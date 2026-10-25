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
  descFr: string | null
  image: string | null
  en: string | null
  es: string | null
  enDesc: string | null
  esDesc: string | null
}
interface ItemRow {
  id: number
  itemKey: string
  name: string
  descFr: string
  image: string | null
  en: string
  es: string
  enDesc: string
  esDesc: string
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
      descFr: i.descFr || '',
      image: i.image,
      en: i.en || '',
      es: i.es || '',
      enDesc: i.enDesc || '',
      esDesc: i.esDesc || ''
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
      { locale: 'en', name: r.en, description: r.enDesc },
      { locale: 'es', name: r.es, description: r.esDesc }
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

// --- Réparations en lot (aperçu puis application) ---

interface RestoreResult { updated: number, unchanged: number, unknown: number, samples: Array<{ locale: string, name: string, before: string | null, after: string }> }
interface RepairResult { count: number, samples: Array<{ name: string, before: string, after: string }> }

// Export du bookmarklet ({ chest, chestEn, chestEs, reputation }) : lu dans le navigateur,
// seuls les coffres EN / ES sont envoyés.
const exportData = ref<{ en: unknown, es: unknown } | null>(null)
const exportName = ref('')
const restorePreview = ref<RestoreResult | null>(null)
const restoring = ref(false)

async function onExportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  restorePreview.value = null
  exportData.value = null
  if (!file) return
  try {
    const json = JSON.parse(await file.text()) as { chestEn?: unknown, chestEs?: unknown }
    if (!json.chestEn && !json.chestEs) {
      toast.add({ title: 'Fichier sans coffre EN / ES', description: 'Utilisez un export du bookmarklet (chestEn / chestEs).', color: 'error' })
      return
    }
    exportData.value = { en: json.chestEn ?? null, es: json.chestEs ?? null }
    exportName.value = file.name
    await runRestore(false)
  } catch {
    toast.add({ title: 'Fichier JSON illisible', color: 'error' })
  }
}

async function runRestore(apply: boolean) {
  if (!exportData.value) return
  restoring.value = true
  try {
    const res = await $fetch<RestoreResult>('/api/admin/chest-item-translations/restore', {
      method: 'POST',
      body: { ...exportData.value, apply }
    })
    if (apply) {
      toast.add({ title: `${res.updated} traduction(s) restaurée(s)`, color: 'success' })
      restorePreview.value = null
      exportData.value = null
    } else {
      restorePreview.value = res
    }
  } catch {
    toast.add({ title: 'Erreur lors de la restauration', color: 'error' })
  } finally {
    restoring.value = false
  }
}

const trophyPreview = ref<RepairResult | null>(null)
const repairing = ref(false)

async function runTrophyRepair(apply: boolean) {
  repairing.value = true
  try {
    const res = await $fetch<RepairResult>('/api/admin/chest-item-translations/repair-trophies', {
      method: 'POST',
      body: { apply }
    })
    if (apply) {
      toast.add({ title: `${res.count} nom(s) de trophée corrigé(s)`, color: 'success' })
      trophyPreview.value = null
    } else {
      trophyPreview.value = res
    }
  } catch {
    toast.add({ title: 'Erreur lors de la correction', color: 'error' })
  } finally {
    repairing.value = false
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
        Corriger les traductions EN / ES (nom et description) des objets du coffre. Le FR
        (langue de base, capté à l'import) sert de référence et n'est pas modifiable ici.
      </p>
    </div>

    <!-- Réparations en lot -->
    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Réparer les traductions en lot
        </h2>
      </template>
      <div class="space-y-6 text-sm">
        <div class="space-y-2">
          <p class="font-medium">
            Restaurer depuis un export du bookmarklet
          </p>
          <p class="text-muted">
            Réécrit les noms et descriptions EN / ES officiels des objets <strong>déjà au catalogue</strong>
            présents dans l'export (fichier JSON du bookmarklet : coffre FR + EN + ES). Ne crée aucun
            objet, ne touche ni aux possessions ni aux réputations. Le fichier est lu dans le
            navigateur : seuls les coffres EN / ES sont envoyés.
          </p>
          <input
            type="file"
            accept=".json,application/json"
            class="text-sm"
            @change="onExportFile"
          >
          <template v-if="restorePreview">
            <p>
              <strong>{{ restorePreview.updated }}</strong> traduction(s) à restaurer ·
              {{ restorePreview.unchanged }} déjà à jour ·
              {{ restorePreview.unknown }} hors catalogue (ignorées)
              <span class="text-muted">— {{ exportName }}</span>
            </p>
            <ul
              v-if="restorePreview.samples.length"
              class="text-xs space-y-0.5"
            >
              <li
                v-for="(sm, i) in restorePreview.samples"
                :key="i"
              >
                <span class="text-muted">[{{ sm.locale }}] {{ sm.name }} :</span>
                <span class="line-through text-muted">{{ sm.before ?? '—' }}</span>
                → <span class="font-medium">{{ sm.after }}</span>
              </li>
            </ul>
            <UButton
              icon="i-lucide-check-check"
              :label="`Restaurer (${restorePreview.updated})`"
              color="success"
              size="sm"
              :loading="restoring"
              :disabled="!restorePreview.updated"
              @click="runRestore(true)"
            />
          </template>
        </div>

        <div class="space-y-2 pt-4 border-t border-muted/20">
          <p class="font-medium">
            Rétablir la qualité des trophées (EN)
          </p>
          <p class="text-muted">
            Trophées dont le nom anglais a perdu sa qualité (« Lord of Legends ») alors que le nom
            français la porte (« Superbe « Seigneurs des légendes » ») : réécrits au format du jeu
            (« Prized 'Lord of Legends' »). Couvre aussi les objets absents de votre export.
          </p>
          <UButton
            icon="i-lucide-search"
            label="Voir les trophées à corriger"
            size="sm"
            variant="soft"
            :loading="repairing && !trophyPreview"
            @click="runTrophyRepair(false)"
          />
          <template v-if="trophyPreview">
            <p><strong>{{ trophyPreview.count }}</strong> nom(s) à corriger</p>
            <ul
              v-if="trophyPreview.samples.length"
              class="text-xs space-y-0.5"
            >
              <li
                v-for="(sm, i) in trophyPreview.samples"
                :key="i"
              >
                <span class="text-muted">{{ sm.name }} :</span>
                <span class="line-through text-muted">{{ sm.before }}</span>
                → <span class="font-medium">{{ sm.after }}</span>
              </li>
            </ul>
            <UButton
              icon="i-lucide-check-check"
              :label="`Corriger (${trophyPreview.count})`"
              color="success"
              size="sm"
              :loading="repairing"
              :disabled="!trophyPreview.count"
              @click="runTrophyRepair(true)"
            />
          </template>
        </div>
      </div>
    </UCard>

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
      class="space-y-3"
    >
      <UCard
        v-for="item in results"
        :key="item.itemKey"
      >
        <div class="flex items-start gap-3">
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

          <div class="flex-1 min-w-0 space-y-3">
            <!-- Référence FR (lecture seule) -->
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ item.name }}</span>
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="xs"
                >
                  FR
                </UBadge>
              </div>
              <p
                v-if="item.descFr"
                class="text-xs text-muted mt-0.5"
              >
                {{ item.descFr }}
              </p>
            </div>

            <!-- Champs éditables EN / ES -->
            <div class="grid gap-2 sm:grid-cols-2">
              <UFormField label="EN — nom">
                <UInput
                  v-model="item.en"
                  :placeholder="item.name"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="EN — description">
                <UTextarea
                  v-model="item.enDesc"
                  :rows="2"
                  :placeholder="item.descFr || '—'"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="ES — nom">
                <UInput
                  v-model="item.es"
                  :placeholder="item.name"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="ES — description">
                <UTextarea
                  v-model="item.esDesc"
                  :rows="2"
                  :placeholder="item.descFr || '—'"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
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
