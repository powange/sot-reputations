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

type Gap = 'frName' | 'enName' | 'esName' | 'frDesc' | 'enDesc' | 'esDesc'
const GAP_LABELS: Record<Gap, string> = {
  frName: 'Nom FR',
  enName: 'Nom EN',
  esName: 'Nom ES',
  frDesc: 'Description FR',
  enDesc: 'Description EN',
  esDesc: 'Description ES'
}

interface ApiItem {
  id: number
  itemKey: string
  source: 'official' | 'wiki'
  published: boolean
  category: string
  subcategory: string | null
  name: string
  descFr: string | null
  image: string | null
  en: string | null
  es: string | null
  enDesc: string | null
  esDesc: string | null
  wikiName: string | null
  missing: Gap[]
}
interface Stats { total: number, incomplete: number, missing: Record<Gap, number> }
interface Facet { category: string, label: string, total: number, incomplete: number, subcategories: Array<{ subcategory: string, label: string, total: number, incomplete: number }> }
interface ListResult { items: ApiItem[], total: number, stats: { global: Stats, scope: Stats }, facets: Facet[] }

// Champs éditables d'une fiche ; `original` sert à détecter les modifications.
interface Fields { name: string, descFr: string, en: string, enDesc: string, es: string, esDesc: string, wikiName: string }
interface Row { item: ApiItem, fields: Fields, original: Fields }
const toFields = (i: ApiItem): Fields => ({
  name: i.name,
  descFr: i.descFr || '',
  en: i.en || '',
  enDesc: i.enDesc || '',
  es: i.es || '',
  esDesc: i.esDesc || '',
  wikiName: i.wikiName || ''
})
const isDirty = (r: Row) => (Object.keys(r.fields) as Array<keyof Fields>).some(k => r.fields[k] !== r.original[k])

// --- Filtres ---
const status = ref<'incomplete' | 'names' | 'descriptions' | 'all'>('incomplete')
const statusOptions = [
  { value: 'incomplete' as const, label: 'Incomplets' },
  { value: 'names' as const, label: 'Noms manquants' },
  { value: 'descriptions' as const, label: 'Descriptions manquantes' },
  { value: 'all' as const, label: 'Tous' }
]
const source = ref<'all' | 'official' | 'wiki'>('all')
const sourceOptions = [
  { value: 'all', label: 'Toutes les sources' },
  { value: 'official', label: 'Officiels (imports)' },
  { value: 'wiki', label: 'Items du wiki' }
]
// Langues dont il manque quelque chose (nom ou description) : FR, EN, ES, cumulables.
const langs = ref<Array<'fr' | 'en' | 'es'>>([])
const langOptions = [
  { value: 'fr' as const, label: 'FR' },
  { value: 'en' as const, label: 'EN' },
  { value: 'es' as const, label: 'ES' }
]
function toggleLang(l: 'fr' | 'en' | 'es') {
  if (!confirmDiscard()) return
  langs.value = langs.value.includes(l) ? langs.value.filter(x => x !== l) : [...langs.value, l]
}
const categories = ref<string[]>([])
const subcategories = ref<string[]>([])
const q = ref('')
const page = ref(1)
const PAGE_SIZE = 50

const data = ref<ListResult | null>(null)
const rows = ref<Row[]>([])
const loading = ref(false)

const categoryOptions = computed(() => (data.value?.facets ?? []).map(f => ({
  value: f.category,
  label: `${f.label} (${f.incomplete}/${f.total})`
})))
// Sous-catégories des catégories choisies (toutes si aucune), clé « catégorie\0sous-catégorie »
// côté interface, envoyées au serveur sous leur seul nom.
const subcategoryOptions = computed(() => (data.value?.facets ?? [])
  .filter(f => !categories.value.length || categories.value.includes(f.category))
  .flatMap(f => f.subcategories.map(s => ({
    value: s.subcategory,
    label: `${f.label} / ${s.label} (${s.incomplete}/${s.total})`
  }))))

const dirtyRows = computed(() => rows.value.filter(isDirty))

async function load() {
  loading.value = true
  try {
    const res = await $fetch<ListResult>('/api/admin/chest-item-translations/list', {
      query: {
        status: status.value,
        source: source.value,
        langs: langs.value.join(','),
        categories: categories.value.join(','),
        subcategories: subcategories.value.join(','),
        q: q.value.trim(),
        page: page.value,
        pageSize: PAGE_SIZE
      }
    })
    data.value = res
    rows.value = res.items.map(i => ({ item: i, fields: toFields(i), original: toFields(i) }))
  } catch {
    toast.add({ title: 'Erreur de chargement', color: 'error' })
  } finally {
    loading.value = false
  }
}

