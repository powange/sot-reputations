<script setup lang="ts">
import type { ReleaseNote } from '~/types/release-notes'

const { isAdminOrModerator, isAdmin, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Notes de version - Administration'
})

// Redirection si non admin/moderateur
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

// Données
const { data: releaseNotes, status, refresh } = await useFetch<ReleaseNote[]>('/api/admin/release-notes')

// Stats
const stats = computed(() => {
  const notes = releaseNotes.value || []
  const withContent = notes.filter(n => n.content !== null).length
  return {
    total: notes.length,
    withContent,
    withoutContent: notes.length - withContent
  }
})

// Synchronisation
const isSyncing = ref(false)

async function syncFromForum() {
  isSyncing.value = true
  try {
    const result = await $fetch<{ totalFound: number, added: number }>('/api/admin/release-notes/sync', { method: 'POST' })
    toast.add({
      title: 'Synchronisation terminée',
      description: `${result.totalFound} versions trouvées, ${result.added} nouvelles ajoutées`,
      color: 'success'
    })
    await refresh()
  } catch {
    toast.add({ title: 'Erreur de synchronisation', color: 'error' })
  } finally {
    isSyncing.value = false
  }
}

// Récupération du contenu
const fetchingContentIds = ref<number[]>([])
const batchImporting = ref<'missing' | 'all' | null>(null)
const batchProgress = ref({ done: 0, total: 0, errors: 0 })

async function fetchContent(note: ReleaseNote) {
  fetchingContentIds.value.push(note.id)
  try {
    await $fetch(`/api/admin/release-notes/${note.id}/content`, { method: 'POST' })
    toast.add({
      title: `Contenu v${note.version} récupéré`,
      color: 'success'
    })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: `Erreur v${note.version}`,
      description: err.data?.message || 'Impossible de récupérer le contenu',
      color: 'error'
    })
  } finally {
    fetchingContentIds.value = fetchingContentIds.value.filter(id => id !== note.id)
  }
}

async function batchImport(mode: 'missing' | 'all') {
  if (!releaseNotes.value) return
  const notes = mode === 'missing'
    ? releaseNotes.value.filter(n => !n.content)
    : [...releaseNotes.value]

  if (notes.length === 0) {
    toast.add({ title: 'Aucune note à importer', color: 'warning' })
    return
  }

  batchImporting.value = mode
  batchProgress.value = { done: 0, total: notes.length, errors: 0 }

  for (const note of notes) {
    try {
      await $fetch(`/api/admin/release-notes/${note.id}/content`, { method: 'POST' })
    } catch {
      batchProgress.value.errors++
    }
    batchProgress.value.done++
  }

  toast.add({
    title: 'Import terminé',
    description: `${batchProgress.value.done - batchProgress.value.errors} réussis, ${batchProgress.value.errors} erreurs`,
    color: batchProgress.value.errors ? 'warning' : 'success'
  })

  batchImporting.value = null
  await refresh()
}

// Édition du contenu
const isEditModalOpen = ref(false)
const editingNote = ref<ReleaseNote | null>(null)
const editContent = ref('')
const editDisplayVersion = ref('')
const isSaving = ref(false)

function openEditor(note: ReleaseNote) {
  editingNote.value = note
  editContent.value = note.content || ''
  editDisplayVersion.value = note.display_version || note.version
  isEditModalOpen.value = true
}

