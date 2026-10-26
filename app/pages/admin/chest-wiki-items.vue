<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Items du wiki - Administration'
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

interface Cost { gold?: number, doubloons?: number, ancientCoins?: number }
interface Prereqs { commendations?: Array<{ name: string, grade: number | null }>, factionLevels?: Record<string, number>, legendary?: boolean, requires?: string }
interface WikiChestItem {
  id: number
  // Clé « wiki:<titre> » (identique en dev et en prod) et titre de la page wiki.
  key: string
  wikiTitle: string
  // Nom de base (français une fois importé, sinon titre wiki) et nom anglais.
  title: string
  enName: string | null
  frNamed: boolean
  category: string
  subcategory: string | null
  description: string | null
  image: string | null
  cost: Cost | null
  prerequisites: Prereqs | null
  published: boolean
  // Items officiels du même périmètre portant ce nom : > 0 = doublon probable.
  officialMatches: number
  officialDuplicates: Array<{ id: number, name: string, enName: string, image: string | null, owners: number }>
}

const { data: items, status, refresh } = await useFetch<WikiChestItem[]>('/api/admin/chest-wiki-items', { default: () => [] })

// Filtres : statut, périmètre (catégorie / sous-catégorie), recherche par titre.
const statusFilter = ref<'draft' | 'published' | 'all' | 'duplicates' | 'nofr'>('draft')
const statusOptions = [
  { value: 'draft' as const, label: 'Non publiés' },
  { value: 'published' as const, label: 'Publiés' },
  { value: 'all' as const, label: 'Tous' },
  { value: 'duplicates' as const, label: 'Doublons probables' },
  { value: 'nofr' as const, label: 'Sans nom français' }
]
const duplicateCount = computed(() => items.value.filter(it => it.officialMatches > 0).length)
const noFrCount = computed(() => items.value.filter(it => !it.frNamed).length)
const statusLabel = (opt: typeof statusOptions[number]) => {
  if (opt.value === 'draft') return `${opt.label} (${draftCount.value})`
  if (opt.value === 'duplicates') return `${opt.label} (${duplicateCount.value})`
  if (opt.value === 'nofr') return `${opt.label} (${noFrCount.value})`
  return opt.label
}
function matchesStatus(it: WikiChestItem): boolean {
  switch (statusFilter.value) {
    case 'all': return true
    case 'duplicates': return it.officialMatches > 0
    case 'nofr': return !it.frNamed
    default: return it.published === (statusFilter.value === 'published')
  }
}
// 'all' plutôt que '' : un SelectItem ne peut pas avoir une valeur vide.
const scopeFilter = ref('all')
const search = ref('')

function scopeOf(it: WikiChestItem): string {
  return it.subcategory ? `${it.category} / ${it.subcategory}` : it.category
}

const scopeOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const it of items.value) counts.set(scopeOf(it), (counts.get(scopeOf(it)) ?? 0) + 1)
  return [
    { label: 'Tous les périmètres', value: 'all' },
    ...[...counts].map(([scope, n]) => ({ label: `${scope} (${n})`, value: scope }))
  ]
})

const draftCount = computed(() => items.value.filter(it => !it.published).length)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter(it =>
    matchesStatus(it)
    && (scopeFilter.value === 'all' || scopeOf(it) === scopeFilter.value)
    && (!q || [it.title, it.enName, it.wikiTitle].some(n => n?.toLowerCase().includes(q)))
  )
})

// Affichage par pages de 100 (un périmètre peut compter des centaines d'items).
const PAGE = 100
const shown = ref(PAGE)
watch([statusFilter, scopeFilter, search], () => {
  shown.value = PAGE
  selectedIds.value = new Set()
})
const visible = computed(() => filtered.value.slice(0, shown.value))

const selectedIds = ref<Set<number>>(new Set())
function toggle(id: number) {
  const set = new Set(selectedIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  selectedIds.value = set
}
const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(it => selectedIds.value.has(it.id)))
function toggleAll() {
  selectedIds.value = allSelected.value ? new Set() : new Set(filtered.value.map(it => it.id))
}

const acting = ref(false)

