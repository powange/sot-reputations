<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Coûts du coffre - Administration'
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

interface Scope { category: string, subcategory: string | null, count: number, withCost: number, wikiCategory: string | null }
interface Cost { gold?: number, doubloons?: number, ancientCoins?: number }
interface Matched { id: number, name: string, enName: string | null, wikiTitle: string, cost: Cost, currentCost: Cost | null }
interface NoCost { id: number, name: string, enName: string | null, wikiTitle: string }
interface Unmatched { id: number, name: string, enName: string | null }
interface WikiOnly { title: string, cost: Cost | null }
interface FetchResult {
  category: string
  subcategory: string | null
  wikiCategory: string
  matched: Matched[]
  noCost: NoCost[]
  unmatched: Unmatched[]
  wikiOnly: WikiOnly[]
  counts: { items: number, wiki: number, matched: number, noCost: number, unmatched: number, wikiOnly: number }
}

const { data: scopesData, refresh: refreshScopes } = await useFetch<{ scopes: Scope[] }>('/api/admin/chest-costs/scopes')
const scopes = computed(() => scopesData.value?.scopes || [])
const selectedScopeIdx = ref<number | undefined>()
const wikiCategory = ref('')
const fetching = ref(false)
const applying = ref(false)
const savingMap = ref(false)
const result = ref<FetchResult | null>(null)
// Items matchés cochés (à appliquer). Clé = id.
const selectedIds = ref<Set<number>>(new Set())

const scopeOptions = computed(() => scopes.value.map((s, i) => ({
  label: `${s.category} / ${s.subcategory ?? '—'} (${s.withCost}/${s.count} avec coût)`,
  value: i
})))
const selectedScope = computed(() => (selectedScopeIdx.value != null ? scopes.value[selectedScopeIdx.value] || null : null))

// Pré-remplit le nom de catégorie wiki : override mémorisé sinon la sous-catégorie.
watch(selectedScope, (s) => {
  wikiCategory.value = s?.wikiCategory ?? s?.subcategory ?? ''
  result.value = null
})

// Mémorise le nom de catégorie wiki pour ce scope (persisté en base).
async function saveWikiMap() {
  const s = selectedScope.value
  if (!s) return
  savingMap.value = true
  try {
    await $fetch('/api/admin/chest-costs/wiki-map', {
      method: 'POST',
      body: { category: s.category, subcategory: s.subcategory, wikiCategory: wikiCategory.value.trim() }
    })
    toast.add({ title: 'Catégorie wiki mémorisée', color: 'success' })
    await refreshScopes()
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement', color: 'error' })
  } finally {
    savingMap.value = false
  }
}

function formatCost(cost: Cost | null): string {
  if (!cost) return '—'
  const parts: string[] = []
  if (cost.gold != null) parts.push(`${cost.gold.toLocaleString('fr-FR')} or`)
  if (cost.doubloons != null) parts.push(`${cost.doubloons.toLocaleString('fr-FR')} doublons`)
  if (cost.ancientCoins != null) parts.push(`${cost.ancientCoins.toLocaleString('fr-FR')} pièces anciennes`)
  return parts.length ? parts.join(' · ') : '—'
}

