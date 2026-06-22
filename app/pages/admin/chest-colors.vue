<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Couleurs du coffre - Administration'
})

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

interface ColorStatus { analyzed: number, total: number, remaining: number }
interface AnalyzeResult extends ColorStatus { processed: number, failed: number }

const { data: initialStatus } = await useFetch<ColorStatus>('/api/admin/chest-colors/status')
const { data: palette } = await useFetch<Array<{ name: string, hex: string }>>('/api/chest-colors')

const status = ref<ColorStatus>(initialStatus.value || { analyzed: 0, total: 0, remaining: 0 })
const analyzing = ref(false)
const stopRequested = ref(false)
const reclassifying = ref(false)

const progressPct = computed(() =>
  status.value.total > 0 ? Math.round((status.value.analyzed / status.value.total) * 100) : 0
)

// Boucle de lots jusqu'à épuisement (l'UI rappelle l'endpoint jusqu'à remaining === 0).
async function runAnalyzeLoop() {
  while (!stopRequested.value) {
    const res = await $fetch<AnalyzeResult>('/api/admin/chest-colors/analyze', { method: 'POST' })
    status.value = { analyzed: res.analyzed, total: res.total, remaining: res.remaining }
    // Fin si plus rien à traiter, ou si un lot n'a rien avancé (évite une boucle infinie).
    if (res.remaining <= 0 || (res.processed === 0 && res.failed === 0)) break
  }
}

async function analyzeAll() {
  analyzing.value = true
  stopRequested.value = false
  try {
    await runAnalyzeLoop()
    toast.add({ title: 'Analyse des couleurs terminée', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur pendant l\'analyse', color: 'error' })
  } finally {
    analyzing.value = false
  }
}

