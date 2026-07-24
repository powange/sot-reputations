<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import type { ReleaseNote } from '~/types/release-notes'

// N'autoriser que les iframes YouTube (embeds des release notes), supprimer les autres
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'iframe') {
    const src = (node as Element).getAttribute?.('src') || ''
    if (!/^https:\/\/www\.youtube\.com\/embed\//.test(src)) {
      node.parentNode?.removeChild(node)
    }
  }
})

const { t, locale } = useI18n()
const toast = useToast()

useSeoMeta({
  title: () => t('releaseNotes.title'),
  description: () => t('releaseNotes.subtitle')
})

const { data: releaseNotes } = await useFetch<ReleaseNote[]>('/api/release-notes')

const route = useRoute()
const router = useRouter()

// Filtres initialisés depuis l'URL (?version=… ou ?q=…) : partageable et
// conservé au rechargement de la page.
const initialQuery = typeof route.query.q === 'string' ? route.query.q : ''
const search = ref(initialQuery)
const debouncedSearch = ref(initialQuery)
const selectedVersion = ref<string | null>(typeof route.query.version === 'string' ? route.query.version : null)
const notesContainer = ref<HTMLElement | null>(null)
const occurrenceCount = ref(0)
const currentOccurrence = ref(0)
const visibleNote = ref<ReleaseNote | null>(null)
// Texte brut (minuscule) des traductions en cache. Déclaré ici (avant
// filteredNotes) car la recherche s'en sert : sinon TDZ en SSR quand ?q= est
// présent (filteredNotes est évalué au setup et lit translatedText).
const translatedText = ref<Record<number, string>>({})

onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const idx = Number((entry.target as HTMLElement).dataset.noteIdx)
        if (filteredNotes.value[idx]) {
          visibleNote.value = filteredNotes.value[idx]
        }
      }
    }
  }, { rootMargin: '-80px 0px -70% 0px' })

  watch(() => filteredNotes.value, () => {
    observer.disconnect()
    visibleNote.value = null
    nextTick(() => {
      if (!notesContainer.value) return
      const cards = notesContainer.value.querySelectorAll('[data-note-idx]')
      cards.forEach(card => observer.observe(card))
    })
  }, { immediate: true })

  onUnmounted(() => observer.disconnect())
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(search, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = val
  }, 400)
})

// Persiste les filtres dans l'URL : ?version=… prioritaire (le champ de recherche
// est désactivé quand une version est choisie), sinon ?q=…. replace() pour ne pas
// empiler une entrée d'historique à chaque changement de filtre.
watch([selectedVersion, debouncedSearch], ([version, q]) => {
  const query: Record<string, string> = {}
  if (version) {
    query.version = version
  } else if (q.trim()) {
    query.q = q.trim()
  }
  router.replace({ query })
})

const filteredNotes = computed(() => {
  if (!releaseNotes.value) return []

  if (selectedVersion.value) {
    return releaseNotes.value.filter(n => n.version === selectedVersion.value)
  }

  if (debouncedSearch.value.trim()) {
    const q = debouncedSearch.value.toLowerCase()
    return releaseNotes.value.filter(n =>
      n.version.includes(q)
      || (n.content && n.content.toLowerCase().includes(q))
      // Aussi dans la traduction si la note a déjà été traduite (cache).
      || (translatedText.value[n.id]?.includes(q) ?? false)
    )
  }

  return []
})

const versionOptions = computed(() => {
  if (!releaseNotes.value) return []
  return releaseNotes.value.map(n => ({
    label: `v${n.display_version || n.version} — ${n.date}`,
    value: n.version
  }))
})

// USelectMenu (avec value-key) attend string | undefined ; on conserve null
// en interne et on convertit null <-> undefined pour le v-model.
const selectedVersionModel = computed({
  get: () => selectedVersion.value ?? undefined,
  set: (value: string | undefined) => {
    selectedVersion.value = value ?? null
  }
})

function clearSelection() {
  selectedVersion.value = null
}

const currentVersionIndex = computed(() => {
  if (!selectedVersion.value || !releaseNotes.value) return -1
  return releaseNotes.value.findIndex(n => n.version === selectedVersion.value)
})

