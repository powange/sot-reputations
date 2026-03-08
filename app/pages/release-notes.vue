<script setup lang="ts">
import { marked } from 'marked'
import type { ReleaseNote } from '~/types/release-notes'

const { t } = useI18n()

useSeoMeta({
  title: () => t('releaseNotes.title'),
  description: () => t('releaseNotes.subtitle')
})

const { data: releaseNotes } = await useFetch<ReleaseNote[]>('/api/release-notes')

const search = ref('')
const debouncedSearch = ref('')
const selectedVersion = ref<string | null>(null)
const notesContainer = ref<HTMLElement | null>(null)
const occurrenceCount = ref(0)
const currentOccurrence = ref(0)
const visibleNote = ref<ReleaseNote | null>(null)

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

function clearSelection() {
  selectedVersion.value = null
}

const currentVersionIndex = computed(() => {
  if (!selectedVersion.value || !releaseNotes.value) return -1
  return releaseNotes.value.findIndex(n => n.version === selectedVersion.value)
})

function prevVersion() {
  if (!releaseNotes.value || currentVersionIndex.value <= 0) return
  selectedVersion.value = releaseNotes.value[currentVersionIndex.value - 1].version
}

function nextVersion() {
  if (!releaseNotes.value || currentVersionIndex.value >= releaseNotes.value.length - 1) return
  selectedVersion.value = releaseNotes.value[currentVersionIndex.value + 1].version
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
    mark.classList.add('ring-2', 'ring-primary')
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

function renderMarkdown(content: string): string {
  let html = marked.parse(content, { async: false }) as string
  // Ouvrir tous les liens dans un nouvel onglet
  html = html.replace(/<a /g, '<a target="_blank" rel="noopener" ')
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
        v-model="selectedVersion"
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
          v-html="renderMarkdown(note.content ?? '')"
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
