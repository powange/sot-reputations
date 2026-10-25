<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

const { isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Coûts & prérequis du coffre - Administration'
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

const { data: scopesData, refresh: refreshScopes } = await useFetch<{ scopes: ChestCostScope[] }>('/api/admin/chest-costs/scopes')
const scopes = computed(() => scopesData.value?.scopes || [])

// Filtre d'avancement des scopes : toutes / sans aucun coût / partiellement remplies.
const scopeFilter = ref<'all' | 'empty' | 'incomplete'>('all')
const emptyCount = computed(() => scopes.value.filter(s => s.withCost === 0).length)
const incompleteCount = computed(() => scopes.value.filter(s => s.withCost > 0 && s.withCost < s.count).length)
const scopeFilterOptions = computed(() => [
  { label: `Toutes (${scopes.value.length})`, value: 'all' as const },
  { label: `Sans coût (${emptyCount.value})`, value: 'empty' as const },
  { label: `Incomplètes (${incompleteCount.value})`, value: 'incomplete' as const }
])
function scopeMatchesFilter(s: ChestCostScope): boolean {
  if (scopeFilter.value === 'empty') return s.withCost === 0
  if (scopeFilter.value === 'incomplete') return s.withCost > 0 && s.withCost < s.count
  return true
}

const scopeOptions = computed(() =>
  scopes.value
    .filter(scopeMatchesFilter)
    .map(s => ({
      label: `${s.category} / ${s.subcategory ?? '—'} (${s.withCost}/${s.count} avec coût)`,
      value: chestCostScopeKey(s)
    }))
)

// Sous-catégories sélectionnées (plusieurs possibles), par clé stable.
const selectedKeys = ref<string[]>([])
// Les sélections hors du filtre choisi sont retirées (elles ne seraient plus visibles).
watch(scopeFilter, () => {
  const visible = new Set(scopeOptions.value.map(o => o.value))
  selectedKeys.value = selectedKeys.value.filter(k => visible.has(k))
})
function selectAllFiltered() {
  selectedKeys.value = scopeOptions.value.map(o => o.value)
}

// Sections de l'aperçu à afficher (affinables avant ou après « Récupérer »).
const sectionOptions: Array<{ label: string, value: ChestCostSection }> = [
  { label: 'Coûts trouvés', value: 'matched' },
  { label: 'Sans coût sur le wiki', value: 'noCost' },
  { label: 'Non matchés', value: 'unmatched' },
  { label: 'Pages wiki sans item', value: 'wikiOnly' }
]
const sections = ref<ChestCostSection[]>(sectionOptions.map(o => o.value))

// Aperçus affichés : un par sous-catégorie récupérée (ordre de la liste des scopes).
const previewKeys = ref<string[]>([])
const previewScopes = computed(() => {
  const byKey = new Map(scopes.value.map(s => [chestCostScopeKey(s), s]))
  return previewKeys.value.map(k => byKey.get(k)).filter((s): s is ChestCostScope => !!s)
})
const previewRefs = new Map<string, { fetchCosts: () => Promise<void> }>()
function setPreviewRef(key: string, el: Element | ComponentPublicInstance | null) {
  if (el) previewRefs.set(key, el as unknown as { fetchCosts: () => Promise<void> })
  else previewRefs.delete(key)
}

const fetchingAll = ref(false)
const stopFetch = ref(false)
const fetchProgress = ref({ done: 0, total: 0 })

// Récupère les sous-catégories sélectionnées l'une après l'autre (ménage le wiki).
async function fetchSelected() {
  const order = new Map(scopes.value.map((s, i) => [chestCostScopeKey(s), i]))
  previewKeys.value = [...selectedKeys.value].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
  await nextTick()
  fetchingAll.value = true
  stopFetch.value = false
  fetchProgress.value = { done: 0, total: previewKeys.value.length }
  try {
    for (const key of previewKeys.value) {
      if (stopFetch.value) break
      await previewRefs.get(key)?.fetchCosts()
      fetchProgress.value.done++
    }
  } finally {
    fetchingAll.value = false
  }
}

// --- Traitement en masse : récupère + applique pour toutes les sous-catégories filtrées ---
const bulkRunning = ref(false)
const bulkProgress = ref({ done: 0, total: 0, current: '' })

async function runBulk(mode: 'all' | 'prereqsOnly' = 'all') {
  const targets = scopes.value.filter(scopeMatchesFilter)
  if (!targets.length) {
    toast.add({ title: 'Aucune sous-catégorie dans le filtre courant', color: 'warning' })
    return
  }
  const what = mode === 'prereqsOnly' ? 'les prérequis' : 'les coûts et prérequis'
  if (!confirm(`Récupérer puis appliquer ${what} du wiki pour ${targets.length} sous-catégorie(s) filtrée(s) ? Les données en base seront mises à jour.`)) return

  bulkRunning.value = true
  previewKeys.value = []
  let applied = 0
  let failed = 0
  let skipped = 0
  let done = 0
  bulkProgress.value = { done: 0, total: targets.length, current: '' }
  try {
    for (const s of targets) {
      bulkProgress.value = { done, total: targets.length, current: `${s.category} / ${s.subcategory ?? '—'}` }
      const wikiCat = (s.wikiCategory ?? s.subcategory ?? '').trim()
      if (!wikiCat) {
        skipped++
        done++
        continue
      }
      try {
        const res = await $fetch<ChestCostFetchResult>('/api/admin/chest-costs/fetch', {
          method: 'POST',
          body: { category: s.category, subcategory: s.subcategory, wikiCategory: wikiCat }
        })
        // prereqsOnly : on n'écrit QUE les prérequis des items qui en ont (cost non
        // envoyé -> coûts intacts). all : coût (matchés) + prérequis (matchés ET sans-coût).
        // On n'envoie prereqs QUE s'il est non-null (un null effacerait les prérequis déjà
        // importés). Seulement ce qui change réellement (coût ou prérequis ≠ base).
        const items = mode === 'prereqsOnly'
          ? [...res.matched, ...res.noCost].filter(chestPrereqsChanged).map(x => ({ id: x.id, prereqs: x.prereqs }))
          : [
              ...res.matched.filter(chestMatchedChanged).map(m => chestPrereqsChanged(m) ? { id: m.id, cost: m.cost, prereqs: m.prereqs } : { id: m.id, cost: m.cost }),
              ...res.noCost.filter(chestPrereqsChanged).map(n => ({ id: n.id, prereqs: n.prereqs }))
            ]
        if (items.length) {
          const ap = await $fetch<{ updated: number }>('/api/admin/chest-costs/apply', {
            method: 'POST',
            body: { items }
          })
          applied += ap.updated
        }
      } catch {
        failed++
      }
      done++
      bulkProgress.value = { done, total: targets.length, current: '' }
    }
    toast.add({
      title: `Terminé : ${applied} objet(s) mis à jour (${mode === 'prereqsOnly' ? 'prérequis' : 'coût + prérequis'}) sur ${targets.length} sous-catégorie(s) (${failed} échec(s), ${skipped} ignorée(s))`,
      color: failed ? 'warning' : 'success'
    })
    await refreshScopes()
  } finally {
    bulkRunning.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        Coûts & prérequis du coffre
      </h1>
      <p class="text-muted mt-2">
        Récupère depuis le wiki Sea of Thieves le <strong>coût d'achat</strong> et les
        <strong>prérequis</strong> des objets (commendation/grade, niveau de réputation,
        Pirate Legend…), par rapprochement de nom anglais, puis applique après vérification.
      </p>
    </div>

    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Récupérer depuis le wiki
        </h2>
      </template>

      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-muted">Filtre :</span>
          <UButton
            v-for="opt in scopeFilterOptions"
            :key="opt.value"
            :label="opt.label"
            size="xs"
            :color="scopeFilter === opt.value ? 'primary' : 'neutral'"
            :variant="scopeFilter === opt.value ? 'solid' : 'outline'"
            @click="scopeFilter = opt.value"
          />
        </div>
        <div>
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
            <label class="text-sm text-muted">Sous-catégories ({{ selectedKeys.length }} sélectionnée{{ selectedKeys.length > 1 ? 's' : '' }})</label>
            <div class="flex gap-1">
              <UButton
                :label="`Tout sélectionner (${scopeOptions.length})`"
                size="xs"
                variant="link"
                color="neutral"
                @click="selectAllFiltered"
              />
              <UButton
                label="Vider"
                size="xs"
                variant="link"
                color="neutral"
                :disabled="!selectedKeys.length"
                @click="selectedKeys = []"
              />
            </div>
          </div>
          <USelectMenu
            v-model="selectedKeys"
            :items="scopeOptions"
            value-key="value"
            multiple
            placeholder="Choisir une ou plusieurs sous-catégories…"
            class="w-full"
          />
        </div>
        <div>
          <label class="text-sm text-muted block mb-1">Sections affichées dans l'aperçu</label>
          <UCheckboxGroup
            v-model="sections"
            :items="sectionOptions"
            orientation="horizontal"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            icon="i-lucide-download"
            :label="`Récupérer (${selectedKeys.length})`"
            :loading="fetchingAll"
            :disabled="!selectedKeys.length || bulkRunning || fetchingAll"
            @click="fetchSelected"
          />
          <UButton
            v-if="fetchingAll"
            label="Arrêter"
            color="warning"
            variant="outline"
            @click="stopFetch = true"
          />
          <span
            v-if="fetchingAll"
            class="text-sm text-muted"
          >
            {{ fetchProgress.done }}/{{ fetchProgress.total }} sous-catégorie(s)
          </span>
        </div>
        <p class="text-xs text-muted">
          Chaque sous-catégorie interroge sa catégorie wiki mémorisée (sinon son nom), modifiable
          dans son bloc d'aperçu : plusieurs catégories possibles, séparées par <code>|</code>
          (ex. <code>Banjo|Drum</code>) ; l'icône disquette la mémorise. Les sections cochées
          filtrent l'affichage sans relancer la récupération.
        </p>

        <div class="pt-3 border-t border-muted/20 space-y-2">
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              icon="i-lucide-zap"
              :label="`Tout récupérer + appliquer (${scopeOptions.length} filtrée${scopeOptions.length > 1 ? 's' : ''})`"
              color="primary"
              :loading="bulkRunning"
              :disabled="bulkRunning || fetchingAll || scopeOptions.length === 0"
              @click="runBulk('all')"
            />
            <UButton
              icon="i-lucide-list-checks"
              :label="`Prérequis seulement (${scopeOptions.length})`"
              color="neutral"
              variant="outline"
              :loading="bulkRunning"
              :disabled="bulkRunning || fetchingAll || scopeOptions.length === 0"
              @click="runBulk('prereqsOnly')"
            />
            <p
              v-if="bulkRunning"
              class="text-sm text-muted flex items-center gap-2"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="w-4 h-4 animate-spin"
              />
              Traitement {{ bulkProgress.done }}/{{ bulkProgress.total }}<span v-if="bulkProgress.current"> : {{ bulkProgress.current }}</span>
            </p>
          </div>
          <p class="text-xs text-muted">
            Pour toutes les sous-catégories du filtre courant (utilise la catégorie wiki
            mémorisée si elle existe). <strong>Tout récupérer</strong> : coûts + prérequis.
            <strong>Prérequis seulement</strong> : n'écrit que les prérequis (les coûts en base
            restent intacts) — pratique pour rafraîchir les prérequis sans retoucher les coûts.
          </p>
        </div>
      </div>
    </UCard>

    <ChestCostPreview
      v-for="sc in previewScopes"
      :key="chestCostScopeKey(sc)"
      :ref="(el) => setPreviewRef(chestCostScopeKey(sc), el)"
      :scope="sc"
      :sections="sections"
      @updated="refreshScopes()"
    />
  </UContainer>
</template>
