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
  suspects: Suspect[]
}
interface Stats { total: number, incomplete: number, suspicious: number, missing: Record<Gap, number> }
// Traductions suspectes : copie probable de l'anglais.
type Suspect = 'esName' | 'frName' | 'esDesc' | 'frDesc'
const SUSPECT_LABELS: Record<Suspect, string> = {
  esName: 'Nom ES = EN ?',
  frName: 'Nom FR = EN ?',
  esDesc: 'Description ES = EN ?',
  frDesc: 'Description FR = EN ?'
}
interface Facet { category: string, label: string, total: number, incomplete: number, subcategories: Array<{ subcategory: string, label: string, total: number, incomplete: number }> }
interface ListResult { items: ApiItem[], total: number, stats: { global: Stats, scope: Stats }, facets: Facet[] }

// Champs éditables d'une fiche ; `original` sert à détecter les modifications.
interface Fields { name: string, descFr: string, en: string, enDesc: string, es: string, esDesc: string, wikiName: string }
interface Row { item: ApiItem, fields: Fields, original: Fields }
// FR manquant : un objet du wiki garde en base son nom (et sa description) anglais faute
// de FR ; le champ est alors présenté vide, la valeur anglaise en indication.
const toFields = (i: ApiItem): Fields => ({
  name: i.missing.includes('frName') ? '' : i.name,
  descFr: i.missing.includes('frDesc') ? '' : i.descFr || '',
  en: i.en || '',
  enDesc: i.enDesc || '',
  es: i.es || '',
  esDesc: i.esDesc || '',
  wikiName: i.wikiName || ''
})
// FR envoyé à l'enregistrement : un champ FR manquant laissé vide garde la valeur en base.
const frPayload = (i: ApiItem, f: Fields) => ({
  name: f.name || i.name,
  description: f.descFr || (i.missing.includes('frDesc') ? i.descFr ?? '' : '')
})
const isDirty = (r: Row) => (Object.keys(r.fields) as Array<keyof Fields>).some(k => r.fields[k] !== r.original[k])

// --- Filtres (conservés dans l'URL) ---
const route = useRoute()
const router = useRouter()
const queryText = (k: string) => typeof route.query[k] === 'string' ? route.query[k] as string : ''
const queryList = (k: string) => queryText(k).split(',').filter(Boolean)
const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T => (allowed as readonly string[]).includes(v) ? v as T : fallback

const status = ref(pick(queryText('status'), ['incomplete', 'names', 'descriptions', 'suspicious', 'all'] as const, 'incomplete'))
const statusOptions = [
  { value: 'incomplete' as const, label: 'Incomplets' },
  { value: 'names' as const, label: 'Noms manquants' },
  { value: 'descriptions' as const, label: 'Descriptions manquantes' },
  { value: 'suspicious' as const, label: 'Suspects' },
  { value: 'all' as const, label: 'Tous' }
]
const source = ref(pick(queryText('source'), ['all', 'official', 'wiki'] as const, 'all'))
const sourceOptions = [
  { value: 'all', label: 'Toutes les sources' },
  { value: 'official', label: 'Officiels (imports)' },
  { value: 'wiki', label: 'Items du wiki' }
]
// Langues dont il manque quelque chose (nom ou description) : FR, EN, ES, cumulables.
const langs = ref(queryList('langs').filter((l): l is 'fr' | 'en' | 'es' => ['fr', 'en', 'es'].includes(l)))
const langOptions = [
  { value: 'fr' as const, label: 'FR' },
  { value: 'en' as const, label: 'EN' },
  { value: 'es' as const, label: 'ES' }
]
const gapLang = (g: Gap) => g.slice(0, 2) as 'fr' | 'en' | 'es'
function toggleLang(l: 'fr' | 'en' | 'es') {
  if (!confirmDiscard()) return
  langs.value = langs.value.includes(l) ? langs.value.filter(x => x !== l) : [...langs.value, l]
}
const categories = ref<string[]>(queryList('categories'))
const subcategories = ref<string[]>(queryList('subcategories'))
const q = ref(queryText('q'))
const page = ref(Math.max(1, Number(queryText('page')) || 1))
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

// URL de la page = filtres courants (valeurs par défaut omises), sans ajouter d'historique.
function syncUrl() {
  const query: Record<string, string> = {}
  if (status.value !== 'incomplete') query.status = status.value
  if (source.value !== 'all') query.source = source.value
  if (langs.value.length) query.langs = langs.value.join(',')
  if (categories.value.length) query.categories = categories.value.join(',')
  if (subcategories.value.length) query.subcategories = subcategories.value.join(',')
  if (q.value.trim()) query.q = q.value.trim()
  if (page.value > 1) query.page = String(page.value)
  router.replace({ query })
}

