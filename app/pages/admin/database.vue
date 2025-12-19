<script setup lang="ts">
const { isAdmin, isAuthenticated } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Base de donnees - Administration'
})

// Redirection si non admin
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value || !isAdmin.value) {
      navigateTo('/')
    }
  }
})

// Sauvegarde
const isDownloading = ref(false)

async function downloadBackup() {
  isDownloading.value = true
  try {
    const response = await fetch('/api/admin/database/backup', {
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Erreur lors du telechargement')
    }

    // Récupérer le nom du fichier depuis le header
    const disposition = response.headers.get('Content-Disposition')
    const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'backup.db'

    // Télécharger le fichier
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.add({
      title: 'Sauvegarde telechargee',
      description: filename,
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de telecharger la sauvegarde',
      color: 'error'
    })
  } finally {
    isDownloading.value = false
  }
}

// Restauration
const isRestoring = ref(false)
const selectedFile = ref<File | null>(null)
const showConfirmModal = ref(false)

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    selectedFile.value = input.files[0]
  }
}

function confirmRestore() {
  if (!selectedFile.value) {
    toast.add({
      title: 'Erreur',
      description: 'Veuillez selectionner un fichier',
      color: 'error'
    })
    return
  }
  showConfirmModal.value = true
}

async function executeRestore() {
  if (!selectedFile.value) return

  showConfirmModal.value = false
  isRestoring.value = true

  try {
    const formData = new FormData()
    formData.append('database', selectedFile.value)

    const response = await $fetch<{ success: boolean; message: string }>('/api/admin/database/restore', {
      method: 'POST',
      body: formData
    })

    toast.add({
      title: 'Restauration reussie',
      description: response.message,
      color: 'success'
    })

    selectedFile.value = null
    // Reset file input
    const fileInput = document.getElementById('restore-file') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; message?: string }
    toast.add({
      title: 'Erreur de restauration',
      description: err.data?.message || err.message || 'Erreur inconnue',
      color: 'error'
    })
  } finally {
    isRestoring.value = false
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
        Base de donnees
      </h1>
      <p class="text-muted mt-2">
        Sauvegarde et restauration de la base de donnees
      </p>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <!-- Sauvegarde -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-download" class="w-5 h-5 text-primary" />
            <h2 class="text-xl font-semibold">Sauvegarde</h2>
          </div>
        </template>

        <p class="text-muted mb-4">
          Telechargez une copie de la base de donnees actuelle. Cette sauvegarde contient toutes les donnees : utilisateurs, groupes, factions, accomplissements et progressions.
        </p>

        <UButton
          icon="i-lucide-download"
          label="Telecharger la sauvegarde"
          color="primary"
          :loading="isDownloading"
          @click="downloadBackup"
        />
      </UCard>

      <!-- Restauration -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-upload" class="w-5 h-5 text-warning" />
            <h2 class="text-xl font-semibold">Restauration</h2>
          </div>
        </template>

        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          title="Attention"
          description="La restauration remplacera toutes les donnees actuelles. Une sauvegarde automatique sera creee avant la restauration."
          class="mb-4"
        />

        <div class="space-y-4">
          <div>
            <label for="restore-file" class="block text-sm font-medium mb-2">
              Fichier de sauvegarde (.db)
            </label>
            <input
              id="restore-file"
              type="file"
              accept=".db"
              class="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 file:cursor-pointer"
              @change="onFileChange"
            >
          </div>

          <div v-if="selectedFile" class="text-sm text-muted">
            Fichier selectionne : <strong>{{ selectedFile.name }}</strong>
            ({{ (selectedFile.size / 1024 / 1024).toFixed(2) }} Mo)
          </div>

          <UButton
            icon="i-lucide-upload"
            label="Restaurer"
            color="warning"
            :disabled="!selectedFile"
            :loading="isRestoring"
            @click="confirmRestore"
          />
        </div>
      </UCard>
    </div>

    <!-- Modal de confirmation -->
    <UModal v-model:open="showConfirmModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 text-warning">
              <UIcon name="i-lucide-alert-triangle" class="w-6 h-6" />
              <h2 class="text-xl font-semibold">Confirmer la restauration</h2>
            </div>
          </template>

          <p class="mb-4">
            Etes-vous sur de vouloir restaurer la base de donnees a partir du fichier
            <strong>{{ selectedFile?.name }}</strong> ?
          </p>

          <p class="text-warning font-medium">
            Cette action remplacera toutes les donnees actuelles et ne peut pas etre annulee.
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Annuler"
                color="neutral"
                variant="outline"
                @click="showConfirmModal = false"
              />
              <UButton
                label="Restaurer"
                color="warning"
                icon="i-lucide-upload"
                @click="executeRestore"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