async function saveContent() {
  if (!editingNote.value) return
  isSaving.value = true
  try {
    await $fetch(`/api/admin/release-notes/${editingNote.value.id}/content`, {
      method: 'PATCH',
      body: {
        content: editContent.value,
        display_version: editDisplayVersion.value !== editingNote.value.version ? editDisplayVersion.value : undefined
      }
    })
    toast.add({
      title: `Contenu v${editDisplayVersion.value} sauvegardé`,
      color: 'success'
    })
    isEditModalOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Erreur de sauvegarde', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

// Suppression
const deletingIds = ref<number[]>([])

async function deleteNote(note: ReleaseNote) {
  deletingIds.value.push(note.id)
  try {
    await $fetch(`/api/admin/release-notes/${note.id}`, { method: 'DELETE' })
    toast.add({
      title: `v${note.version} supprimée`,
      color: 'success'
    })
    await refresh()
  } catch {
    toast.add({ title: 'Erreur de suppression', color: 'error' })
  } finally {
    deletingIds.value = deletingIds.value.filter(id => id !== note.id)
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>

<template>
  <UContainer class="py-8 max-w-6xl">
    <!-- Header -->
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Admin"
        class="mb-4"
      />
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-pirate">
            Notes de version
          </h1>
          <p class="text-muted mt-1">
            Importer les notes de mise à jour depuis le site Sea of Thieves
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="isAdmin"
            icon="i-lucide-refresh-cw"
            label="Synchroniser"
            :loading="isSyncing"
            :disabled="!!batchImporting"
            @click="syncFromForum"
          />
          <UButton
            v-if="isAdmin && stats.withoutContent > 0"
            icon="i-lucide-download"
            :label="`Importer manquants (${stats.withoutContent})`"
            variant="outline"
            :loading="batchImporting === 'missing'"
            :disabled="!!batchImporting && batchImporting !== 'missing'"
            @click="batchImport('missing')"
          />
          <UButton
            v-if="isAdmin && stats.total > 0"
            icon="i-lucide-refresh-cw"
            label="Tout ré-importer"
            variant="outline"
            color="warning"
            :loading="batchImporting === 'all'"
            :disabled="!!batchImporting && batchImporting !== 'all'"
            @click="batchImport('all')"
          />
        </div>
      </div>
    </div>

    <!-- Progression batch -->
    <div
      v-if="batchImporting"
      class="mb-6 p-4 bg-muted/30 rounded-lg"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">
          Import en cours... {{ batchProgress.done }} / {{ batchProgress.total }}
        </span>
        <span
          v-if="batchProgress.errors"
          class="text-sm text-error"
        >
          {{ batchProgress.errors }} erreurs
        </span>
      </div>
      <UProgress :value="batchProgress.total ? (batchProgress.done / batchProgress.total) * 100 : 0" />
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-muted/30 rounded-lg p-4">
        <div class="text-2xl font-bold">
          {{ stats.total }}
        </div>
        <div class="text-sm text-muted">
          Versions totales
        </div>
      </div>
      <div class="bg-muted/30 rounded-lg p-4">
        <div class="text-2xl font-bold text-success">
          {{ stats.withContent }}
        </div>
        <div class="text-sm text-muted">
          Avec contenu
        </div>
      </div>
      <div class="bg-muted/30 rounded-lg p-4">
        <div class="text-2xl font-bold text-warning">
          {{ stats.withoutContent }}
        </div>
        <div class="text-sm text-muted">
          En attente
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="status === 'pending'"
      class="flex justify-center py-16"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-primary"
      />
    </div>

    <!-- Liste vide -->
    <div
      v-else-if="!releaseNotes || releaseNotes.length === 0"
      class="text-center py-16"
    >
      <UIcon
        name="i-lucide-scroll-text"
        class="w-16 h-16 text-muted mx-auto mb-4"
      />
      <p class="text-muted text-lg mb-4">
        Aucune note de version
      </p>
      <UButton
        v-if="isAdmin"
        icon="i-lucide-refresh-cw"
        label="Synchroniser depuis le forum"
        :loading="isSyncing"
        @click="syncFromForum"
      />
    </div>

    <!-- Tableau -->
    <div
      v-else
      class="space-y-2"
    >
      <div
        v-for="note in releaseNotes"
        :key="note.id"
        class="flex items-center justify-between p-4 bg-muted/20 rounded-lg"
      >
        <div class="flex items-center gap-4">
          <UBadge
            :color="note.content ? 'success' : 'warning'"
            variant="solid"
          >
            v{{ note.display_version || note.version }}
          </UBadge>
          <span
            v-if="note.display_version && note.display_version !== note.version"
            class="text-xs text-muted"
            :title="'Version originale : ' + note.version"
          >
            ({{ note.version }})
          </span>
          <span class="text-sm text-muted">
            {{ formatDate(note.date) }}
          </span>
          <UBadge
            v-if="!note.content"
            color="warning"
            variant="subtle"
            size="xs"
          >
            Sans contenu
          </UBadge>
          <UBadge
            v-else
            color="success"
            variant="subtle"
            size="xs"
          >
            Contenu OK
          </UBadge>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            v-if="isAdmin"
            :icon="note.content ? 'i-lucide-refresh-cw' : 'i-lucide-download'"
            :label="note.content ? 'Re-importer' : 'Récupérer le contenu'"
            size="sm"
            variant="outline"
            :loading="fetchingContentIds.includes(note.id)"
            @click="fetchContent(note)"
          />
          <UButton
            v-if="isAdmin"
            icon="i-lucide-pencil"
            size="sm"
            variant="ghost"
            @click="openEditor(note)"
          />
          <UButton
            v-if="isAdmin"
            icon="i-lucide-trash-2"
            size="sm"
            color="error"
            variant="ghost"
            :loading="deletingIds.includes(note.id)"
            @click="deleteNote(note)"
          />
        </div>
      </div>
    </div>

    <!-- Modal édition contenu -->
    <UModal
      v-model:open="isEditModalOpen"
      :ui="{ width: 'max-w-4xl' }"
    >
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">
                Éditer v{{ editingNote?.display_version || editingNote?.version }}
              </h3>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                size="sm"
                @click="isEditModalOpen = false"
              />
            </div>
          </template>
          <div class="flex items-center gap-2 mb-4">
            <label class="text-sm font-medium whitespace-nowrap">Version d'affichage</label>
            <UInput
              v-model="editDisplayVersion"
              class="w-48"
              placeholder="Ex: 3.3.2.1"
            />
            <span
              v-if="editingNote && editDisplayVersion !== editingNote.version"
              class="text-xs text-muted"
            >
              Originale : {{ editingNote.version }}
            </span>
          </div>
          <UTextarea
            v-model="editContent"
            :rows="20"
            class="font-mono text-sm w-full"
          />
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Annuler"
                variant="ghost"
                @click="isEditModalOpen = false"
              />
              <UButton
                label="Sauvegarder"
                icon="i-lucide-save"
                :loading="isSaving"
                @click="saveContent"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