async function load() {
  syncUrl()
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
    fr: frPayload(r.item, r.fields),
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
    toast.add({ title: `Enregistré : ${r.fields.name || r.item.name}`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement', color: 'error' })
  } finally {
    savingId.value = null
  }
}

// --- Modale d'édition (clic sur l'image) : image en grand + champs, sur une copie ---
const zoom = ref<{ row: Row, fields: Fields } | null>(null)
const zoomOpen = computed({
  get: () => !!zoom.value,
  set: (v) => {
    if (!v) zoom.value = null
  }
})
const ZOOM_FIELDS: Array<{ key: keyof Fields, long: boolean }> = [
  { key: 'name', long: false }, { key: 'descFr', long: true },
  { key: 'en', long: false }, { key: 'enDesc', long: true },
  { key: 'es', long: false }, { key: 'esDesc', long: true },
  { key: 'wikiName', long: false }
]
// Indication grisée d'un champ vide (mêmes règles que sur la fiche).
function placeholderFor(i: ApiItem, f: Fields, k: keyof Fields): string {
  if (k === 'name') return i.missing.includes('frName') ? i.name : '—'
  if (k === 'descFr') return i.missing.includes('frDesc') ? i.descFr || '—' : '—'
  if (k === 'en' || k === 'es') return f.name || i.name
  if (k === 'wikiName') return f.en || i.en || i.name
  return f.descFr || i.descFr || '—'
}
// Collage d'un texte sur plusieurs lignes (OCR d'une capture du jeu) : les retours à la
// ligne deviennent une espace, pour obtenir le nom ou la description d'une seule ligne.
function pasteOneLine(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text/plain')
  const el = e.target as HTMLInputElement | HTMLTextAreaElement | null
  if (!text || !/[\r\n]/.test(text) || !el || !('setRangeText' in el)) return
  e.preventDefault()
  el.setRangeText(text.replace(/\s*[\r\n]+\s*/g, ' ').trim(), el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end')
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// --- Lecture d'une capture du jeu (OCR) : titre + description d'une langue ---
const NAME_KEY: Record<ItemOcrLang, keyof Fields> = { fr: 'name', en: 'en', es: 'es' }
const DESC_KEY: Record<ItemOcrLang, keyof Fields> = { fr: 'descFr', en: 'enDesc', es: 'esDesc' }
const LANG_OF: Partial<Record<keyof Fields, ItemOcrLang>> = { name: 'fr', descFr: 'fr', en: 'en', enDesc: 'en', es: 'es', esDesc: 'es' }
const ocrBusy = ref<ItemOcrLang | null>(null)

async function ocrInto(image: Blob, fields: Fields, lang: ItemOcrLang) {
  if (ocrBusy.value) return
  ocrBusy.value = lang
  try {
    const { name, description } = await recognizeItemCapture(image, lang)
    if (!name && !description) {
      toast.add({ title: 'Aucun texte reconnu sur la capture', color: 'warning' })
      return
    }
    if (name) fields[NAME_KEY[lang]] = name
    if (description) fields[DESC_KEY[lang]] = description
    toast.add({ title: `Capture ${lang.toUpperCase()} lue : ${name || '(sans titre)'}`, description: 'Vérifiez le texte avant de valider.', color: 'success' })
  } catch {
    toast.add({ title: 'Lecture de la capture impossible', color: 'error' })
  } finally {
    ocrBusy.value = null
  }
}

// Collage dans un champ : une image (capture du jeu) est lue par OCR dans la langue du
// champ ; un texte sur plusieurs lignes est remis sur une ligne.
function onFieldPaste(e: ClipboardEvent, fields: Fields, key: keyof Fields) {
  const image = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile()
  const lang = LANG_OF[key]
  if (image && lang) {
    e.preventDefault()
    ocrInto(image, fields, lang)
    return
  }
  pasteOneLine(e)
}

const ocrFileInput = ref<HTMLInputElement | null>(null)
const ocrFileLang = ref<ItemOcrLang>('fr')
// Bouton « Capture » : l'image du presse-papier (capture Win+Maj+S…) si le navigateur la
// donne, sinon choix d'un fichier.
async function captureFromClipboard(lang: ItemOcrLang) {
  if (!zoom.value) return
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find(t => t.startsWith('image/'))
      if (type) return ocrInto(await item.getType(type), zoom.value.fields, lang)
    }
    toast.add({ title: 'Pas d\'image dans le presse-papier', description: 'Choisissez un fichier.', color: 'info' })
  } catch {
    // Accès au presse-papier refusé ou non pris en charge : choix d'un fichier.
  }
  ocrFileLang.value = lang
  ocrFileInput.value?.click()
}
function onOcrFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file && zoom.value) ocrInto(file, zoom.value.fields, ocrFileLang.value)
}

function openZoom(r: Row) {
  zoom.value = { row: r, fields: { ...r.fields } }
}
const zoomIndex = computed(() => zoom.value ? rows.value.indexOf(zoom.value.row) : -1)
const zoomChanged = computed(() => !!zoom.value && (Object.keys(zoom.value.fields) as Array<keyof Fields>).some(k => zoom.value!.fields[k] !== zoom.value!.row.fields[k]))
const zoomHasNext = computed(() => zoomIndex.value < rows.value.length - 1 || page.value * PAGE_SIZE < (data.value?.total ?? 0))

// Objet précédent / suivant de la liste (page suivante ou précédente au besoin).
async function zoomGo(step: 1 | -1, force = false) {
  if (!zoom.value) return
  if (!force && zoomChanged.value && !confirm('Abandonner les modifications de cet objet ?')) return
  const i = zoomIndex.value + step
  if (i >= 0 && i < rows.value.length) return openZoom(rows.value[i]!)
  if (!confirmDiscard()) return
  if (step === 1) {
    // Les objets complétés sortent du filtre et décalent la liste : on recharge d'abord la
    // page courante, où ont pu remonter des objets pas encore vus.
    const seen = new Set(rows.value.map(r => r.item.itemKey))
    await load()
    const fresh = rows.value.find(r => !seen.has(r.item.itemKey))
    if (fresh) return openZoom(fresh)
    if (page.value * PAGE_SIZE >= (data.value?.total ?? 0)) {
      zoom.value = null
      return
    }
  } else if (page.value === 1) {
    return
  }
  page.value += step
  await load()
  const next = step === 1 ? rows.value[0] : rows.value[rows.value.length - 1]
  if (next) openZoom(next)
  else zoom.value = null
}