function prevVersion() {
  if (!releaseNotes.value || currentVersionIndex.value <= 0) return
  const prev = releaseNotes.value[currentVersionIndex.value - 1]
  if (prev) selectedVersion.value = prev.version
}

function nextVersion() {
  if (!releaseNotes.value || currentVersionIndex.value >= releaseNotes.value.length - 1) return
  const next = releaseNotes.value[currentVersionIndex.value + 1]
  if (next) selectedVersion.value = next.version
}

function updateOccurrences() {
  nextTick(() => {
    if (!notesContainer.value) {
      occurrenceCount.value = 0
      currentOccurrence.value = 0
      return
    }
    const marks = notesContainer.value.querySelectorAll('mark')
    occurrenceCount.value = marks.length
    if (marks.length > 0) {
      currentOccurrence.value = 1
      scrollToOccurrence(1)
    } else {
      currentOccurrence.value = 0
    }
  })
}

function scrollToOccurrence(index: number) {
  if (!notesContainer.value) return
  const marks = notesContainer.value.querySelectorAll('mark')
  marks.forEach(m => m.classList.remove('ring-2', 'ring-primary'))
  if (index >= 1 && index <= marks.length) {
    const mark = marks[index - 1]
    if (mark) {
      mark.classList.add('ring-2', 'ring-primary')
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
}

function nextOccurrenceFn() {
  if (occurrenceCount.value === 0) return
  currentOccurrence.value = currentOccurrence.value >= occurrenceCount.value ? 1 : currentOccurrence.value + 1
  scrollToOccurrence(currentOccurrence.value)
}

function prevOccurrenceFn() {
  if (occurrenceCount.value === 0) return
  currentOccurrence.value = currentOccurrence.value <= 1 ? occurrenceCount.value : currentOccurrence.value - 1
  scrollToOccurrence(currentOccurrence.value)
}

watch(filteredNotes, () => {
  if (debouncedSearch.value.trim() && !selectedVersion.value) {
    updateOccurrences()
  } else {
    occurrenceCount.value = 0
    currentOccurrence.value = 0
  }
})

// Rendu Markdown -> HTML assaini (sans surbrillance). Sert aussi de base à la
// traduction (on traduit les nœuds texte de ce HTML pour préserver la structure).
function renderMarkdownBase(content: string): string {
  let html = marked.parse(content, { async: false }) as string
  // Sanitiser le HTML (anti-XSS) en conservant les iframes YouTube
  html = DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allowfullscreen', 'frameborder']
  })
  // Ouvrir tous les liens dans un nouvel onglet
  html = html.replace(/<a /g, '<a target="_blank" rel="noopener" ')
  return html
}

function renderMarkdown(content: string): string {
  const html = renderMarkdownBase(content)
  if (!debouncedSearch.value.trim()) return html
  return highlightHtml(html, debouncedSearch.value.trim())
}

function highlightHtml(html: string, query: string): string {
  // Échapper les caractères spéciaux regex
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  // Ne surligner que le texte, pas les balises HTML
  return html.replace(/>([^<]+)</g, (match, text) => {
    return '>' + text.replace(regex, '<mark class="bg-yellow-300 dark:bg-yellow-700 rounded px-0.5">$1</mark>') + '<'
  })
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

// --- Traduction côté client via l'API Translator intégrée (Chrome/Edge) ---
// Le contenu des notes est en anglais ; on le traduit sur l'appareil vers la
// langue de l'interface, à la demande. Aucun serveur, aucune clé, illimité.
interface BrowserTranslator {
  translate: (input: string) => Promise<string>
}
interface TranslatorFactory {
  availability: (opts: { sourceLanguage: string, targetLanguage: string })
  => Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>
  create: (opts: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (m: EventTarget) => void
  }) => Promise<BrowserTranslator>
}

