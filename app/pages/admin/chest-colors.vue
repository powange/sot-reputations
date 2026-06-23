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

// --- Signature de couleurs « décor » par sous-catégorie ---
interface Scope { category: string, subcategory: string | null, count: number, builtAt: string | null, sampleCount: number | null, binCount: number | null }
const { data: scopesData, refresh: refreshScopes } = await useFetch<{ scopes: Scope[] }>('/api/admin/chest-colors/scopes')
const scopes = computed(() => scopesData.value?.scopes || [])
const selectedScopeIdx = ref<number | undefined>()
const buildingSignature = ref(false)

const scopeOptions = computed(() => scopes.value.map((s, i) => ({
  label: `${s.category} / ${s.subcategory ?? '—'} (${s.count})${s.binCount != null ? ` · sig. ${s.binCount} bacs` : ''}`,
  value: i
})))
const selectedScope = computed(() => (selectedScopeIdx.value != null ? scopes.value[selectedScopeIdx.value] || null : null))

function formatBuiltAt(d: string | null): string {
  if (!d) return ''
  const dt = new Date(d.replace(' ', 'T') + 'Z')
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleString('fr-FR')
}

async function buildSignature() {
  const s = selectedScope.value
  if (!s) return
  buildingSignature.value = true
  try {
    const res = await $fetch<{ binCount: number, sampleCount: number, reanalyzed: number, manualSkipped: number }>(
      '/api/admin/chest-colors/build-signature',
      { method: 'POST', body: { category: s.category, subcategory: s.subcategory } }
    )
    toast.add({ title: `Signature : ${res.binCount} bacs (${res.sampleCount} images) — ${res.reanalyzed} ré-analysés, ${res.manualSkipped} manuels épargnés`, color: 'success' })
    await refreshScopes()
  } catch {
    toast.add({ title: 'Erreur lors de la construction de la signature', color: 'error' })
  } finally {
    buildingSignature.value = false
  }
}

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
interface SearchItem {
  id: number
  name: string
  image: string | null
  colors: string[]
  manual: boolean
  _dirty?: boolean // édition locale non encore enregistrée
  _saving?: boolean
}

const search = ref('')
const searchResults = ref<SearchItem[]>([])
const searching = ref(false)
const reanalyzingId = ref<number | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

// Pastille d'affichage d'une couleur nommée (repli si absente de la palette).
function colorHex(name: string): string {
  return (palette.value || []).find(c => c.name === name)?.hex || '#888888'
}

// Couleurs de la palette pas encore présentes sur l'item (pour le menu « ajouter »).
function missingColors(item: SearchItem): Array<{ name: string, hex: string }> {
  return (palette.value || []).filter(c => !item.colors.includes(c.name))
}

function removeColor(item: SearchItem, idx: number) {
  item.colors.splice(idx, 1)
  item._dirty = true
}

// Promeut une couleur en tête de liste (= couleur principale).
function promoteColor(item: SearchItem, idx: number) {
  if (idx === 0) return
  const [c] = item.colors.splice(idx, 1)
  item.colors.unshift(c!)
  item._dirty = true
}

function addColor(item: SearchItem, name: string) {
  if (item.colors.includes(name)) return
  item.colors.push(name)
  item._dirty = true
}

async function saveColors(item: SearchItem) {
  item._saving = true
  try {
    await $fetch('/api/admin/chest-colors/set-colors', { method: 'POST', body: { id: item.id, colors: item.colors } })
    item._dirty = false
    item.manual = true
    toast.add({ title: `Couleurs de « ${item.name} » enregistrées`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement des couleurs', color: 'error' })
  } finally {
    item._saving = false
  }
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
    item.manual = false // la ré-analyse auto écrase une éventuelle édition manuelle
    item._dirty = false
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
            class="flex items-start gap-3 py-3"
          >
            <img
              v-if="item.image"
              :src="item.image"
              :alt="item.name"
              loading="lazy"
              class="w-10 h-10 object-cover rounded bg-muted/20 shrink-0 mt-0.5"
            >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p
                  class="text-sm font-medium truncate"
                  :title="item.name"
                >
                  {{ item.name }}
                </p>
                <UBadge
                  v-if="item.manual"
                  color="info"
                  variant="subtle"
                  size="xs"
                >
                  manuel
                </UBadge>
              </div>

              <!-- Couleurs éditables : clic = principale, ✕ = retirer -->
              <div class="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span
                  v-if="!item.colors.length"
                  class="text-xs text-muted"
                >
                  Pas encore de couleurs
                </span>
                <span
                  v-for="(col, idx) in item.colors"
                  :key="col"
                  class="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full border border-muted/40 text-xs"
                >
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 cursor-pointer"
                    :title="idx === 0 ? 'Couleur principale' : 'Définir comme principale'"
                    @click="promoteColor(item, idx)"
                  >
                    <span
                      class="inline-block w-3 h-3 rounded-full border border-muted/40"
                      :style="{ backgroundColor: colorHex(col) }"
                    />
                    <span :class="idx === 0 ? 'font-semibold' : ''">{{ col }}</span>
                  </button>
                  <button
                    type="button"
                    class="text-muted hover:text-error cursor-pointer"
                    title="Retirer"
                    @click="removeColor(item, idx)"
                  >
                    <UIcon
                      name="i-lucide-x"
                      class="w-3 h-3"
                    />
                  </button>
                </span>
              </div>

              <!-- Ajouter une couleur de la palette -->
              <div
                v-if="missingColors(item).length"
                class="flex items-center gap-1.5 flex-wrap mt-1.5"
              >
                <span class="text-xs text-muted">Ajouter :</span>
                <button
                  v-for="c in missingColors(item)"
                  :key="c.name"
                  type="button"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-dashed border-muted/40 text-xs text-muted hover:text-foreground cursor-pointer"
                  @click="addColor(item, c.name)"
                >
                  <span
                    class="inline-block w-3 h-3 rounded-full"
                    :style="{ backgroundColor: c.hex }"
                  />
                  {{ c.name }}
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-1.5 shrink-0">
              <UButton
                v-if="item._dirty"
                size="xs"
                icon="i-lucide-check"
                label="Enregistrer"
                color="success"
                :loading="item._saving"
                @click="saveColors(item)"
              />
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
            </div>
          </li>
        </ul>
      </div>
    </UCard>

    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Signature de couleurs (sous-catégorie)
        </h2>
      </template>

      <div class="space-y-3">
        <p class="text-sm text-muted">
          Repère les couleurs communes à toutes les images d'une sous-catégorie (ex. la coque
          sous les figures de proue) pour les exclure de l'analyse, puis ré-analyse les items
          de cette sous-catégorie (les items édités à la main sont épargnés).
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <USelectMenu
            v-model="selectedScopeIdx"
            :items="scopeOptions"
            value-key="value"
            placeholder="Choisir une sous-catégorie…"
            class="w-full sm:w-96"
          />
          <UButton
            icon="i-lucide-scan-line"
            label="Construire + ré-analyser"
            :loading="buildingSignature"
            :disabled="!selectedScope"
            @click="buildSignature"
          />
        </div>
        <p
          v-if="selectedScope"
          class="text-sm text-muted"
        >
          <template v-if="selectedScope.binCount != null">
            Signature actuelle : {{ selectedScope.binCount }} bacs exclus, sur {{ selectedScope.sampleCount }} images — {{ formatBuiltAt(selectedScope.builtAt) }}
          </template>
          <template v-else>
            Pas encore de signature pour cette sous-catégorie.
          </template>
        </p>
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