async function validateZoom(thenNext = false) {
  const z = zoom.value
  if (!z) return
  Object.assign(z.row.fields, z.fields)
  if (isDirty(z.row)) await saveOne(z.row)
  // Erreur d'enregistrement (déjà signalée) : la modale reste ouverte.
  if (isDirty(z.row)) return
  if (thenNext && zoomHasNext.value) await zoomGo(1, true)
  else zoom.value = null
}

function scopeLabel(i: ApiItem): string {
  const f = data.value?.facets.find(x => x.category === i.category)
  const s = f?.subcategories.find(x => x.subcategory === (i.subcategory ?? ''))
  return `${f?.label ?? i.category}${i.subcategory ? ` / ${s?.label ?? i.subcategory}` : ''}`
}

// --- Statistiques cliquables : appliquent le filtre correspondant ---
type StatKey = 'all' | 'incomplete' | 'suspicious' | Gap
function statFilter(k: StatKey): { status: typeof status.value, langs: Array<'fr' | 'en' | 'es'> } {
  if (k === 'all' || k === 'incomplete' || k === 'suspicious') return { status: k, langs: [] }
  return { status: k.endsWith('Desc') ? 'descriptions' : 'names', langs: [k.slice(0, 2) as 'fr' | 'en' | 'es'] }
}
function isStatActive(k: StatKey): boolean {
  const f = statFilter(k)
  return status.value === f.status && langs.value.length === f.langs.length && f.langs.every(l => langs.value.includes(l))
}
function applyStat(k: StatKey) {
  if (isStatActive(k) || !confirmDiscard()) return
  const f = statFilter(k)
  status.value = f.status
  langs.value = f.langs
}

// --- Aperçu commun des modifications en lot (import CSV, réponse d'IA) ---
const FIELD_LABELS: Record<keyof Fields, string> = {
  name: 'FR — nom',
  descFr: 'FR — description',
  en: 'EN — nom',
  enDesc: 'EN — description',
  es: 'ES — nom',
  esDesc: 'ES — description',
  wikiName: 'Nom wiki.gg'
}
interface BulkChange { key: string, item: ApiItem, before: Fields, after: Fields, changed: Array<keyof Fields>, selected: boolean }
const bulk = ref<{ title: string, changes: BulkChange[], unknown: string[], invalid: number } | null>(null)
const bulkOpen = computed({
  get: () => !!bulk.value,
  set: (v: boolean) => { if (!v) bulk.value = null }
})
const bulkSelected = computed(() => bulk.value?.changes.filter(c => c.selected) ?? [])
const applyingBulk = ref(false)

// Compare des modifications (par clé) aux valeurs actuelles en base et ouvre l'aperçu.
async function openBulkPreview(title: string, patches: Map<string, Partial<Fields>>, invalid = 0) {
  const keys = [...patches.keys()]
  if (!keys.length) {
    toast.add({ title: 'Aucune modification exploitable', color: 'warning' })
    return
  }
  const { items } = await $fetch<{ items: ApiItem[] }>('/api/admin/chest-item-translations/lookup', { method: 'POST', body: { keys } })
  const byKey = new Map(items.map(i => [i.itemKey, i]))
  const changes: BulkChange[] = []
  for (const [key, patch] of patches) {
    const item = byKey.get(key)
    if (!item) continue
    const before = toFields(item)
    const after = { ...before }
    for (const [f, v] of Object.entries(patch) as Array<[keyof Fields, string | undefined]>) {
      if (typeof v === 'string') after[f] = v.trim()
    }
    // Un objet garde toujours un nom FR : un nom FR vide est ignoré. Un FR manquant
    // (présenté vide) qui reçoit sa valeur actuelle en base (l'anglais) reste manquant.
    if (!after.name || after.name === item.name) after.name = before.name
    if (!before.descFr && after.descFr === (item.descFr ?? '')) after.descFr = before.descFr
    const changed = (Object.keys(FIELD_LABELS) as Array<keyof Fields>).filter(f => after[f] !== before[f])
    if (changed.length) changes.push({ key, item, before, after, changed, selected: true })
  }
  bulk.value = { title, changes, unknown: keys.filter(k => !byKey.has(k)), invalid }
}

async function applyBulk() {
  const list = bulkSelected.value
  if (!list.length) return
  applyingBulk.value = true
  try {
    for (let i = 0; i < list.length; i += 500) {
      const entries = list.slice(i, i + 500).map(c => ({
        itemKey: c.key,
        fr: frPayload(c.item, c.after),
        translations: [
          { locale: 'en', name: c.after.en, description: c.after.enDesc },
          { locale: 'es', name: c.after.es, description: c.after.esDesc }
        ],
        wikiName: c.after.wikiName
      }))
      await $fetch('/api/admin/chest-item-translations', { method: 'PUT', body: { entries } })
    }
    toast.add({ title: `${list.length} objet(s) mis à jour`, color: 'success' })
    // Traduction par IA en cours : les objets traités sortent de la liste, le lot suivant
    // devient le lot courant (avant de fermer l'aperçu, qui rouvre la modale IA).
    if (aiResume.value) {
      aiItems.value = await fetchAllFiltered()
      aiAnswer.value = ''
      aiBatch.value = Math.min(aiBatch.value, aiBatchCount.value - 1)
    }
    bulk.value = null
    await load()
  } catch {
    toast.add({ title: 'Erreur lors de l\'application', color: 'error' })
  } finally {
    applyingBulk.value = false
  }
}

// Tous les objets du filtre courant (sans pagination) : export CSV, prompt IA.
async function fetchAllFiltered(): Promise<ApiItem[]> {
  const res = await $fetch<ListResult>('/api/admin/chest-item-translations/list', {
    query: {
      status: status.value,
      source: source.value,
      langs: langs.value.join(','),
      categories: categories.value.join(','),
      subcategories: subcategories.value.join(','),
      q: q.value.trim(),
      all: '1'
    }
  })
  return res.items
}