function sameCost(a: Cost | null, b: Cost | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

async function fetchCosts() {
  const s = selectedScope.value
  if (!s) return
  fetching.value = true
  result.value = null
  try {
    const res = await $fetch<FetchResult>('/api/admin/chest-costs/fetch', {
      method: 'POST',
      body: { category: s.category, subcategory: s.subcategory, wikiCategory: wikiCategory.value.trim() || undefined }
    })
    result.value = res
    // Par défaut : on coche les matchés dont le coût change réellement.
    selectedIds.value = new Set(res.matched.filter(m => !sameCost(m.cost, m.currentCost)).map(m => m.id))
    toast.add({ title: `Wiki « ${res.wikiCategory} » : ${res.counts.matched} matchés, ${res.counts.unmatched} non matchés`, color: 'info' })
  } catch (e) {
    const msg = (e as { statusMessage?: string })?.statusMessage || 'Échec de la récupération'
    toast.add({ title: msg, color: 'error' })
  } finally {
    fetching.value = false
  }
}

function toggle(id: number) {
  const set = new Set(selectedIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  selectedIds.value = set
}

const allSelected = computed(() =>
  !!result.value?.matched.length && result.value.matched.every(m => selectedIds.value.has(m.id))
)
function toggleAll() {
  if (!result.value) return
  selectedIds.value = allSelected.value ? new Set() : new Set(result.value.matched.map(m => m.id))
}

async function apply() {
  if (!result.value) return
  const toApply = result.value.matched.filter(m => selectedIds.value.has(m.id))
  if (!toApply.length) {
    toast.add({ title: 'Aucun coût sélectionné', color: 'warning' })
    return
  }
  applying.value = true
  try {
    const res = await $fetch<{ updated: number }>('/api/admin/chest-costs/apply', {
      method: 'POST',
      body: { items: toApply.map(m => ({ id: m.id, cost: m.cost })) }
    })
    toast.add({ title: `${res.updated} coût(s) appliqué(s)`, color: 'success' })
    result.value = null
    selectedScopeIdx.value = undefined
    await refreshScopes()
  } catch {
    toast.add({ title: 'Erreur lors de l\'application', color: 'error' })
  } finally {
    applying.value = false
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
        Coûts du coffre
      </h1>
      <p class="text-muted mt-2">
        Récupère le coût d'achat des objets depuis le wiki Sea of Thieves (rapprochement
        par nom anglais), puis applique après vérification.
      </p>
    </div>

    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Récupérer depuis le wiki
        </h2>
      </template>

      <div class="space-y-3">
        <div class="flex flex-wrap items-end gap-3">
          <div class="w-full sm:w-96">
            <label class="text-sm text-muted block mb-1">Sous-catégorie</label>
            <USelectMenu
              v-model="selectedScopeIdx"
              :items="scopeOptions"
              value-key="value"
              placeholder="Choisir une sous-catégorie…"
              class="w-full"
            />
          </div>
          <div class="w-full sm:w-56">
            <label class="text-sm text-muted block mb-1">Catégorie wiki</label>
            <UInput
              v-model="wikiCategory"
              placeholder="ex. Banjo"
              :disabled="!selectedScope"
            />
          </div>
          <UButton
            icon="i-lucide-download"
            label="Récupérer"
            :loading="fetching"
            :disabled="!selectedScope || !wikiCategory.trim()"
            @click="fetchCosts"
          />
          <UButton
            icon="i-lucide-save"
            label="Mémoriser"
            color="neutral"
            variant="outline"
            :loading="savingMap"
            :disabled="!selectedScope"
            @click="saveWikiMap"
          />
        </div>
        <p class="text-xs text-muted">
          La catégorie wiki interrogée est <code>Category:{{ wikiCategory || '…' }}</code>.
          Modifie-la si le nom du wiki diffère de la sous-catégorie ; « Mémoriser » la
          conserve pour ce scope (vide = retour au nom de la sous-catégorie).
        </p>
      </div>
    </UCard>

    <template v-if="result">
      <!-- Récap -->
      <div class="flex flex-wrap gap-2 mb-4 text-sm">
        <UBadge
          color="success"
          variant="subtle"
        >
          {{ result.counts.matched }} avec coût
        </UBadge>
        <UBadge
          color="neutral"
          variant="subtle"
        >
          {{ result.counts.noCost }} sans coût (wiki)
        </UBadge>
        <UBadge
          color="warning"
          variant="subtle"
        >
          {{ result.counts.unmatched }} non matchés
        </UBadge>
        <UBadge
          color="info"
          variant="subtle"
        >
          {{ result.counts.wikiOnly }} pages wiki orphelines
        </UBadge>
      </div>

      <!-- Matchés avec coût -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold">
              Coûts trouvés ({{ result.matched.length }})
            </h2>
            <UButton
              icon="i-lucide-check-check"
              :label="`Appliquer (${selectedIds.size})`"
              color="success"
              size="sm"
              :loading="applying"
              :disabled="selectedIds.size === 0"
              @click="apply"
            />
          </div>
        </template>

        <p
          v-if="!result.matched.length"
          class="text-sm text-muted"
        >
          Aucun item matché avec un coût.
        </p>
        <table
          v-else
          class="w-full text-sm"
        >
          <thead class="text-left text-muted border-b border-muted/20">
            <tr>
              <th class="py-1 pr-2 w-8">
                <UCheckbox
                  :model-value="allSelected"
                  @update:model-value="toggleAll"
                />
              </th>
              <th class="py-1 pr-2">
                Item (EN)
              </th>
              <th class="py-1 pr-2">
                Coût actuel
              </th>
              <th class="py-1">
                Nouveau coût (wiki)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in result.matched"
              :key="m.id"
              class="border-b border-muted/10"
              :class="sameCost(m.cost, m.currentCost) ? 'opacity-60' : ''"
            >
              <td class="py-1.5 pr-2">
                <UCheckbox
                  :model-value="selectedIds.has(m.id)"
                  @update:model-value="toggle(m.id)"
                />
              </td>
              <td class="py-1.5 pr-2">
                <div class="font-medium">
                  {{ m.enName || m.name }}
                </div>
                <div
                  v-if="m.enName && m.enName !== m.name"
                  class="text-xs text-muted"
                >
                  {{ m.name }}
                </div>
              </td>
              <td class="py-1.5 pr-2 text-muted">
                {{ formatCost(m.currentCost) }}
              </td>
              <td class="py-1.5 font-medium">
                {{ formatCost(m.cost) }}
                <UBadge
                  v-if="sameCost(m.cost, m.currentCost)"
                  size="xs"
                  variant="subtle"
                  color="neutral"
                  class="ml-1"
                >
                  inchangé
                </UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <!-- Non matchés -->
      <UCard
        v-if="result.unmatched.length"
        class="mb-6"
      >
        <template #header>
          <h2 class="font-semibold">
            Non matchés ({{ result.unmatched.length }})
          </h2>
        </template>
        <p class="text-sm text-muted mb-2">
          Aucune page wiki ne correspond au nom EN de ces items (écart de nom, traduction EN
          manquante…). À corriger via « Traductions des objets » si besoin.
        </p>
        <ul class="text-sm space-y-1">
          <li
            v-for="u in result.unmatched"
            :key="u.id"
          >
            <span class="font-medium">{{ u.enName || u.name }}</span>
            <span
              v-if="u.enName && u.enName !== u.name"
              class="text-muted"
            > · {{ u.name }}</span>
            <span
              v-if="!u.enName"
              class="text-warning text-xs"
            > (pas de nom EN)</span>
          </li>
        </ul>
      </UCard>

      <!-- Sans coût sur le wiki -->
      <UCard
        v-if="result.noCost.length"
        class="mb-6"
      >
        <template #header>
          <h2 class="font-semibold">
            Sans coût sur le wiki ({{ result.noCost.length }})
          </h2>
        </template>
        <p class="text-sm text-muted mb-2">
          Items trouvés sur le wiki mais sans coût d'achat (par défaut, événement, récompense…).
        </p>
        <ul class="text-sm space-y-1">
          <li
            v-for="n in result.noCost"
            :key="n.id"
          >
            {{ n.enName || n.name }}
          </li>
        </ul>
      </UCard>

      <!-- Pages wiki orphelines -->
      <UCard v-if="result.wikiOnly.length">
        <template #header>
          <h2 class="font-semibold">
            Pages wiki sans item ({{ result.wikiOnly.length }})
          </h2>
        </template>
        <p class="text-sm text-muted mb-2">
          Pages du wiki non rapprochées d'un item du catalogue (item non importé, ou écart de nom).
        </p>
        <ul class="text-sm space-y-1">
          <li
            v-for="w in result.wikiOnly"
            :key="w.title"
          >
            <span class="font-medium">{{ w.title }}</span>
            <span class="text-muted"> · {{ formatCost(w.cost) }}</span>
          </li>
        </ul>
      </UCard>
    </template>
  </UContainer>
</template>