// Ré-extraction complète : remet toutes les couleurs à zéro puis relance l'analyse.
// À utiliser après un changement de l'algorithme d'extraction (re-télécharge tout).
async function reanalyzeAll() {
  if (!confirm('Ré-analyser TOUS les items ? Toutes les images seront re-téléchargées et ré-analysées.')) return
  analyzing.value = true
  stopRequested.value = false
  try {
    const res = await $fetch<AnalyzeResult & { reset: number }>('/api/admin/chest-colors/reset', { method: 'POST' })
    status.value = { analyzed: res.analyzed, total: res.total, remaining: res.remaining }
    await runAnalyzeLoop()
    toast.add({ title: 'Ré-analyse des couleurs terminée', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur pendant la ré-analyse', color: 'error' })
  } finally {
    analyzing.value = false
  }
}

function stopAnalyze() {
  stopRequested.value = true
}

async function reclassify() {
  reclassifying.value = true
  try {
    const res = await $fetch<{ reclassified: number }>('/api/admin/chest-colors/reclassify', { method: 'POST' })
    toast.add({ title: `Re-classement terminé (${res.reclassified} items)`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur pendant le re-classement', color: 'error' })
  } finally {
    reclassifying.value = false
  }
}

// --- Ré-analyse ciblée (recherche par nom) ---
interface SearchItem { id: number, name: string, image: string | null, colors: string[] }

const search = ref('')
const searchResults = ref<SearchItem[]>([])
const searching = ref(false)
const reanalyzingId = ref<number | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

// Pastille d'affichage d'une couleur nommée (repli si absente de la palette).
function colorHex(name: string): string {
  return (palette.value || []).find(c => c.name === name)?.hex || '#888888'
}

// Recherche débattue (300 ms) pour ne pas marteler l'endpoint à chaque frappe.
watch(search, (q) => {
  clearTimeout(searchTimer)
  const query = q.trim()
  if (query.length < 2) {
    searchResults.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const res = await $fetch<{ items: SearchItem[] }>('/api/admin/chest-colors/search', { query: { q: query } })
      searchResults.value = res.items
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 300)
})

async function reanalyzeItem(item: SearchItem) {
  reanalyzingId.value = item.id
  try {
    const res = await $fetch<{ id: number, colors: string[] }>('/api/admin/chest-colors/analyze-item', {
      method: 'POST',
      body: { id: item.id }
    })
    item.colors = res.colors // reflète les nouvelles couleurs dans la liste
    toast.add({ title: `« ${item.name} » ré-analysé`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de la ré-analyse', color: 'error' })
  } finally {
    reanalyzingId.value = null
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        Couleurs du coffre
      </h1>
      <p class="text-muted mt-2">
        Analyse les images des objets pour en extraire les couleurs principales (filtre couleur sur « Mon coffre »).
      </p>
    </div>

    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Analyse
        </h2>
      </template>

      <div class="space-y-4">
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-muted">Items analysés</span>
            <span class="font-medium">{{ status.analyzed }} / {{ status.total }}</span>
          </div>
          <div class="h-2 bg-muted/30 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary transition-all"
              :style="{ width: `${progressPct}%` }"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="!analyzing"
            icon="i-lucide-palette"
            :label="status.remaining > 0 ? `Analyser (${status.remaining} restants)` : 'Tout est analysé'"
            :disabled="status.remaining <= 0"
            @click="analyzeAll"
          />
          <UButton
            v-else
            icon="i-lucide-loader-2"
            label="Arrêter"
            color="warning"
            @click="stopAnalyze"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            label="Re-classer (après modif palette)"
            color="neutral"
            variant="outline"
            :loading="reclassifying"
            :disabled="analyzing"
            @click="reclassify"
          />
          <UButton
            v-if="!analyzing"
            icon="i-lucide-rotate-ccw"
            label="Tout ré-analyser (après modif algo)"
            color="warning"
            variant="outline"
            :disabled="reclassifying"
            @click="reanalyzeAll"
          />
        </div>
        <p
          v-if="analyzing"
          class="text-sm text-muted flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="w-4 h-4 animate-spin"
          />
          Analyse en cours… ({{ status.analyzed }} / {{ status.total }})
        </p>
      </div>
    </UCard>

    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Ré-analyser un item
        </h2>
      </template>

      <div class="space-y-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Rechercher un item par nom…"
          :loading="searching"
          class="w-full"
        />
        <p
          v-if="search.trim().length >= 2 && !searching && searchResults.length === 0"
          class="text-sm text-muted"
        >
          Aucun item trouvé.
        </p>
        <ul
          v-if="searchResults.length"
          class="divide-y divide-muted/20"
        >
          <li
            v-for="item in searchResults"
            :key="item.id"
            class="flex items-center gap-3 py-2"
          >
            <img
              v-if="item.image"
              :src="item.image"
              :alt="item.name"
              loading="lazy"
              class="w-10 h-10 object-cover rounded bg-muted/20 shrink-0"
            >
            <div class="min-w-0 flex-1">
              <p
                class="text-sm font-medium truncate"
                :title="item.name"
              >
                {{ item.name }}
              </p>
              <div
                v-if="item.colors.length"
                class="flex items-center gap-1 mt-1"
              >
                <span
                  v-for="col in item.colors"
                  :key="col"
                  class="inline-block w-3 h-3 rounded-full border border-muted/40"
                  :style="{ backgroundColor: colorHex(col) }"
                  :title="col"
                />
              </div>
              <p
                v-else
                class="text-xs text-muted mt-1"
              >
                Pas encore de couleurs
              </p>
            </div>
            <UButton
              size="xs"
              icon="i-lucide-rotate-ccw"
              label="Réanalyser"
              color="primary"
              variant="outline"
              :loading="reanalyzingId === item.id"
              :disabled="reanalyzingId !== null"
              @click="reanalyzeItem(item)"
            />
          </li>
        </ul>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Palette (définie en code)
        </h2>
      </template>
      <div class="flex flex-wrap gap-3">
        <div
          v-for="c in palette || []"
          :key="c.name"
          class="flex items-center gap-2 text-sm"
        >
          <span
            class="inline-block w-5 h-5 rounded border border-muted/30"
            :style="{ backgroundColor: c.hex }"
          />
          {{ c.name }}
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