// --- Export / import CSV (séparateur « ; », UTF-8 avec BOM pour Excel) ---
const CSV_COLUMNS: Array<{ header: string, field?: keyof Fields, get: (i: ApiItem) => string }> = [
  { header: 'cle', get: i => i.itemKey },
  { header: 'categorie', get: i => i.category },
  { header: 'sous_categorie', get: i => i.subcategory ?? '' },
  { header: 'source', get: i => i.source },
  { header: 'fr_nom', field: 'name', get: i => toFields(i).name },
  { header: 'fr_description', field: 'descFr', get: i => toFields(i).descFr },
  { header: 'en_nom', field: 'en', get: i => i.en ?? '' },
  { header: 'en_description', field: 'enDesc', get: i => i.enDesc ?? '' },
  { header: 'es_nom', field: 'es', get: i => i.es ?? '' },
  { header: 'es_description', field: 'esDesc', get: i => i.esDesc ?? '' },
  { header: 'nom_wiki_gg', field: 'wikiName', get: i => i.wikiName ?? '' },
  { header: 'manques', get: i => i.missing.map(g => GAP_LABELS[g]).join(', ') },
  { header: 'suspects', get: i => i.suspects.map(x => SUSPECT_LABELS[x]).join(', ') }
]
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`
const exporting = ref(false)

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

async function exportCsv() {
  exporting.value = true
  try {
    const items = await fetchAllFiltered()
    const lines = [CSV_COLUMNS.map(c => csvCell(c.header)).join(';'), ...items.map(i => CSV_COLUMNS.map(c => csvCell(c.get(i))).join(';'))]
    download(`traductions-objets-${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + lines.join('\r\n') + '\r\n', 'text/csv;charset=utf-8')
    toast.add({ title: `${items.length} objet(s) exporté(s)`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de l\'export', color: 'error' })
  } finally {
    exporting.value = false
  }
}

// Lecture CSV (guillemets, guillemets doublés, retours à la ligne dans une cellule) ;
// séparateur détecté sur l'en-tête (« ; », « , » ou tabulation).
function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const firstLine = src.slice(0, src.indexOf('\n') > -1 ? src.indexOf('\n') : undefined)
  const sep = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]!
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      if (row.some(c => c !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  row.push(cell)
  if (row.some(c => c !== '')) rows.push(row)
  return rows
}

const csvFileInput = ref<HTMLInputElement | null>(null)
async function onCsvFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const [header, ...lines] = parseCsv(await file.text())
    const idx = (h: string) => header?.indexOf(h) ?? -1
    const keyCol = idx('cle')
    if (keyCol < 0) {
      toast.add({ title: 'Colonne « cle » introuvable', description: 'Utilisez le fichier produit par l\'export CSV.', color: 'error' })
      return
    }
    const editable = CSV_COLUMNS.filter(c => c.field && idx(c.header) >= 0)
    const patches = new Map<string, Partial<Fields>>()
    let invalid = 0
    for (const line of lines) {
      const key = line[keyCol]?.trim()
      if (!key) {
        invalid++
        continue
      }
      const patch: Partial<Fields> = {}
      for (const c of editable) patch[c.field!] = line[idx(c.header)] ?? ''
      patches.set(key, patch)
    }
    await openBulkPreview(`Import CSV — ${file.name}`, patches, invalid)
  } catch {
    toast.add({ title: 'Fichier CSV illisible', color: 'error' })
  }
}

// --- Traduction par IA (prompt par lots, réponse JSON collée -> aperçu commun) ---
const aiOpen = ref(false)
const aiLangs = ref<Array<'fr' | 'en' | 'es'>>(['es'])
const aiBatchSize = ref(40)
const aiItems = ref<ApiItem[]>([])
const aiBatch = ref(0)
const aiAnswer = ref('')
const aiLoading = ref(false)
// La modale IA est masquée pendant l'aperçu (deux modales superposées bloquent les clics),
// puis rouverte à sa fermeture.
const aiResume = ref(false)
watch(bulk, (v) => {
  if (!v && aiResume.value) {
    aiResume.value = false
    aiOpen.value = true
  }
})
const LANG_NAMES = { fr: 'français', en: 'anglais', es: 'espagnol' } as const
type LangField = { lang: 'fr' | 'en' | 'es', part: 'name' | 'description' }
const FIELD_OF: Record<string, keyof Fields> = { 'fr.name': 'name', 'fr.description': 'descFr', 'en.name': 'en', 'en.description': 'enDesc', 'es.name': 'es', 'es.description': 'esDesc' }

// Champs à faire compléter pour un objet : manques et traductions suspectes des langues choisies.
function requested(i: ApiItem): LangField[] {
  const out: LangField[] = []
  for (const lang of aiLangs.value) {
    const name = i.missing.includes(`${lang}Name` as Gap) || i.suspects.includes(`${lang}Name` as Suspect)
    const desc = i.missing.includes(`${lang}Desc` as Gap) || i.suspects.includes(`${lang}Desc` as Suspect)
    if (name) out.push({ lang, part: 'name' })
    if (desc) out.push({ lang, part: 'description' })
  }
  return out
}
const aiTodo = computed(() => aiItems.value.filter(i => requested(i).length))
const aiBatchCount = computed(() => Math.max(1, Math.ceil(aiTodo.value.length / aiBatchSize.value)))
const aiCurrent = computed(() => aiTodo.value.slice(aiBatch.value * aiBatchSize.value, (aiBatch.value + 1) * aiBatchSize.value))