const translateApiPresent = ref(false)
const translated = ref(false)
const translating = ref(false)
const downloadPct = ref<number | null>(null)
// Progression de « Tout traduire » (toutes les versions) : { fait, total } ou null.
const translateAllProgress = ref<{ done: number, total: number } | null>(null)
const translatedHtml = ref<Record<number, string>>({})
// Notes en cours de traduction (pour afficher un loader par note dans l'entête).
const translatingIds = ref<Set<number>>(new Set())
let translator: BrowserTranslator | null = null

// Source = anglais, cible = langue de l'interface (bouton masqué si déjà en anglais).
const targetLang = computed(() => locale.value)
const canTranslate = computed(() =>
  translateApiPresent.value && targetLang.value !== 'en' && filteredNotes.value.length > 0
)
// « Tout traduire » est proposé même sans filtre, dès qu'il y a des notes.
const canTranslateAll = computed(() =>
  translateApiPresent.value && targetLang.value !== 'en' && (releaseNotes.value?.length ?? 0) > 0
)
const translateButtonLabel = computed(() => {
  if (translating.value && translateAllProgress.value === null) {
    return downloadPct.value !== null ? `Téléchargement ${downloadPct.value}%` : 'Traduction…'
  }
  return translated.value ? 'Voir l\'original' : 'Traduire'
})
const translateAllLabel = computed(() => {
  if (translateAllProgress.value) return `Traduction ${translateAllProgress.value.done}/${translateAllProgress.value.total}`
  if (downloadPct.value !== null) return `Téléchargement ${downloadPct.value}%`
  return 'Tout traduire'
})

onMounted(() => {
  translateApiPresent.value = 'Translator' in globalThis
})

// Nouveau filtrage en mode traduit : on reste traduit et on traduit les notes
// nouvellement visibles (celles déjà en cache sont réutilisées instantanément).
watch(filteredNotes, () => {
  if (translated.value) translateVisibleNotes()
})

// Changement de langue d'interface : le cache mémoire et le traducteur ciblent
// l'ancienne langue → on réinitialise (le cache localStorage, lui, est par langue).
watch(targetLang, () => {
  translated.value = false
  translatedHtml.value = {}
  translatedText.value = {}
  translator = null
})

// Recherche active : recompter les occurrences quand on bascule original/traduit
// (le texte affiché change, donc les surbrillances aussi).
watch(translated, () => {
  if (debouncedSearch.value.trim() && !selectedVersion.value) updateOccurrences()
})

// --- Cache persistant des traductions (localStorage), par langue + note ---
// Invalidé si le contenu de la note change (hash), tolérant au quota dépassé.
const CACHE_PREFIX = 'rn-tr'

function contentHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function cacheKey(noteId: number): string {
  return `${CACHE_PREFIX}:${targetLang.value}:${noteId}`
}

function loadTranslation(noteId: number, content: string): string | null {
  try {
    const raw = localStorage.getItem(cacheKey(noteId))
    if (!raw) return null
    const obj = JSON.parse(raw) as { h: string, html: string }
    return obj.h === contentHash(content) ? obj.html : null
  } catch {
    return null
  }
}

function persistTranslation(noteId: number, content: string, html: string): void {
  try {
    localStorage.setItem(cacheKey(noteId), JSON.stringify({ h: contentHash(content), html }))
  } catch {
    // quota dépassé ou localStorage indisponible : le cache mémoire suffit
  }
}

// Nœuds texte à traduire (on saute code/pre pour ne pas abîmer le code).
function collectTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      const parent = (node as Text).parentElement
      if (parent && parent.closest('code, pre, script, style')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })
  const nodes: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) nodes.push(n as Text)
  return nodes
}

async function ensureTranslator(): Promise<BrowserTranslator> {
  if (translator) return translator
  const factory = (globalThis as unknown as { Translator?: TranslatorFactory }).Translator
  if (!factory) throw new Error('unsupported')
  const availability = await factory.availability({ sourceLanguage: 'en', targetLanguage: targetLang.value })
  if (availability === 'unavailable') throw new Error('unsupported')
  translator = await factory.create({
    sourceLanguage: 'en',
    targetLanguage: targetLang.value,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        const loaded = (e as unknown as { loaded?: number }).loaded
        downloadPct.value = loaded != null ? Math.round(loaded * 100) : null
      })
    }
  })
  downloadPct.value = null
  return translator
}

