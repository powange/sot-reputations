<script setup lang="ts">
const { isAdmin, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Base de donnees - Administration'
})

// Redirection si non admin
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value) {
      saveRedirectUrl()
      navigateTo('/')
    } else if (!isAdmin.value) {
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
    selectedFile.value = input.files[0] ?? null
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

    const response = await $fetch<{ success: boolean, message: string }>('/api/admin/database/restore', {
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
    const err = error as { data?: { message?: string }, message?: string }
    toast.add({
      title: 'Erreur de restauration',
      description: err.data?.message || err.message || 'Erreur inconnue',
      color: 'error'
    })
  } finally {
    isRestoring.value = false
  }
}

// --- Doublons du coffre ---
interface DupItem { id: number, image: string | null, itemKey: string, owners: number, hasCost: boolean, hasPrereqs: boolean }
interface DupGroup { name: string, category: string, subcategory: string | null, items: DupItem[] }

const dupGroups = ref<DupGroup[] | null>(null)
const isDetecting = ref(false)
const isMerging = ref(false)
const showMergeModal = ref(false)

// Nombre de lignes qui seront supprimées (toutes sauf la plus ancienne de chaque groupe).
const dupCount = computed(() => (dupGroups.value || []).reduce((n, g) => n + Math.max(0, g.items.length - 1), 0))

async function detectDuplicates() {
  isDetecting.value = true
  try {
    const res = await $fetch<{ groups: DupGroup[] }>('/api/admin/chest-duplicates')
    dupGroups.value = res.groups
    toast.add({
      title: res.groups.length ? `${res.groups.length} groupe(s) de doublons` : 'Aucun doublon',
      color: res.groups.length ? 'warning' : 'success'
    })
  } catch {
    toast.add({ title: 'Erreur', description: 'Détection impossible', color: 'error' })
  } finally {
    isDetecting.value = false
  }
}

async function mergeDuplicates() {
  showMergeModal.value = false
  isMerging.value = true
  try {
    const res = await $fetch<{ groups: number, deleted: number }>('/api/admin/chest-duplicates', { method: 'POST' })
    toast.add({
      title: 'Fusion terminée',
      description: `${res.groups} groupe(s) fusionné(s), ${res.deleted} doublon(s) supprimé(s)`,
      color: 'success'
    })
    await detectDuplicates()
  } catch {
    toast.add({ title: 'Erreur', description: 'Fusion impossible', color: 'error' })
  } finally {
    isMerging.value = false
  }
}

// --- Images d'emblèmes périmées ---
interface EmblemImagePrefix { prefix: string, count: number, sampleImage: string }
const imgPrefixes = ref<EmblemImagePrefix[] | null>(null)
const isAnalyzing = ref(false)
const targetPrefix = ref<string | null>(null)
const previewChanged = ref<number | null>(null)
const isRefreshing = ref(false)

async function analyzeEmblemImages() {
  isAnalyzing.value = true
  targetPrefix.value = null
  previewChanged.value = null
  try {
    const res = await $fetch<{ prefixes: EmblemImagePrefix[] }>('/api/admin/emblem-images')
    imgPrefixes.value = res.prefixes
    if (res.prefixes.length <= 1) {
      toast.add({
        title: res.prefixes.length === 1 ? 'Une seule version d\'URL — rien à corriger' : 'Aucune image d\'emblème',
        color: 'info'
      })
    }
  } catch {
    toast.add({ title: 'Erreur', description: 'Analyse impossible', color: 'error' })
  } finally {
    isAnalyzing.value = false
  }
}

async function chooseTarget(prefix: string) {
  targetPrefix.value = prefix
  previewChanged.value = null
  try {
    const res = await $fetch<{ changed: number, total: number }>('/api/admin/emblem-images', { method: 'POST', body: { targetPrefix: prefix } })
    previewChanged.value = res.changed
  } catch {
    toast.add({ title: 'Erreur', description: 'Aperçu impossible', color: 'error' })
  }
}

async function applyEmblemImages() {
  if (!targetPrefix.value) return
  isRefreshing.value = true
  try {
    const res = await $fetch<{ changed: number, total: number }>('/api/admin/emblem-images', { method: 'POST', body: { targetPrefix: targetPrefix.value, apply: true } })
    toast.add({ title: 'Images mises à jour', description: `${res.changed} image(s) réécrite(s)`, color: 'success' })
    await analyzeEmblemImages()
  } catch {
    toast.add({ title: 'Erreur', description: 'Mise à jour impossible', color: 'error' })
  } finally {
    isRefreshing.value = false
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
            <UIcon
              name="i-lucide-download"
              class="w-5 h-5 text-primary"
            />
            <h2 class="text-xl font-semibold">
              Sauvegarde
            </h2>
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
            <UIcon
              name="i-lucide-upload"
              class="w-5 h-5 text-warning"
            />
            <h2 class="text-xl font-semibold">
              Restauration
            </h2>
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
            <label
              for="restore-file"
              class="block text-sm font-medium mb-2"
            >
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

          <div
            v-if="selectedFile"
            class="text-sm text-muted"
          >
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

    <!-- Doublons du coffre -->
    <UCard class="mt-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-copy"
            class="w-5 h-5 text-warning"
          />
          <h2 class="text-xl font-semibold">
            Doublons du coffre
          </h2>
        </div>
      </template>

      <p class="text-muted mb-4">
        Détecte les items du catalogue en double (même nom, catégorie et sous-catégorie mais
        lignes distinctes). Ces doublons éclatent la possession entre plusieurs lignes et masquent
        les co-membres d'un groupe. La fusion garde la ligne la plus ancienne, y reporte possession,
        traductions, coût et prérequis, puis supprime les doublons.
      </p>

      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-search"
          label="Détecter les doublons"
          color="primary"
          variant="outline"
          :loading="isDetecting"
          @click="detectDuplicates"
        />
        <UButton
          v-if="dupGroups && dupGroups.length"
          icon="i-lucide-merge"
          :label="`Fusionner (${dupCount})`"
          color="warning"
          :loading="isMerging"
          @click="showMergeModal = true"
        />
      </div>

      <div
        v-if="dupGroups"
        class="mt-4"
      >
        <p
          v-if="!dupGroups.length"
          class="text-sm text-success"
        >
          Aucun doublon détecté.
        </p>
        <ul
          v-else
          class="space-y-2 max-h-96 overflow-y-auto text-sm"
        >
          <li
            v-for="g in dupGroups"
            :key="`${g.category}/${g.subcategory}/${g.name}`"
            class="border border-muted/20 rounded p-2"
          >
            <div class="font-medium">
              {{ g.name }}
            </div>
            <div class="text-xs text-muted mb-1">
              {{ g.category }} / {{ g.subcategory || '—' }} · {{ g.items.length }} lignes
            </div>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="(it, idx) in g.items"
                :key="it.id"
                class="text-xs px-1.5 py-0.5 rounded bg-muted/10"
                :class="idx === 0 ? 'ring-1 ring-success/40' : ''"
              >
                #{{ it.id }} · {{ it.owners }} poss.{{ idx === 0 ? ' (gardé)' : '' }}
              </span>
            </div>
          </li>
        </ul>
      </div>
    </UCard>

    <!-- Images d'emblèmes périmées -->
    <UCard class="mt-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-image-off"
            class="w-5 h-5 text-warning"
          />
          <h2 class="text-xl font-semibold">
            Images d'emblèmes périmées
          </h2>
        </div>
      </template>

      <p class="text-muted mb-4">
        Les URLs d'images d'emblèmes contiennent un segment de version qui peut devenir
        périmé (image cassée). Analyse les versions présentes, repère celle qui s'affiche
        correctement, puis réécris toutes les images vers cette version (le fichier/GUID
        de chaque emblème est conservé).
      </p>

      <UButton
        icon="i-lucide-search"
        label="Analyser les versions"
        color="primary"
        variant="outline"
        :loading="isAnalyzing"
        @click="analyzeEmblemImages"
      />

      <div
        v-if="imgPrefixes"
        class="mt-4 space-y-2"
      >
        <p
          v-if="!imgPrefixes.length"
          class="text-sm text-muted"
        >
          Aucune image d'emblème.
        </p>
        <div
          v-for="p in imgPrefixes"
          :key="p.prefix"
          class="flex items-center gap-3 border rounded p-2"
          :class="targetPrefix === p.prefix ? 'border-primary' : 'border-muted/30'"
        >
          <img
            :src="p.sampleImage"
            alt=""
            class="w-10 h-10 object-contain shrink-0 bg-muted/20 rounded"
          >
          <div class="min-w-0 flex-1">
            <div class="text-xs font-mono truncate">
              {{ p.prefix }}
            </div>
            <div class="text-xs text-muted">
              {{ p.count }} emblème(s)
            </div>
          </div>
          <UButton
            size="xs"
            :variant="targetPrefix === p.prefix ? 'solid' : 'outline'"
            label="Cible"
            @click="chooseTarget(p.prefix)"
          />
        </div>

        <div
          v-if="targetPrefix"
          class="pt-2 border-t border-muted/20"
        >
          <p class="text-sm mb-2">
            Cible : <span class="font-mono text-xs">{{ targetPrefix }}</span>
            <template v-if="previewChanged !== null">
              <br><strong>{{ previewChanged }}</strong> image(s) seront réécrites.
            </template>
          </p>
          <UButton
            icon="i-lucide-refresh-cw"
            label="Mettre à jour les images"
            color="warning"
            :loading="isRefreshing"
            :disabled="previewChanged === 0"
            @click="applyEmblemImages"
          />
        </div>
      </div>
    </UCard>

    <!-- Modal de confirmation -->
    <UModal v-model:open="showConfirmModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 text-warning">
              <UIcon
                name="i-lucide-alert-triangle"
                class="w-6 h-6"
              />
              <h2 class="text-xl font-semibold">
                Confirmer la restauration
              </h2>
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

    <!-- Modal de confirmation fusion doublons -->
    <UModal v-model:open="showMergeModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 text-warning">
              <UIcon
                name="i-lucide-alert-triangle"
                class="w-6 h-6"
              />
              <h2 class="text-xl font-semibold">
                Fusionner les doublons
              </h2>
            </div>
          </template>

          <p class="mb-2">
            <strong>{{ dupCount }}</strong> doublon(s) seront supprimés et leur possession reportée
            sur la ligne la plus ancienne de chaque groupe.
          </p>
          <p class="text-warning font-medium">
            Cette action ne peut pas être annulée.
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Annuler"
                color="neutral"
                variant="outline"
                @click="showMergeModal = false"
              />
              <UButton
                label="Fusionner"
                color="warning"
                icon="i-lucide-merge"
                :loading="isMerging"
                @click="mergeDuplicates"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