async function openAi() {
  aiOpen.value = true
  aiBatch.value = 0
  aiAnswer.value = ''
  if (langs.value.length) aiLangs.value = [...langs.value]
  aiLoading.value = true
  try {
    aiItems.value = await fetchAllFiltered()
  } catch {
    toast.add({ title: 'Erreur de chargement', color: 'error' })
  } finally {
    aiLoading.value = false
  }
}
watch([aiLangs, aiBatchSize], () => {
  aiBatch.value = 0
}, { deep: true })

function buildAiPrompt(): string {
  const objects = aiCurrent.value.map(i => ({
    key: i.itemKey,
    categorie: scopeLabel(i),
    fr: { name: toFields(i).name || null, description: toFields(i).descFr || null },
    en: { name: i.en, description: i.enDesc },
    es: { name: i.es, description: i.esDesc },
    a_completer: requested(i).map(f => `${f.lang}.${f.part}`)
  }))
  return [
    'Tu es un traducteur expert du jeu vidéo Sea of Thieves (Rare).',
    `Pour chaque objet cosmétique ci-dessous, complète UNIQUEMENT les champs listés dans « a_completer » (${aiLangs.value.map(l => LANG_NAMES[l]).join(', ')}).`,
    'Utilise le nom et la description OFFICIELS du jeu dans cette langue si tu les connais ; sinon, traduis fidèlement depuis les autres langues en respectant le style et la terminologie du jeu (noms propres de sets, de factions et de personnages conservés tels quels).',
    'Si tu n\'es pas sûr, mets null plutôt que d\'inventer.',
    'Réponds UNIQUEMENT avec un tableau JSON, sans aucun texte autour, au format :',
    '[{"key": "…", "es": {"name": "…", "description": "…"}}]  (seulement les langues et champs demandés)',
    '',
    'Objets :',
    JSON.stringify(objects, null, 1)
  ].join('\n')
}

async function copyAiPrompt() {
  try {
    await navigator.clipboard.writeText(buildAiPrompt())
    toast.add({ title: `Prompt du lot ${aiBatch.value + 1}/${aiBatchCount.value} copié`, description: 'Collez-le dans une IA, puis sa réponse JSON ci-dessous.', color: 'success' })
  } catch {
    toast.add({ title: 'Impossible de copier automatiquement', color: 'error' })
  }
}

async function analyzeAiAnswer() {
  const text = aiAnswer.value.trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  let data: unknown
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    toast.add({ title: 'JSON invalide', description: 'Vérifiez que la réponse a été collée en entier.', color: 'error' })
    return
  }
  if (!Array.isArray(data)) return
  // Seuls les champs demandés pour les objets du lot sont pris en compte.
  const batch = new Map(aiCurrent.value.map(i => [i.itemKey, new Set(requested(i).map(f => `${f.lang}.${f.part}`))]))
  const patches = new Map<string, Partial<Fields>>()
  let invalid = 0
  for (const entry of data as Array<Record<string, unknown>>) {
    const key = typeof entry?.key === 'string' ? entry.key : ''
    const wanted = batch.get(key)
    if (!wanted) {
      invalid++
      continue
    }
    const patch: Partial<Fields> = {}
    for (const lang of ['fr', 'en', 'es'] as const) {
      const v = entry[lang] as { name?: unknown, description?: unknown } | undefined
      for (const part of ['name', 'description'] as const) {
        const val = v?.[part]
        if (typeof val === 'string' && val.trim() && wanted.has(`${lang}.${part}`)) patch[FIELD_OF[`${lang}.${part}`]!] = val
      }
    }
    if (Object.keys(patch).length) patches.set(key, patch)
  }
  aiResume.value = true
  aiOpen.value = false
  await openBulkPreview(`Traductions IA — lot ${aiBatch.value + 1}/${aiBatchCount.value}`, patches, invalid)
  if (!bulk.value) {
    aiResume.value = false
    aiOpen.value = true
  }
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

// Doublons wiki / officiel (« X Emote » du wiki = « X » du jeu…) : fusion dans l'officiel.
interface WikiDuplicateMerge { count: number, ambiguous: number, samples: Array<{ wikiTitle: string, official: string, officialEn: string, image: string | null, transferred: string[] }> }
const mergePreview = ref<WikiDuplicateMerge | null>(null)
const merging = ref(false)

