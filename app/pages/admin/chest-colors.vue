<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Couleurs du coffre - Administration'
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

interface ColorStatus { analyzed: number, total: number, remaining: number }
interface AnalyzeResult extends ColorStatus { processed: number, failed: number }

const { data: initialStatus } = await useFetch<ColorStatus>('/api/admin/chest-colors/status')
const { data: palette } = await useFetch<Array<{ name: string, hex: string }>>('/api/chest-colors')

const status = ref<ColorStatus>(initialStatus.value || { analyzed: 0, total: 0, remaining: 0 })
const analyzing = ref(false)
const stopRequested = ref(false)
const reclassifying = ref(false)

const progressPct = computed(() =>
  status.value.total > 0 ? Math.round((status.value.analyzed / status.value.total) * 100) : 0
)

// Boucle de lots jusqu'à épuisement (l'UI rappelle l'endpoint jusqu'à remaining === 0).
async function runAnalyzeLoop() {
  while (!stopRequested.value) {
    const res = await $fetch<AnalyzeResult>('/api/admin/chest-colors/analyze', { method: 'POST' })
    status.value = { analyzed: res.analyzed, total: res.total, remaining: res.remaining }
    // Fin si plus rien à traiter, ou si un lot n'a rien avancé (évite une boucle infinie).
    if (res.remaining <= 0 || (res.processed === 0 && res.failed === 0)) break
  }
}

async function analyzeAll() {
  analyzing.value = true
  stopRequested.value = false
  try {
    await runAnalyzeLoop()
    toast.add({ title: 'Analyse des couleurs terminée', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur pendant l\'analyse', color: 'error' })
  } finally {
    analyzing.value = false
  }
}

// Ré-extraction complète : remet toutes les couleurs à zéro puis relance l'analyse.
// À utiliser après un changement de l'algorithme d'extraction (re-télécharge tout).
async function reanalyzeAll() {
  if (!confirm('Ré-analyser TOUS les items ? Toutes les images seront re-téléchargées et ré-analysées.')) return
  analyzing.value = true
  stopRequested.value = false
  try {
    const res = await $fetch<AnalyzeResult & { reset: number }>('/api/admin/chest-colors/reset', { method: 'POST' })
    status.value = { analyzed: res.analyzed, total: res.total, remaining: res.remaining }
    await runAnalyzeLoop()
    toast.add({ title: 'Ré-analyse des couleurs terminée', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur pendant la ré-analyse', color: 'error' })
  } finally {
    analyzing.value = false
  }
}

function stopAnalyze() {
  stopRequested.value = true
}

async function reclassify() {
  reclassifying.value = true
  try {
    const res = await $fetch<{ reclassified: number }>('/api/admin/chest-colors/reclassify', { method: 'POST' })
    toast.add({ title: `Re-classement terminé (${res.reclassified} items)`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur pendant le re-classement', color: 'error' })
  } finally {
    reclassifying.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        Couleurs du coffre
      </h1>
      <p class="text-muted mt-2">
        Analyse les images des objets pour en extraire les couleurs principales (filtre couleur sur « Mon coffre »).
      </p>
    </div>

    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Analyse
        </h2>
      </template>

      <div class="space-y-4">
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-muted">Items analysés</span>
            <span class="font-medium">{{ status.analyzed }} / {{ status.total }}</span>
          </div>
          <div class="h-2 bg-muted/30 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary transition-all"
              :style="{ width: `${progressPct}%` }"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="!analyzing"
            icon="i-lucide-palette"
            :label="status.remaining > 0 ? `Analyser (${status.remaining} restants)` : 'Tout est analysé'"
            :disabled="status.remaining <= 0"
            @click="analyzeAll"
          />
          <UButton
            v-else
            icon="i-lucide-loader-2"
            label="Arrêter"
            color="warning"
            @click="stopAnalyze"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            label="Re-classer (après modif palette)"
            color="neutral"
            variant="outline"
            :loading="reclassifying"
            :disabled="analyzing"
            @click="reclassify"
          />
          <UButton
            v-if="!analyzing"
            icon="i-lucide-rotate-ccw"
            label="Tout ré-analyser (après modif algo)"
            color="warning"
            variant="outline"
            :disabled="reclassifying"
            @click="reanalyzeAll"
          />
        </div>
        <p
          v-if="analyzing"
          class="text-sm text-muted flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="w-4 h-4 animate-spin"
          />
          Analyse en cours… ({{ status.analyzed }} / {{ status.total }})
        </p>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Palette (définie en code)
        </h2>
      </template>
      <div class="flex flex-wrap gap-3">
        <div
          v-for="c in palette || []"
          :key="c.name"
          class="flex items-center gap-2 text-sm"
        >
          <span
            class="inline-block w-5 h-5 rounded border border-muted/30"
            :style="{ backgroundColor: c.hex }"
          />
          {{ c.name }}
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