// Changer de filtre / de page fait perdre les modifications non enregistrées : on confirme.
function confirmDiscard(): boolean {
  return !dirtyRows.value.length || confirm(`${dirtyRows.value.length} fiche(s) modifiée(s) non enregistrée(s) seront perdues. Continuer ?`)
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch([status, source, langs, categories, subcategories], () => {
  page.value = 1
  load()
}, { deep: true })
watch(q, () => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    page.value = 1
    load()
  }, 350)
})
// Les sous-catégories hors des catégories choisies sont retirées.
watch(categories, () => {
  const allowed = new Set(subcategoryOptions.value.map(o => o.value))
  subcategories.value = subcategories.value.filter(s => allowed.has(s))
})

function goToPage(p: number) {
  if (p === page.value || !confirmDiscard()) return
  page.value = p
  load()
}

function setStatus(s: typeof status.value) {
  if (s !== status.value && confirmDiscard()) status.value = s
}

function resetFilters() {
  if (!confirmDiscard()) return
  categories.value = []
  subcategories.value = []
  langs.value = []
  source.value = 'all'
  q.value = ''
}

onMounted(load)

// --- Enregistrement (fiches modifiées uniquement) ---
const saving = ref(false)
const savingId = ref<number | null>(null)

async function save(list: Row[]) {
  if (!list.length) return
  const entries = list.map(r => ({
    itemKey: r.item.itemKey,
    fr: { name: r.fields.name, description: r.fields.descFr },
    translations: [
      { locale: 'en', name: r.fields.en, description: r.fields.enDesc },
      { locale: 'es', name: r.fields.es, description: r.fields.esDesc }
    ],
    wikiName: r.fields.wikiName
  }))
  await $fetch('/api/admin/chest-item-translations', { method: 'PUT', body: { entries } })
  for (const r of list) r.original = { ...r.fields }
}