async function runWikiMerge(apply: boolean) {
  if (apply && !confirm(`Fusionner ${mergePreview.value?.count ?? 0} item(s) wiki dans leur objet officiel puis les supprimer ?`)) return
  merging.value = true
  try {
    const res = await $fetch<WikiDuplicateMerge>('/api/admin/chest-item-translations/merge-wiki-duplicates', {
      method: 'POST',
      body: { apply }
    })
    if (apply) {
      toast.add({ title: `${res.count} doublon(s) fusionné(s)`, color: 'success' })
      mergePreview.value = null
      await load()
    } else {
      mergePreview.value = res
    }
  } catch {
    toast.add({ title: 'Erreur lors de la fusion', color: 'error' })
  } finally {
    merging.value = false
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
            Noms et descriptions FR / EN / ES des objets du coffre, et leur nom wiki.gg (titre de leur
            page sur wiki.gg quand il diffère du nom anglais). Le FR des objets officiels est réécrit
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
      class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 mb-6"
    >
      <UCard
        :ui="{ body: 'p-3 sm:p-3' }"
        class="cursor-pointer hover:ring-2 hover:ring-primary/40"
        :class="isStatActive('all') ? 'ring-2 ring-primary' : ''"
        @click="applyStat('all')"
      >
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
      <UCard
        :ui="{ body: 'p-3 sm:p-3' }"
        class="cursor-pointer hover:ring-2 hover:ring-primary/40"
        :class="isStatActive('incomplete') ? 'ring-2 ring-primary' : ''"
        @click="applyStat('incomplete')"
      >
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
        class="cursor-pointer hover:ring-2 hover:ring-primary/40"
        :class="[isStatActive(gap) ? 'ring-2 ring-primary' : '', langs.length && !langs.includes(gapLang(gap)) ? 'opacity-50' : '']"
        @click="applyStat(gap)"
      >
        <p class="text-xs text-muted">
          {{ label }} manquant{{ gap.endsWith('Desc') ? 'e' : '' }}
        </p>
        <p
          v-if="langs.length && !langs.includes(gapLang(gap))"
          class="text-xl font-semibold text-muted"
          title="Langue hors du filtre « Traduction manquante »"
        >
          —
        </p>
        <p
          v-else
          class="text-xl font-semibold"
          :class="data.stats.scope.missing[gap] ? '' : 'text-success'"
        >
          {{ data.stats.scope.missing[gap] }}
        </p>
      </UCard>
      <UTooltip text="Traductions probablement copiées de l'anglais (FR ou ES identique à l'EN)">
        <UCard
          :ui="{ body: 'p-3 sm:p-3' }"
          class="cursor-pointer hover:ring-2 hover:ring-primary/40"
          :class="isStatActive('suspicious') ? 'ring-2 ring-primary' : ''"
          @click="applyStat('suspicious')"
        >
          <p class="text-xs text-muted">
            Suspects
          </p>
          <p
            class="text-xl font-semibold"
            :class="data.stats.scope.suspicious ? 'text-error' : 'text-success'"
          >
            {{ data.stats.scope.suspicious }}
          </p>
        </UCard>
      </UTooltip>
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
          placeholder="Rechercher par nom (FR, EN, ES ou nom wiki.gg)…"
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
        <UButton
          icon="i-lucide-sparkles"
          label="Traduire avec l'IA"
          variant="soft"
          :disabled="!data?.total"
          @click="openAi"
        />
        <UButton
          icon="i-lucide-file-down"
          label="Exporter CSV"
          variant="soft"
          color="neutral"
          :loading="exporting"
          :disabled="!data?.total"
          @click="exportCsv"
        />
        <input
          ref="csvFileInput"
          type="file"
          accept=".csv,text/csv"
          class="hidden"
          @change="onCsvFile"
        >
        <UButton
          icon="i-lucide-file-up"
          label="Importer CSV"
          variant="soft"
          color="neutral"
          @click="csvFileInput?.click()"
        />
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
          <button
            v-if="r.item.image"
            type="button"
            class="shrink-0 rounded cursor-zoom-in hover:ring-2 hover:ring-primary"
            title="Agrandir et éditer"
            @click="openZoom(r)"
          >
            <ChestItemImage
              :src="r.item.image"
              :alt="r.item.name"
              :size="56"
              format="webp"
              loading="lazy"
              class="w-14 h-14 rounded object-contain bg-elevated"
            />
          </button>
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
              <UBadge
                v-for="x in r.item.suspects"
                :key="x"
                color="error"
                variant="subtle"
                size="sm"
                title="Probablement une copie non traduite de l'anglais"
              >
                {{ SUSPECT_LABELS[x] }}
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
                  :placeholder="r.item.missing.includes('frName') ? r.item.name : '—'"
                  class="w-full"
                  @paste="onFieldPaste($event, r.fields, 'name')"
                />
              </UFormField>
              <UFormField label="FR — description">
                <UTextarea
                  v-model="r.fields.descFr"
                  :rows="2"
                  autoresize
                  :placeholder="r.item.missing.includes('frDesc') ? r.item.descFr || '—' : '—'"
                  class="w-full"
                  @paste="onFieldPaste($event, r.fields, 'descFr')"
                />
              </UFormField>
              <UFormField label="EN — nom">
                <UInput
                  v-model="r.fields.en"
                  :placeholder="r.fields.name || r.item.name"
                  class="w-full"
                  @paste="onFieldPaste($event, r.fields, 'en')"
                />
              </UFormField>
              <UFormField label="EN — description">
                <UTextarea
                  v-model="r.fields.enDesc"
                  :rows="2"
                  autoresize
                  :placeholder="r.fields.descFr || r.item.descFr || '—'"
                  class="w-full"
                  @paste="onFieldPaste($event, r.fields, 'enDesc')"
                />
              </UFormField>
              <UFormField label="ES — nom">
                <UInput
                  v-model="r.fields.es"
                  :placeholder="r.fields.name || r.item.name"
                  class="w-full"
                  @paste="onFieldPaste($event, r.fields, 'es')"
                />
              </UFormField>
              <UFormField label="ES — description">
                <UTextarea
                  v-model="r.fields.esDesc"
                  :rows="2"
                  autoresize
                  :placeholder="r.fields.descFr || r.item.descFr || '—'"
                  class="w-full"
                  @paste="onFieldPaste($event, r.fields, 'esDesc')"
                />
              </UFormField>
              <UFormField
                label="Nom wiki.gg"
                help="Titre de la page sur wiki.gg s'il diffère du nom anglais (rapprochement). Vide = nom anglais."
                class="sm:col-span-2"
              >
                <UInput
                  v-model="r.fields.wikiName"
                  :placeholder="r.fields.en || r.item.en || r.item.name"
                  class="w-full"
                  @paste="onFieldPaste($event, r.fields, 'wikiName')"
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
                {{ restorePreview.wikiNamesKept }} ancien(s) nom(s) anglais conservé(s) comme nom wiki.gg
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
                  > (ancien nom gardé comme nom wiki.gg)</span>
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

          <div class="space-y-2 pt-4 border-t border-muted/20">
            <p class="font-medium">
              Fusionner les doublons wiki / officiels
            </p>
            <p class="text-muted">
              Items créés depuis le wiki qui existent déjà en objet officiel sous un nom proche
              (le wiki ajoute « Emote » aux attitudes, omet la qualité des trophées…). L'objet
              officiel récupère ce qui lui manque (coût, prérequis, traduction ES, possesseurs) et
              le titre de la page wiki comme nom wiki.gg, puis l'item wiki est supprimé.
            </p>
            <UButton
              icon="i-lucide-search"
              label="Voir les doublons"
              size="sm"
              variant="soft"
              :loading="merging && !mergePreview"
              @click="runWikiMerge(false)"
            />
            <template v-if="mergePreview">
              <p>
                <strong>{{ mergePreview.count }}</strong> doublon(s) à fusionner
                <span
                  v-if="mergePreview.ambiguous"
                  class="text-muted"
                > · {{ mergePreview.ambiguous }} ambigu(s) (plusieurs objets officiels possibles), à traiter sur la page des items du wiki</span>
              </p>
              <ul
                v-if="mergePreview.samples.length"
                class="text-xs space-y-1 max-h-72 overflow-y-auto"
              >
                <li
                  v-for="(sm, i) in mergePreview.samples"
                  :key="i"
                  class="flex items-center gap-2"
                >
                  <ChestItemImage
                    v-if="sm.image"
                    :src="sm.image"
                    :alt="sm.official"
                    :size="28"
                    format="webp"
                    loading="lazy"
                    class="w-7 h-7 object-contain rounded bg-elevated shrink-0"
                  />
                  <span>
                    <span class="text-muted">{{ sm.wikiTitle }}</span>
                    → <span class="font-medium">{{ sm.official }}</span>
                    <span class="text-muted"> ({{ sm.officialEn }})</span>
                    <span
                      v-if="sm.transferred.length"
                      class="text-success"
                    > · reprend : {{ sm.transferred.join(', ') }}</span>
                  </span>
                </li>
              </ul>
              <p
                v-if="mergePreview.count > mergePreview.samples.length"
                class="text-xs text-muted"
              >
                … et {{ mergePreview.count - mergePreview.samples.length }} autre(s).
              </p>
              <UButton
                icon="i-lucide-merge"
                :label="`Fusionner (${mergePreview.count})`"
                color="success"
                size="sm"
                :loading="merging"
                :disabled="!mergePreview.count"
                @click="runWikiMerge(true)"
              />
            </template>
          </div>
        </div>
      </template>
    </UModal>
    <!-- Édition d'un objet avec son image en grand -->
    <UModal
      v-model:open="zoomOpen"
      :title="zoom ? zoom.row.item.name : ''"
      :description="zoom ? scopeLabel(zoom.row.item) : ''"
      :ui="{ content: 'sm:max-w-5xl' }"
    >
      <template #body>
        <div
          v-if="zoom"
          class="flex flex-col md:flex-row gap-4"
        >
          <ChestItemImage
            v-if="zoom.row.item.image"
            :src="zoom.row.item.image"
            :alt="zoom.row.item.name"
            :size="320"
            format="webp"
            class="w-full max-w-80 md:w-80 aspect-square object-contain rounded bg-elevated self-center md:self-start shrink-0"
          />
          <div class="flex-1 min-w-0 grid gap-2 sm:grid-cols-2">
            <div class="sm:col-span-2 flex flex-wrap items-center gap-2">
              <input
                ref="ocrFileInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onOcrFile"
              >
              <UButton
                v-for="l in (['fr', 'en', 'es'] as const)"
                :key="l"
                icon="i-lucide-scan-text"
                :label="`Coller capture ${l.toUpperCase()}`"
                size="xs"
                color="neutral"
                variant="outline"
                :loading="ocrBusy === l"
                :disabled="!!ocrBusy"
                @click="captureFromClipboard(l)"
              />
              <span class="text-xs text-muted">image du presse-papier (sinon choix d'un fichier), ou Ctrl+V d'une capture dans un champ de la langue</span>
            </div>
            <UFormField
              v-for="f in ZOOM_FIELDS"
              :key="f.key"
              :label="FIELD_LABELS[f.key]"
              :class="f.key === 'wikiName' ? 'sm:col-span-2' : ''"
            >
              <UTextarea
                v-if="f.long"
                v-model="zoom.fields[f.key]"
                :rows="3"
                autoresize
                :placeholder="placeholderFor(zoom.row.item, zoom.fields, f.key)"
                class="w-full"
                @paste="onFieldPaste($event, zoom.fields, f.key)"
              />
              <UInput
                v-else
                v-model="zoom.fields[f.key]"
                :placeholder="placeholderFor(zoom.row.item, zoom.fields, f.key)"
                class="w-full"
                @paste="onFieldPaste($event, zoom.fields, f.key)"
              />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            label="Précédent"
            color="neutral"
            variant="outline"
            :disabled="zoomIndex <= 0 && page === 1"
            @click="zoomGo(-1)"
          />
          <UButton
            trailing-icon="i-lucide-chevron-right"
            label="Suivant"
            color="neutral"
            variant="outline"
            :disabled="!zoomHasNext"
            @click="zoomGo(1)"
          />
          <span class="text-xs text-muted">
            {{ (page - 1) * PAGE_SIZE + zoomIndex + 1 }} / {{ data?.total ?? 0 }}
          </span>
          <div class="flex-1" />
          <UButton
            label="Annuler"
            color="neutral"
            variant="outline"
            @click="zoom = null"
          />
          <UButton
            icon="i-lucide-check"
            label="Valider"
            color="success"
            variant="soft"
            :loading="!!zoom && savingId === zoom.row.item.id"
            @click="validateZoom()"
          />
          <UButton
            icon="i-lucide-check-check"
            label="Valider et suivant"
            color="success"
            :disabled="!zoomHasNext"
            :loading="!!zoom && savingId === zoom.row.item.id"
            @click="validateZoom(true)"
          />
        </div>
      </template>
    </UModal>

    <!-- Traduction par IA -->
    <UModal
      v-model:open="aiOpen"
      title="Traduire avec l'IA"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-4 text-sm">
          <p class="text-muted">
            Pour les objets du filtre courant : choisissez les langues à compléter, copiez le prompt
            d'un lot dans une IA, collez sa réponse JSON puis vérifiez l'aperçu avant d'appliquer.
            Sont demandés les champs manquants et les traductions suspectes de ces langues.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-muted">Langues à compléter :</span>
            <UButton
              v-for="opt in langOptions"
              :key="opt.value"
              :label="opt.label"
              size="xs"
              :color="aiLangs.includes(opt.value) ? 'primary' : 'neutral'"
              :variant="aiLangs.includes(opt.value) ? 'solid' : 'outline'"
              @click="aiLangs = aiLangs.includes(opt.value) ? aiLangs.filter(l => l !== opt.value) : [...aiLangs, opt.value]"
            />
            <span class="text-xs text-muted ml-2">Taille des lots :</span>
            <USelect
              v-model="aiBatchSize"
              :items="[20, 40, 80]"
              size="xs"
              class="w-20"
            />
          </div>
          <p v-if="aiLoading">
            <UIcon
              name="i-lucide-loader-2"
              class="w-4 h-4 animate-spin align-middle"
            /> Chargement…
          </p>
          <template v-else>
            <p>
              <strong>{{ aiTodo.length }}</strong> objet(s) à compléter, en {{ aiBatchCount }} lot(s).
            </p>
            <div
              v-if="aiTodo.length"
              class="flex flex-wrap items-center gap-2"
            >
              <UButton
                icon="i-lucide-chevron-left"
                size="xs"
                color="neutral"
                variant="outline"
                aria-label="Lot précédent"
                :disabled="aiBatch === 0"
                @click="aiBatch--"
              />
              <span>Lot {{ aiBatch + 1 }} / {{ aiBatchCount }} ({{ aiCurrent.length }} objets)</span>
              <UButton
                icon="i-lucide-chevron-right"
                size="xs"
                color="neutral"
                variant="outline"
                aria-label="Lot suivant"
                :disabled="aiBatch >= aiBatchCount - 1"
                @click="aiBatch++"
              />
              <UButton
                icon="i-lucide-clipboard-copy"
                label="Copier le prompt du lot"
                size="sm"
                variant="soft"
                class="ml-auto"
                @click="copyAiPrompt"
              />
            </div>
            <UTextarea
              v-model="aiAnswer"
              :rows="4"
              autoresize
              :maxrows="12"
              placeholder="Collez ici la réponse JSON de l'IA"
              class="w-full font-mono"
            />
            <UButton
              icon="i-lucide-scan-search"
              label="Analyser la réponse"
              size="sm"
              :disabled="!aiAnswer.trim()"
              @click="analyzeAiAnswer"
            />
          </template>
        </div>
      </template>
    </UModal>

    <!-- Aperçu commun des modifications en lot -->
    <UModal
      v-model:open="bulkOpen"
      :title="bulk?.title ?? 'Aperçu'"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body>
        <div
          v-if="bulk"
          class="space-y-3 text-sm"
        >
          <p>
            <strong>{{ bulk.changes.length }}</strong> objet(s) modifié(s)
            <span v-if="bulk.unknown.length"> · {{ bulk.unknown.length }} clé(s) inconnue(s)</span>
            <span v-if="bulk.invalid"> · {{ bulk.invalid }} entrée(s) ignorée(s)</span>
          </p>
          <p
            v-if="!bulk.changes.length"
            class="text-muted"
          >
            Aucune différence avec la base.
          </p>
          <ul class="space-y-3 max-h-[60vh] overflow-y-auto">
            <li
              v-for="c in bulk.changes"
              :key="c.key"
              class="flex gap-3 border-b border-muted/20 pb-2"
            >
              <UCheckbox
                v-model="c.selected"
                class="mt-1"
              />
              <ChestItemImage
                v-if="c.item.image"
                :src="c.item.image"
                :alt="c.item.name"
                :size="40"
                format="webp"
                loading="lazy"
                class="w-10 h-10 object-contain rounded bg-elevated shrink-0"
              />
              <div class="min-w-0 flex-1">
                <p class="font-medium">
                  {{ c.item.name }} <span class="text-xs text-muted font-normal">· {{ scopeLabel(c.item) }}</span>
                </p>
                <div
                  v-for="f in c.changed"
                  :key="f"
                  class="text-xs"
                >
                  <span class="text-muted">{{ FIELD_LABELS[f] }} :</span>
                  <span class="line-through text-muted">{{ c.before[f] || '—' }}</span>
                  → <span class="font-medium">{{ c.after[f] || '(vide)' }}</span>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Annuler"
            color="neutral"
            variant="outline"
            @click="bulk = null"
          />
          <UButton
            icon="i-lucide-check-check"
            :label="`Appliquer (${bulkSelected.length})`"
            color="success"
            :loading="applyingBulk"
            :disabled="!bulkSelected.length"
            @click="applyBulk"
          />
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