// Traduit les nœuds texte du HTML rendu (structure préservée) et renvoie le HTML.
async function buildTranslatedHtml(note: ReleaseNote): Promise<string> {
  const doc = new DOMParser().parseFromString(renderMarkdownBase(note.content ?? ''), 'text/html')
  const nodes = collectTextNodes(doc.body)
  const active = translator!
  // Concurrence limitée : l'API est locale mais on évite des centaines d'appels d'un coup.
  let cursor = 0
  async function worker() {
    while (cursor < nodes.length) {
      const node = nodes[cursor++]
      if (!node || !node.nodeValue) continue
      try {
        node.nodeValue = await active.translate(node.nodeValue)
      } catch {
        // échec ponctuel : on garde le texte d'origine pour ce fragment
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, nodes.length) }, worker))
  return doc.body.innerHTML
}

// Texte brut minuscule d'un HTML (pour l'indexer côté recherche).
function htmlToText(html: string): string {
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').toLowerCase()
}

// Traduit une liste de notes : d'abord le cache mémoire, puis localStorage, et
// seulement les restantes via l'API. `trackProgress` alimente translateAllProgress
// (barre X/total pour « Tout traduire »). Renvoie false si l'API est indisponible.
async function translateNotes(notes: ReleaseNote[], trackProgress = false): Promise<boolean> {
  const todo: ReleaseNote[] = []
  for (const note of notes) {
    if (translatedHtml.value[note.id]) continue
    const cached = loadTranslation(note.id, note.content ?? '')
    if (cached) {
      translatedHtml.value[note.id] = cached
      translatedText.value[note.id] = htmlToText(cached)
      continue
    }
    todo.push(note)
  }
  // Tout est déjà en cache : rien à traduire (instantané, sans traducteur).
  if (todo.length === 0) return true

  if (trackProgress) translateAllProgress.value = { done: notes.length - todo.length, total: notes.length }
  // Marquer les notes à traduire (loader dans leur entête), puis traduire une par
  // une : chaque note bascule en français dès qu'elle est prête.
  todo.forEach(n => translatingIds.value.add(n.id))
  translating.value = true
  try {
    await ensureTranslator()
    for (const note of todo) {
      try {
        const html = await buildTranslatedHtml(note)
        translatedHtml.value[note.id] = html
        translatedText.value[note.id] = htmlToText(html)
        persistTranslation(note.id, note.content ?? '', html)
      } finally {
        translatingIds.value.delete(note.id)
        if (trackProgress && translateAllProgress.value) translateAllProgress.value.done++
      }
    }
    return true
  } catch {
    toast.add({
      title: 'Traduction indisponible',
      description: 'La traduction intégrée nécessite un navigateur récent (Chrome ou Edge).',
      color: 'error'
    })
    return false
  } finally {
    translating.value = false
    downloadPct.value = null
    translateAllProgress.value = null
    translatingIds.value.clear()
  }
}

function translateVisibleNotes(): Promise<boolean> {
  return translateNotes(filteredNotes.value)
}

async function toggleTranslation() {
  if (translated.value) {
    translated.value = false
    return
  }
  // Basculer en mode traduit tout de suite : chaque note passe en français dès
  // qu'elle est prête (affichage progressif). Revenir en arrière si l'API échoue.
  translated.value = true
  if (!(await translateVisibleNotes())) translated.value = false
}

// Traduit TOUTES les versions (même sans filtre) pour que la recherche couvre
// ensuite l'intégralité des notes. Les notes visibles sont priorisées.
async function translateAll() {
  const all = releaseNotes.value ?? []
  if (all.length === 0) return
  const visibleIds = new Set(filteredNotes.value.map(n => n.id))
  const ordered = [...all].sort((a, b) => (visibleIds.has(b.id) ? 1 : 0) - (visibleIds.has(a.id) ? 1 : 0))
  translated.value = true
  const ok = await translateNotes(ordered, true)
  if (!ok) {
    translated.value = false
  } else {
    toast.add({ title: 'Toutes les versions sont traduites', color: 'success' })
  }
}

