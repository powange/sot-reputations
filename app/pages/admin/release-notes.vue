<script setup lang="ts">
import type { ReleaseNote } from '~/types/release-notes'

const { isAdminOrModerator, isAdmin, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()
const { t } = useI18n()

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
    const result = await $fetch<{ totalFound: number; added: number }>('/api/admin/release-notes/sync', { method: 'POST' })
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
        <UButton
          v-if="isAdmin"
          icon="i-lucide-refresh-cw"
          label="Synchroniser"
          :loading="isSyncing"
          @click="syncFromForum"
        />
      </div>
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
    <div v-else class="space-y-2">
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
            v{{ note.version }}
          </UBadge>
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
  </UContainer>
</template>