async function saveAll() {
  saving.value = true
  try {
    const n = dirtyRows.value.length
    await save(dirtyRows.value)
    toast.add({ title: `${n} fiche(s) enregistrée(s)`, color: 'success' })
    await load()
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function saveOne(r: Row) {
  savingId.value = r.item.id
  try {
    await save([r])
    toast.add({ title: `Enregistré : ${r.fields.name}`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement', color: 'error' })
  } finally {
    savingId.value = null
  }
}

function scopeLabel(i: ApiItem): string {
  const f = data.value?.facets.find(x => x.category === i.category)
  const s = f?.subcategories.find(x => x.subcategory === (i.subcategory ?? ''))
  return `${f?.label ?? i.category}${i.subcategory ? ` / ${s?.label ?? i.subcategory}` : ''}`
}

// --- Réparations en lot (modale) ---
const repairOpen = ref(false)

interface RestoreResult { updated: number, unchanged: number, unknown: number, wikiNamesKept: number, samples: Array<{ locale: string, name: string, before: string | null, after: string, keptAsWikiName?: boolean }> }
interface RepairResult { count: number, samples: Array<{ name: string, before: string, after: string }> }

// Export du bookmarklet ({ chest, chestEn, chestEs, reputation }) : lu dans le navigateur,
// seuls les coffres EN / ES sont envoyés.
const exportData = ref<{ en: unknown, es: unknown } | null>(null)
// Sélecteur de fichier natif masqué, déclenché par un bouton.
const exportFileInput = ref<HTMLInputElement | null>(null)
const exportName = ref('')
const restorePreview = ref<RestoreResult | null>(null)
const restoring = ref(false)

async function onExportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // permet de re-choisir le même fichier
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
      await load()
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
      await load()
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
  <UContainer class="py-8 max-w-6xl">
    <div class="mb-6">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-4xl font-pirate">
            Traductions des objets
          </h1>
          <p class="text-muted mt-2 max-w-3xl">
            Noms et descriptions FR / EN / ES des objets du coffre, et leur nom wiki (titre de leur
            page sur le wiki quand il diffère du nom anglais). Le FR des objets officiels est réécrit
            par le jeu au prochain import d'un joueur qui les possède.
          </p>
        </div>
        <UButton
          icon="i-lucide-wrench"
          label="Réparer en lot"
          variant="soft"
          @click="repairOpen = true"
        />
      </div>
    </div>

    <!-- Statistiques (périmètre filtré : source + catégories + sous-catégories) -->
    <div
      v-if="data"
      class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6"
    >
      <UCard :ui="{ body: 'p-3 sm:p-3' }">
        <p class="text-xs text-muted">
          Objets
        </p>
        <p class="text-xl font-semibold">
          {{ data.stats.scope.total }}
        </p>
        <p
          v-if="data.stats.scope.total !== data.stats.global.total"
          class="text-xs text-muted"
        >
          sur {{ data.stats.global.total }}
        </p>
      </UCard>
      <UCard :ui="{ body: 'p-3 sm:p-3' }">
        <p class="text-xs text-muted">
          Incomplets
        </p>
        <p class="text-xl font-semibold text-warning">
          {{ data.stats.scope.incomplete }}
        </p>
        <p class="text-xs text-muted">
          {{ data.stats.scope.total ? Math.round(100 * (1 - data.stats.scope.incomplete / data.stats.scope.total)) : 0 }} % complets
        </p>
      </UCard>
      <UCard
        v-for="(label, gap) in GAP_LABELS"
        :key="gap"
        :ui="{ body: 'p-3 sm:p-3' }"
      >
        <p class="text-xs text-muted">
          {{ label }} manquant{{ gap.endsWith('Desc') ? 'e' : '' }}
        </p>
        <p
          class="text-xl font-semibold"
          :class="data.stats.scope.missing[gap] ? '' : 'text-success'"
        >
          {{ data.stats.scope.missing[gap] }}
        </p>
      </UCard>
    </div>

    <!-- Filtres -->
    <UCard class="mb-4">
      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.label"
            size="xs"
            :color="status === opt.value ? 'primary' : 'neutral'"
            :variant="status === opt.value ? 'solid' : 'outline'"
            @click="setStatus(opt.value)"
          />
          <span class="text-xs text-muted ml-2">Traduction manquante :</span>
          <UButton
            v-for="opt in langOptions"
            :key="opt.value"
            :label="opt.label"
            size="xs"
            :color="langs.includes(opt.value) ? 'primary' : 'neutral'"
            :variant="langs.includes(opt.value) ? 'solid' : 'outline'"
            :title="`Objets auxquels il manque le nom ou la description en ${opt.label}`"
            @click="toggleLang(opt.value)"
          />
          <USelect
            v-model="source"
            :items="sourceOptions"
            size="xs"
            class="min-w-44 ml-2"
          />
          <UButton
            label="Réinitialiser"
            icon="i-lucide-rotate-ccw"
            size="xs"
            variant="link"
            color="neutral"
            @click="resetFilters"
          />
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          <USelectMenu
            v-model="categories"
            :items="categoryOptions"
            value-key="value"
            multiple
            placeholder="Toutes les catégories"
            class="w-full"
          />
          <USelectMenu
            v-model="subcategories"
            :items="subcategoryOptions"
            value-key="value"
            multiple
            placeholder="Toutes les sous-catégories"
            class="w-full"
          />
        </div>
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Rechercher par nom (FR, EN, ES ou nom wiki)…"
          class="w-full"
          :loading="loading"
        />
      </div>
    </UCard>

    <!-- Barre d'actions -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <p class="text-sm text-muted">
        {{ data?.total ?? 0 }} objet(s)
        <span v-if="dirtyRows.length"> · <span class="text-primary font-medium">{{ dirtyRows.length }} modifié(s)</span></span>
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <UPagination
          v-if="(data?.total ?? 0) > PAGE_SIZE"
          :page="page"
          :total="data?.total ?? 0"
          :items-per-page="PAGE_SIZE"
          size="sm"
          @update:page="goToPage"
        />
        <UButton
          icon="i-lucide-save"
          :label="`Enregistrer les modifications (${dirtyRows.length})`"
          :loading="saving"
          :disabled="!dirtyRows.length"
          @click="saveAll"
        />
      </div>
    </div>

    <!-- Liste -->
    <div
      v-if="loading && !rows.length"
      class="flex justify-center py-8"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-muted"
      />
    </div>
    <p
      v-else-if="!rows.length"
      class="text-center py-8 text-muted"
    >
      Aucun objet pour ces filtres.
    </p>
    <div
      v-else
      class="space-y-3"
      :class="loading ? 'opacity-60' : ''"
    >
      <UCard
        v-for="r in rows"
        :key="r.item.itemKey"
        :class="isDirty(r) ? 'ring-2 ring-primary/60' : ''"
      >
        <div class="flex items-start gap-3">
          <ChestItemImage
            v-if="r.item.image"
            :src="r.item.image"
            :alt="r.item.name"
            :size="56"
            format="webp"
            loading="lazy"
            class="w-14 h-14 rounded object-contain bg-elevated shrink-0"
          />
          <div
            v-else
            class="w-14 h-14 rounded bg-elevated shrink-0 flex items-center justify-center"
          >
            <UIcon
              name="i-lucide-image-off"
              class="w-5 h-5 text-muted"
            />
          </div>

          <div class="flex-1 min-w-0 space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-muted">{{ scopeLabel(r.item) }}</span>
              <UBadge
                v-if="r.item.source === 'wiki'"
                color="info"
                variant="subtle"
                size="sm"
              >
                wiki{{ r.item.published ? '' : ' · brouillon' }}
              </UBadge>
              <UBadge
                v-for="g in r.item.missing"
                :key="g"
                color="warning"
                variant="subtle"
                size="sm"
              >
                {{ GAP_LABELS[g] }} manquant{{ g.endsWith('Desc') ? 'e' : '' }}
              </UBadge>
              <UButton
                v-if="isDirty(r)"
                icon="i-lucide-save"
                label="Enregistrer"
                size="xs"
                class="ml-auto"
                :loading="savingId === r.item.id"
                @click="saveOne(r)"
              />
            </div>

            <div class="grid gap-2 sm:grid-cols-2">
              <UFormField label="FR — nom">
                <UInput
                  v-model="r.fields.name"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="FR — description">
                <UTextarea
                  v-model="r.fields.descFr"
                  :rows="2"
                  autoresize
                  placeholder="—"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="EN — nom">
                <UInput
                  v-model="r.fields.en"
                  :placeholder="r.fields.name"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="EN — description">
                <UTextarea
                  v-model="r.fields.enDesc"
                  :rows="2"
                  autoresize
                  :placeholder="r.fields.descFr || '—'"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="ES — nom">
                <UInput
                  v-model="r.fields.es"
                  :placeholder="r.fields.name"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="ES — description">
                <UTextarea
                  v-model="r.fields.esDesc"
                  :rows="2"
                  autoresize
                  :placeholder="r.fields.descFr || '—'"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Nom wiki"
                help="Titre de la page sur le wiki s'il diffère du nom anglais (rapprochement). Vide = nom anglais."
                class="sm:col-span-2"
              >
                <UInput
                  v-model="r.fields.wikiName"
                  :placeholder="r.fields.en || r.fields.name"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </div>
      </UCard>

      <div
        v-if="(data?.total ?? 0) > PAGE_SIZE"
        class="flex justify-center pt-2"
      >
        <UPagination
          :page="page"
          :total="data?.total ?? 0"
          :items-per-page="PAGE_SIZE"
          @update:page="goToPage"
        />
      </div>
    </div>

    <!-- Réparations en lot -->
    <UModal
      v-model:open="repairOpen"
      title="Réparer les traductions en lot"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
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
              ref="exportFileInput"
              type="file"
              accept=".json,application/json"
              class="hidden"
              @change="onExportFile"
            >
            <UButton
              icon="i-lucide-file-json"
              label="Choisir l'export (JSON)"
              size="sm"
              variant="soft"
              :loading="restoring && !restorePreview"
              @click="exportFileInput?.click()"
            />
            <template v-if="restorePreview">
              <p>
                <strong>{{ restorePreview.updated }}</strong> traduction(s) à restaurer ·
                {{ restorePreview.unchanged }} déjà à jour ·
                {{ restorePreview.unknown }} hors catalogue (ignorées)
                <span class="text-muted">— {{ exportName }}</span>
              </p>
              <p
                v-if="restorePreview.wikiNamesKept"
                class="text-xs text-info"
              >
                {{ restorePreview.wikiNamesKept }} ancien(s) nom(s) anglais conservé(s) comme nom wiki
                (ils servaient au rapprochement avec le wiki).
              </p>
              <ul
                v-if="restorePreview.samples.length"
                class="text-xs space-y-0.5 max-h-60 overflow-y-auto"
              >
                <li
                  v-for="(sm, i) in restorePreview.samples"
                  :key="i"
                >
                  <span class="text-muted">[{{ sm.locale }}] {{ sm.name }} :</span>
                  <span class="line-through text-muted">{{ sm.before ?? '—' }}</span>
                  → <span class="font-medium">{{ sm.after }}</span>
                  <span
                    v-if="sm.keptAsWikiName"
                    class="text-info"
                  > (ancien nom gardé comme nom wiki)</span>
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
                class="text-xs space-y-0.5 max-h-60 overflow-y-auto"
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
      </template>
    </UModal>
  </UContainer>
</template>