async function setPublished(published: boolean) {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  acting.value = true
  try {
    const res = await $fetch<{ updated: number }>('/api/admin/chest-wiki-items/publish', {
      method: 'POST',
      body: { ids, published }
    })
    toast.add({ title: `${res.updated} item(s) ${published ? 'publié(s)' : 'dépublié(s)'}`, color: 'success' })
    selectedIds.value = new Set()
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la mise à jour', color: 'error' })
  } finally {
    acting.value = false
  }
}

// --- Noms français en lot (JSON) ---

// Export de la liste (pour produire le JSON des noms français hors ligne).
function exportList() {
  const data = items.value.map(it => ({
    key: it.key,
    wikiTitle: it.wikiTitle,
    enName: it.enName,
    nameFr: it.frNamed ? it.title : null,
    category: it.category,
    subcategory: it.subcategory,
    image: it.image,
    published: it.published
  }))
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `items-wiki-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

interface FrImportResult {
  updated: number
  unchanged: number
  unknown: string[]
  invalid: number
  changes: FrChange[]
}
interface FrChange {
  key: string
  before: string
  after: string
  descriptionBefore: string | null
  descriptionAfter: string | null
  // Image de l'item, nom / description anglais, et image de comparaison (champ compareImage).
  image: string | null
  enName: string | null
  enDescription: string | null
  compareImage: string | null
}
// Comparaison en grand (modale) d'une ligne de l'aperçu.
const compareChange = ref<FrChange | null>(null)
const compareOpen = computed({
  get: () => !!compareChange.value,
  set: (v: boolean) => { if (!v) compareChange.value = null }
})
// Ligne suivante de l'aperçu (après celle affichée dans la modale), ou null.
function nextChange(c: FrChange): FrChange | null {
  const list = frPreview.value?.changes ?? []
  const i = list.findIndex(x => x.key === c.key)
  return i >= 0 && i + 1 < list.length ? list[i + 1]! : null
}

// Valide UNE ligne depuis la modale : import de cet item seul, retrait de l'aperçu, puis
// passage à la ligne suivante (vérification à la chaîne).
const validatingOne = ref(false)
async function validateOne(c: FrChange) {
  validatingOne.value = true
  try {
    const entry = { key: c.key, nameFr: c.after, ...(c.descriptionAfter !== c.descriptionBefore ? { descriptionFr: c.descriptionAfter } : {}) }
    await $fetch('/api/admin/chest-wiki-items/import-fr', { method: 'POST', body: { entries: [entry], apply: true } })
    toast.add({ title: `Validé : ${c.after}`, color: 'success' })
    const next = nextChange(c)
    if (frPreview.value) {
      frPreview.value.changes = frPreview.value.changes.filter(x => x.key !== c.key)
      frPreview.value.updated--
    }
    frEntries.value = (frEntries.value ?? []).filter(e => (e as { key?: string })?.key !== c.key)
    const it = items.value.find(x => x.key === c.key)
    if (it) {
      it.title = c.after
      it.frNamed = c.after !== it.wikiTitle
      frInputs.value[it.id] = c.after
      if (entry.descriptionFr) it.description = entry.descriptionFr
    }
    compareChange.value = next
  } catch {
    toast.add({ title: 'Erreur lors de la validation', color: 'error' })
  } finally {
    validatingOne.value = false
  }
}
// Fichier attendu : [{ key: "wiki:<titre>", nameFr, descriptionFr?, compareImage? }] (ou { entries: [...] }).
const frEntries = ref<unknown[] | null>(null)
const frFileName = ref('')
const frPreview = ref<FrImportResult | null>(null)
const frImporting = ref(false)

// Fichier choisi via un bouton (l'input natif est masqué), ou JSON collé dans la zone de texte.
const frFileInput = ref<HTMLInputElement | null>(null)
const frText = ref('')

async function loadFrEntries(raw: string, label: string) {
  frPreview.value = null
  frEntries.value = null
  try {
    const json = JSON.parse(raw) as unknown
    const entries = Array.isArray(json) ? json : (json as { entries?: unknown })?.entries
    if (!Array.isArray(entries)) {
      toast.add({ title: 'Format inattendu', description: 'Attendu : un tableau [{ key, nameFr, descriptionFr? }].', color: 'error' })
      return
    }
    frEntries.value = entries
    frFileName.value = label
    await runFrImport(false)
  } catch {
    toast.add({ title: 'JSON illisible', color: 'error' })
  }
}

async function onFrFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await loadFrEntries(await file.text(), file.name)
  input.value = '' // permet de re-choisir le même fichier
}

// --- Nom français item par item ---
const frInputs = ref<Record<number, string>>({})
const savingFr = ref<number | null>(null)
const currentFr = (it: WikiChestItem) => it.frNamed ? it.title : ''
watch(items, (list) => {
  for (const it of list) {
    if (frInputs.value[it.id] === undefined) frInputs.value[it.id] = currentFr(it)
  }
}, { immediate: true })

async function saveFrName(it: WikiChestItem) {
  const nameFr = (frInputs.value[it.id] ?? '').trim()
  if (!nameFr) return
  savingFr.value = it.id
  try {
    await $fetch('/api/admin/chest-wiki-items/import-fr', {
      method: 'POST',
      body: { entries: [{ key: it.key, nameFr }], apply: true }
    })
    it.title = nameFr
    it.frNamed = nameFr !== it.wikiTitle
    toast.add({ title: `Nom français enregistré : ${nameFr}`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement', color: 'error' })
  } finally {
    savingFr.value = null
  }
}

async function runFrImport(apply: boolean) {
  if (!frEntries.value) return
  frImporting.value = true
  try {
    const res = await $fetch<FrImportResult>('/api/admin/chest-wiki-items/import-fr', {
      method: 'POST',
      body: { entries: frEntries.value, apply }
    })
    if (apply) {
      toast.add({ title: `${res.updated} item(s) renommé(s) en français`, color: 'success' })
      frPreview.value = null
      frEntries.value = null
      frText.value = ''
      frInputs.value = {}
      await refresh()
    } else {
      frPreview.value = res
    }
  } catch {
    toast.add({ title: 'Erreur lors de l\'import', color: 'error' })
  } finally {
    frImporting.value = false
  }
}

async function removeSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  if (!confirm(`Supprimer définitivement ${ids.length} item(s) créé(s) depuis le wiki ?`)) return
  acting.value = true
  try {
    const res = await $fetch<{ deleted: number }>('/api/admin/chest-wiki-items/delete', {
      method: 'POST',
      body: { ids }
    })
    toast.add({ title: `${res.deleted} item(s) supprimé(s)`, color: 'success' })
    selectedIds.value = new Set()
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
  } finally {
    acting.value = false
  }
}

function formatCost(cost: Cost | null): string {
  if (!cost) return ''
  const parts: string[] = []
  if (cost.gold != null) parts.push(`${cost.gold.toLocaleString('fr-FR')} or`)
  if (cost.doubloons != null) parts.push(`${cost.doubloons.toLocaleString('fr-FR')} doublons`)
  if (cost.ancientCoins != null) parts.push(`${cost.ancientCoins.toLocaleString('fr-FR')} pièces anciennes`)
  return parts.join(' · ')
}

function formatPrereqs(pr: Prereqs | null): string {
  if (!pr) return ''
  const parts: string[] = []
  for (const c of pr.commendations ?? []) parts.push(c.grade != null ? `${c.name} (grade ${c.grade})` : c.name)
  for (const [faction, level] of Object.entries(pr.factionLevels ?? {})) parts.push(`${faction} niv. ${level}`)
  if (pr.legendary) parts.push('Pirate Légendaire')
  if (pr.requires) parts.push(pr.requires)
  return parts.join(' · ')
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
        Items du wiki
      </h1>
      <p class="text-muted mt-2">
        Objets du coffre créés depuis le wiki Sea of Thieves, absents des imports des joueurs
        (création depuis
        <NuxtLink
          to="/admin/chest-costs"
          class="underline"
        >Données wiki du coffre</NuxtLink>, section « Pages wiki sans item »).
        Non publiés, ils ne sont visibles que dans l'administration ; publiés, ils apparaissent
        dans le coffre et l'API, avec leur nom anglais et l'image du wiki. Quand un joueur importe
        l'objet, il est rattaché automatiquement à l'item officiel (nom français, image officielle).
      </p>
    </div>

    <!-- Noms français en lot -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold">
            Noms français en lot
          </h2>
          <UButton
            icon="i-lucide-download"
            label="Exporter la liste (JSON)"
            size="sm"
            variant="soft"
            :disabled="!items.length"
            @click="exportList"
          />
        </div>
      </template>
      <div class="space-y-2 text-sm">
        <p class="text-muted">
          Importer un fichier JSON <code>[{ "key": "wiki:&lt;titre&gt;", "nameFr": "…", "descriptionFr": "…", "compareImage": "https://…" }]</code> :
          le nom français devient le nom de l'item (le nom anglais reste dans les traductions),
          la description française remplace la description si elle est fournie. Seuls les items du
          wiki sont modifiés. La clé figure dans l'export de la liste. <code>compareImage</code> (facultatif)
          est l'image d'une autre source, affichée à côté de celle de l'item dans l'aperçu pour vérifier
          la correspondance (clic sur les images pour comparer en grand) ; elle n'est pas enregistrée.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <input
            ref="frFileInput"
            type="file"
            accept=".json,application/json"
            class="hidden"
            @change="onFrFile"
          >
          <UButton
            icon="i-lucide-file-json"
            label="Choisir un fichier JSON"
            size="sm"
            variant="soft"
            @click="frFileInput?.click()"
          />
          <span class="text-xs text-muted">ou coller le JSON ci-dessous</span>
        </div>
        <UTextarea
          v-model="frText"
          :rows="3"
          autoresize
          :maxrows="12"
          placeholder="[{ &quot;key&quot;: &quot;wiki:Cursed Ferryman Cutlass&quot;, &quot;nameFr&quot;: &quot;Coutelas du Passeur maudit&quot; }]"
          class="w-full font-mono"
        />
        <UButton
          icon="i-lucide-scan-search"
          label="Analyser le JSON collé"
          size="sm"
          variant="soft"
          :disabled="!frText.trim()"
          :loading="frImporting && !frPreview"
          @click="loadFrEntries(frText, 'JSON collé')"
        />
        <template v-if="frPreview">
          <p>
            <strong>{{ frPreview.updated }}</strong> item(s) à renommer · {{ frPreview.unchanged }} déjà à jour
            <span v-if="frPreview.unknown.length"> · {{ frPreview.unknown.length }} clé(s) inconnue(s)</span>
            <span v-if="frPreview.invalid"> · {{ frPreview.invalid }} entrée(s) invalide(s)</span>
            <span class="text-muted">— {{ frFileName }}</span>
          </p>
          <ul
            v-if="frPreview.changes.length"
            class="text-xs space-y-1 max-h-80 overflow-y-auto"
          >
            <li
              v-for="c in frPreview.changes"
              :key="c.key"
              class="flex items-start gap-2"
            >
              <!-- Image de l'item wiki / image de comparaison : clic = comparaison en grand -->
              <button
                type="button"
                class="flex gap-1 shrink-0 cursor-zoom-in"
                :title="`Comparer les images : ${c.enName || c.before}`"
                @click="compareChange = c"
              >
                <ChestItemImage
                  v-if="c.image"
                  :src="c.image"
                  :alt="c.enName || c.before"
                  :size="40"
                  format="webp"
                  loading="lazy"
                  class="w-10 h-10 object-contain rounded bg-elevated"
                />
                <span
                  v-else
                  class="w-10 h-10 rounded bg-elevated"
                />
                <img
                  v-if="c.compareImage"
                  :src="c.compareImage"
                  :alt="c.after"
                  loading="lazy"
                  class="w-10 h-10 object-contain rounded bg-elevated ring-1 ring-info/40"
                >
              </button>
              <div class="min-w-0">
                <span class="line-through text-muted">{{ c.before }}</span>
                → <span class="font-medium">{{ c.after }}</span>
                <span
                  v-if="c.descriptionAfter !== c.descriptionBefore"
                  class="block text-muted"
                >{{ c.descriptionAfter }}</span>
              </div>
            </li>
          </ul>
          <p
            v-if="frPreview.unknown.length"
            class="text-xs text-warning"
          >
            Clés inconnues (item absent ou non issu du wiki) : {{ frPreview.unknown.slice(0, 10).join(', ') }}{{ frPreview.unknown.length > 10 ? '…' : '' }}
          </p>
          <UButton
            icon="i-lucide-check-check"
            :label="`Importer (${frPreview.updated})`"
            color="success"
            size="sm"
            :loading="frImporting"
            :disabled="!frPreview.updated"
            @click="runFrImport(true)"
          />
        </template>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="statusLabel(opt)"
            size="xs"
            :color="statusFilter === opt.value ? 'primary' : 'neutral'"
            :variant="statusFilter === opt.value ? 'solid' : 'outline'"
            @click="statusFilter = opt.value"
          />
          <USelect
            v-model="scopeFilter"
            :items="scopeOptions"
            size="xs"
            class="min-w-48"
          />
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Rechercher un titre"
            size="xs"
            class="min-w-48"
          />
        </div>
      </template>

      <div
        v-if="status === 'pending'"
        class="flex justify-center py-8"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-6 h-6 animate-spin text-primary"
        />
      </div>

      <p
        v-else-if="!filtered.length"
        class="text-center py-8 text-muted"
      >
        Aucun item du wiki pour ces filtres.
      </p>

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <UCheckbox
              :model-value="allSelected"
              @update:model-value="toggleAll"
            />
            Tout sélectionner ({{ filtered.length }})
          </label>
          <div class="flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-eye"
              :label="`Publier (${selectedIds.size})`"
              size="sm"
              color="success"
              :loading="acting"
              :disabled="selectedIds.size === 0 || acting"
              @click="setPublished(true)"
            />
            <UButton
              icon="i-lucide-eye-off"
              :label="`Dépublier (${selectedIds.size})`"
              size="sm"
              variant="soft"
              :disabled="selectedIds.size === 0 || acting"
              @click="setPublished(false)"
            />
            <UButton
              icon="i-lucide-trash-2"
              :label="`Supprimer (${selectedIds.size})`"
              size="sm"
              color="error"
              variant="soft"
              :disabled="selectedIds.size === 0 || acting"
              @click="removeSelected"
            />
          </div>
        </div>

        <ul class="divide-y divide-default">
          <li
            v-for="it in visible"
            :key="it.id"
            class="py-2"
          >
            <div class="flex items-start gap-3">
              <UCheckbox
                class="mt-1"
                :model-value="selectedIds.has(it.id)"
                @update:model-value="toggle(it.id)"
              />
              <ChestItemImage
                v-if="it.image"
                :src="it.image"
                :alt="it.title"
                :size="48"
                format="webp"
                loading="lazy"
                class="w-12 h-12 object-contain shrink-0 rounded bg-elevated"
              />
              <div
                v-else
                class="w-12 h-12 shrink-0 rounded bg-elevated"
              />
              <div class="min-w-0 flex-1 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">{{ it.title }}</span>
                  <span
                    v-if="it.frNamed"
                    class="text-xs text-muted"
                  >EN : {{ it.enName || it.wikiTitle }}</span>
                  <span
                    v-else
                    class="text-xs text-warning"
                  >pas de nom FR</span>
                  <UBadge
                    :color="it.published ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ it.published ? 'Publié' : 'Brouillon' }}
                  </UBadge>
                  <span class="text-xs text-muted">{{ scopeOf(it) }}</span>
                  <UBadge
                    v-if="it.officialMatches"
                    color="warning"
                    variant="subtle"
                    size="sm"
                    :title="`${it.officialMatches} item(s) officiel(s) du même périmètre portent ce nom (qualités de trophée, guillemets ignorés)`"
                  >
                    doublon probable ({{ it.officialMatches }} officiel{{ it.officialMatches > 1 ? 's' : '' }})
                  </UBadge>
                </div>
                <form
                  class="flex items-center gap-1 my-1"
                  @submit.prevent="saveFrName(it)"
                >
                  <UInput
                    v-model="frInputs[it.id]"
                    size="xs"
                    placeholder="Nom français"
                    class="w-80 max-w-full"
                    :ui="{ base: 'w-full' }"
                  />
                  <UButton
                    type="submit"
                    icon="i-lucide-check"
                    size="xs"
                    aria-label="Enregistrer le nom français"
                    :loading="savingFr === it.id"
                    :disabled="!(frInputs[it.id] ?? '').trim() || (frInputs[it.id] ?? '').trim() === currentFr(it)"
                  />
                </form>
                <p
                  v-if="it.description"
                  class="text-xs text-muted line-clamp-2"
                >
                  {{ it.description }}
                </p>
                <p
                  v-if="formatCost(it.cost) || formatPrereqs(it.prerequisites)"
                  class="text-xs mt-0.5"
                >
                  {{ [formatCost(it.cost), formatPrereqs(it.prerequisites)].filter(Boolean).join(' — ') }}
                </p>
                <!-- Doublon probable : items officiels correspondants et leurs possesseurs -->
                <div
                  v-if="it.officialDuplicates.length"
                  class="mt-1.5 pl-2 border-l-2 border-warning/40 space-y-1"
                >
                  <p class="text-xs text-warning">
                    Déjà au catalogue en item{{ it.officialDuplicates.length > 1 ? 's' : '' }} officiel{{ it.officialDuplicates.length > 1 ? 's' : '' }} :
                  </p>
                  <div
                    v-for="d in it.officialDuplicates"
                    :key="d.id"
                    class="flex items-center gap-2 text-xs"
                  >
                    <ChestItemImage
                      v-if="d.image"
                      :src="d.image"
                      :alt="d.name"
                      :size="24"
                      format="webp"
                      loading="lazy"
                      class="w-6 h-6 object-contain shrink-0 rounded bg-elevated"
                    />
                    <span class="font-medium">{{ d.name }}</span>
                    <span
                      v-if="d.enName !== d.name"
                      class="text-muted"
                    >· {{ d.enName }}</span>
                    <UBadge
                      size="xs"
                      variant="subtle"
                      :color="d.owners ? 'success' : 'neutral'"
                    >
                      {{ d.owners }} joueur{{ d.owners > 1 ? 's' : '' }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ul>

        <div
          v-if="filtered.length > shown"
          class="flex justify-center mt-4"
        >
          <UButton
            :label="`Afficher plus (${filtered.length - shown} restants)`"
            variant="soft"
            size="sm"
            @click="shown += PAGE"
          />
        </div>
      </template>
    </UCard>
    <!-- Comparaison d'une ligne de l'aperçu : images côte à côte, noms et descriptions -->
    <UModal
      v-model:open="compareOpen"
      title="Comparer avant import"
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <div
          v-if="compareChange"
          class="space-y-4"
        >
          <div class="grid grid-cols-2 gap-4">
            <figure class="text-center">
              <ChestItemImage
                v-if="compareChange.image"
                :src="compareChange.image"
                :alt="compareChange.enName || compareChange.before"
                :size="320"
                format="webp"
                class="mx-auto w-full max-w-80 aspect-square object-contain rounded bg-elevated"
              />
              <figcaption class="text-xs text-muted mt-1">
                Image de l'item (wiki)
              </figcaption>
            </figure>
            <figure class="text-center">
              <img
                v-if="compareChange.compareImage"
                :src="compareChange.compareImage"
                :alt="compareChange.after"
                class="mx-auto w-full max-w-80 aspect-square object-contain rounded bg-elevated"
              >
              <div
                v-else
                class="mx-auto w-full max-w-80 aspect-square rounded bg-elevated flex items-center justify-center text-xs text-muted"
              >
                Pas d'image de comparaison
              </div>
              <figcaption class="text-xs text-muted mt-1">
                Image de la source proposée
              </figcaption>
            </figure>
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-xs text-muted">
                Nom anglais
              </p>
              <p class="font-medium">
                {{ compareChange.enName || compareChange.before }}
              </p>
              <p class="text-xs text-muted mt-2">
                Description anglaise
              </p>
              <p>{{ compareChange.enDescription || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-muted">
                Nom français proposé
              </p>
              <p class="font-medium">
                {{ compareChange.after }}
              </p>
              <p class="text-xs text-muted mt-2">
                Description française proposée
              </p>
              <p>{{ compareChange.descriptionAfter !== compareChange.descriptionBefore ? compareChange.descriptionAfter : '— (inchangée)' }}</p>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div
          v-if="compareChange"
          class="flex w-full flex-wrap items-center justify-between gap-2"
        >
          <span class="text-xs text-muted">
            {{ (frPreview?.changes.findIndex(x => x.key === compareChange?.key) ?? 0) + 1 }} / {{ frPreview?.changes.length ?? 0 }}
          </span>
          <div class="flex gap-2">
            <UButton
              label="Suivant"
              icon="i-lucide-skip-forward"
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="!nextChange(compareChange)"
              @click="compareChange = nextChange(compareChange)"
            />
            <UButton
              label="Valider cet item"
              icon="i-lucide-check"
              color="success"
              size="sm"
              :loading="validatingOne"
              @click="validateOne(compareChange)"
            />
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