function isNoteTranslating(id: number): boolean {
  return translatingIds.value.has(id)
}

// HTML affiché pour une note : version traduite si active et disponible, sinon
// l'original. En recherche, on surligne aussi les correspondances dans le traduit.
function noteHtml(note: ReleaseNote): string {
  if (translated.value && translatedHtml.value[note.id]) {
    const html = translatedHtml.value[note.id]!
    const q = debouncedSearch.value.trim()
    return q ? highlightHtml(html, q) : html
  }
  return renderMarkdown(note.content ?? '')
}
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8">
      <h1 class="text-4xl font-pirate">
        {{ $t('releaseNotes.title') }}
      </h1>
      <p class="text-muted mt-2">
        {{ $t('releaseNotes.subtitle') }}
      </p>
    </div>

    <!-- Filtres -->
    <div
      v-if="releaseNotes && releaseNotes.length > 0"
      class="flex flex-col sm:flex-row gap-3 mb-6"
    >
      <USelectMenu
        v-model="selectedVersionModel"
        :items="versionOptions"
        value-key="value"
        :placeholder="$t('releaseNotes.selectVersion')"
        class="w-full sm:w-72"
      />
      <UInput
        :model-value="search"
        :placeholder="$t('releaseNotes.search')"
        icon="i-lucide-search"
        :disabled="!!selectedVersion"
        class="w-full sm:flex-1"
        @update:model-value="search = String($event)"
      />
      <UButton
        v-if="selectedVersion || search"
        icon="i-lucide-x"
        variant="ghost"
        @click="clearSelection(); search = ''"
      />
      <UButton
        v-if="canTranslate"
        :icon="translated ? 'i-lucide-rotate-ccw' : 'i-lucide-languages'"
        :color="translated ? 'neutral' : 'primary'"
        variant="soft"
        class="shrink-0"
        :loading="translating && !translateAllProgress"
        :disabled="translating"
        :label="translateButtonLabel"
        @click="toggleTranslation"
      />
      <UButton
        v-if="canTranslateAll"
        icon="i-lucide-globe"
        color="primary"
        variant="subtle"
        class="shrink-0"
        :loading="!!translateAllProgress"
        :disabled="translating"
        :label="translateAllLabel"
        @click="translateAll"
      />
    </div>

    <!-- Compteur de résultats -->
    <p
      v-if="releaseNotes && releaseNotes.length > 0 && search && !selectedVersion"
      class="text-muted text-sm mb-4"
    >
      {{ $t('releaseNotes.results', { count: filteredNotes.length, total: releaseNotes.length }) }}
    </p>

    <!-- Message si aucune note -->
    <div
      v-if="!releaseNotes || releaseNotes.length === 0"
      class="text-center py-16"
    >
      <UIcon
        name="i-lucide-scroll-text"
        class="w-16 h-16 text-muted mx-auto mb-4"
      />
      <p class="text-muted text-lg">
        {{ $t('releaseNotes.noNotes') }}
      </p>
    </div>

    <!-- Aucun résultat de recherche -->
    <div
      v-else-if="filteredNotes.length === 0"
      class="text-center py-16"
    >
      <UIcon
        name="i-lucide-search-x"
        class="w-16 h-16 text-muted mx-auto mb-4"
      />
      <p class="text-muted text-lg">
        {{ $t('releaseNotes.noResults') }}
      </p>
    </div>

    <!-- Liste des notes de version -->
    <div
      v-else
      ref="notesContainer"
      class="space-y-6"
    >
      <div
        v-for="(note, idx) in filteredNotes"
        :key="note.id"
        :data-note-idx="idx"
        class="rounded-lg border border-muted"
      >
        <div class="px-5 py-3 border-b border-muted">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UBadge
                color="primary"
                variant="solid"
                size="lg"
              >
                v{{ note.display_version || note.version }}
              </UBadge>
              <span class="text-muted text-sm">
                {{ formatDate(note.date) }}
              </span>
              <span
                v-if="isNoteTranslating(note.id)"
                class="flex items-center gap-1.5 text-xs text-primary"
              >
                <UIcon
                  name="i-lucide-loader-2"
                  class="w-3.5 h-3.5 animate-spin"
                />
                Traduction…
              </span>
            </div>
            <UButton
              :to="`https://www.seaofthieves.com/release-notes/${note.display_version || note.version}`"
              target="_blank"
              variant="ghost"
              icon="i-lucide-external-link"
              size="sm"
            />
          </div>
        </div>
        <div
          class="prose prose-sm dark:prose-invert max-w-none p-5"
          v-html="noteHtml(note)"
        />
      </div>
    </div>
  </UContainer>

  <!-- Header fixe -->
  <div
    v-if="visibleNote || (debouncedSearch.trim() && filteredNotes.length > 0)"
    class="fixed top-16 left-0 right-0 z-30 bg-default/95 backdrop-blur border-b border-muted shadow-sm"
  >
    <div class="max-w-4xl mx-auto px-4 py-2 flex items-center">
      <!-- Mode recherche -->
      <template v-if="debouncedSearch.trim() && !selectedVersion">
        <div
          v-if="visibleNote"
          class="flex items-center gap-2 shrink-0 mr-3"
        >
          <UBadge
            color="primary"
            variant="solid"
            size="sm"
          >
            v{{ visibleNote.display_version || visibleNote.version }}
          </UBadge>
          <span class="text-muted text-sm whitespace-nowrap hidden sm:inline">
            {{ formatDate(visibleNote.date) }}
          </span>
        </div>
        <UInput
          :model-value="search"
          :placeholder="$t('releaseNotes.search')"
          icon="i-lucide-search"
          class="flex-1"
          size="sm"
          @update:model-value="search = String($event)"
        />
        <div
          v-if="occurrenceCount > 0"
          class="flex items-center gap-1 ml-3 shrink-0"
        >
          <span class="text-sm text-muted whitespace-nowrap">
            {{ currentOccurrence }}/{{ occurrenceCount }}
          </span>
          <UButton
            icon="i-lucide-chevron-up"
            size="xs"
            variant="ghost"
            @click="prevOccurrenceFn"
          />
          <UButton
            icon="i-lucide-chevron-down"
            size="xs"
            variant="ghost"
            @click="nextOccurrenceFn"
          />
        </div>
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          size="xs"
          class="ml-1"
          @click="search = ''"
        />
      </template>

      <!-- Mode version sélectionnée -->
      <template v-else-if="visibleNote">
        <!-- Navigation gauche -->
        <div class="flex items-center gap-1 min-w-0 shrink-0">
          <UButton
            v-if="selectedVersion && releaseNotes && currentVersionIndex > 0"
            size="xs"
            variant="ghost"
            icon="i-lucide-chevron-left"
            :label="`v${releaseNotes[currentVersionIndex - 1]?.display_version || releaseNotes[currentVersionIndex - 1]?.version}`"
            @click="prevVersion"
          />
        </div>

        <!-- Centre : version + date -->
        <div class="flex-1 flex items-center justify-center gap-2">
          <UBadge
            color="primary"
            variant="solid"
          >
            v{{ visibleNote.display_version || visibleNote.version }}
          </UBadge>
          <span class="text-muted text-sm">
            {{ formatDate(visibleNote.date) }}
          </span>
          <UButton
            :to="`https://www.seaofthieves.com/release-notes/${visibleNote.display_version || visibleNote.version}`"
            target="_blank"
            variant="ghost"
            icon="i-lucide-external-link"
            size="xs"
          />
        </div>

        <!-- Navigation droite -->
        <div class="flex items-center gap-1 min-w-0 shrink-0">
          <UButton
            v-if="selectedVersion && releaseNotes && currentVersionIndex < releaseNotes.length - 1"
            size="xs"
            variant="ghost"
            trailing-icon="i-lucide-chevron-right"
            :label="`v${releaseNotes[currentVersionIndex + 1]?.display_version || releaseNotes[currentVersionIndex + 1]?.version}`"
            @click="nextVersion"
          />
        </div>
      </template>
    </div>
  </div>
</template>
