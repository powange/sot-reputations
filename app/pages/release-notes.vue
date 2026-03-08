<script setup lang="ts">
import { marked } from 'marked'
import type { ReleaseNote } from '~/types/release-notes'

const { t, d } = useI18n()

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
    label: `v${n.version} — ${n.date}`,
    value: n.version
  }))
})

function clearSelection() {
  selectedVersion.value = null
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
  const html = marked.parse(content, { async: false }) as string
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
  return d(new Date(dateStr + 'T00:00:00'), 'short')
}
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8">
      <UButton
        to="/"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
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
      <UCard
        v-for="note in filteredNotes"
        :key="note.id"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UBadge
                color="primary"
                variant="solid"
                size="lg"
              >
                v{{ note.version }}
              </UBadge>
              <span class="text-muted text-sm">
                {{ formatDate(note.date) }}
              </span>
            </div>
            <UButton
              :to="`https://www.seaofthieves.com/release-notes/${note.version}`"
              target="_blank"
              variant="ghost"
              icon="i-lucide-external-link"
              size="sm"
            />
          </div>
        </template>
        <div
          class="prose prose-sm dark:prose-invert max-w-none"
          v-html="renderMarkdown(note.content ?? '')"
        />
      </UCard>
    </div>
  </UContainer>

  <!-- Navigation occurrences sticky -->
  <div
    v-if="occurrenceCount > 0"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-default/90 backdrop-blur border border-muted rounded-full px-4 py-2 shadow-lg"
  >
    <span class="text-sm font-medium">
      {{ currentOccurrence }} / {{ occurrenceCount }}
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
</template>
