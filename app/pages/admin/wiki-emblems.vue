<script setup lang="ts">
const { isAuthenticated, isAdmin, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({ title: 'Synchro wiki des emblèmes - SoT Reputations' })

// La synchro écrit en base -> réservée aux admins.
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

interface FactionResult { factionKey: string, title: string, total: number, highSeas: number, error?: string }
interface SyncResult {
  apply: boolean
  perFaction: FactionResult[]
  totalEmblems: number
  matched: number
  highSeasCount: number
  changed: number
  unmatched: number
  unmatchedNames: string[]
}

const loading = ref(false)
const applying = ref(false)
const result = ref<SyncResult | null>(null)

async function run(apply: boolean) {
  if (apply) applying.value = true
  else loading.value = true
  try {
    result.value = await $fetch<SyncResult>('/api/admin/emblems/high-seas-sync', {
      method: 'POST',
      body: { apply }
    })
    if (apply) {
      toast.add({
        title: 'Synchronisation appliquée',
        description: `${result.value.changed} emblème(s) mis à jour`,
        color: 'success'
      })
    }
  } catch (e) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Échec de la synchronisation', color: 'error' })
  } finally {
    loading.value = false
    applying.value = false
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
      <h1 class="text-3xl font-pirate flex items-center gap-2">
        <UIcon
          name="i-lucide-waves"
          class="w-7 h-7 text-primary"
        />
        Synchro wiki des emblèmes
      </h1>
      <p class="text-muted mt-2">
        Récupère le flag « High Seas only » des commendations depuis le wiki Sea of Thieves
        et l'applique aux emblèmes (rapprochement par nom anglais).
      </p>
    </div>

    <UCard>
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          icon="i-lucide-eye"
          label="Aperçu (sans écrire)"
          :loading="loading"
          :disabled="applying"
          @click="run(false)"
        />
        <UButton
          icon="i-lucide-save"
          label="Appliquer"
          color="primary"
          variant="solid"
          :loading="applying"
          :disabled="loading || !result"
          @click="run(true)"
        />
        <span
          v-if="result && !result.apply"
          class="text-sm text-muted"
        >
          Aperçu chargé — cliquez « Appliquer » pour écrire en base.
        </span>
      </div>

      <template v-if="result">
        <div class="mt-6 border-t border-muted/20 pt-4 space-y-4">
          <!-- Récapitulatif -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-muted/30 rounded-lg p-3">
              <div class="text-2xl font-bold">
                {{ result.totalEmblems }}
              </div>
              <div class="text-xs text-muted">
                Emblèmes au total
              </div>
            </div>
            <div class="bg-muted/30 rounded-lg p-3">
              <div class="text-2xl font-bold text-primary">
                {{ result.highSeasCount }}
              </div>
              <div class="text-xs text-muted">
                Marqués High Seas only
              </div>
            </div>
            <div class="bg-muted/30 rounded-lg p-3">
              <div class="text-2xl font-bold text-warning">
                {{ result.changed }}
              </div>
              <div class="text-xs text-muted">
                {{ result.apply ? 'Modifiés' : 'À modifier' }}
              </div>
            </div>
            <div class="bg-muted/30 rounded-lg p-3">
              <div class="text-2xl font-bold">
                {{ result.unmatched }}
              </div>
              <div class="text-xs text-muted">
                Non rapprochés
              </div>
            </div>
          </div>

          <!-- Détail par faction -->
          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-muted mb-2">
              Par faction
            </h2>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-muted border-b border-muted/20">
                    <th class="py-1.5 pr-3 font-medium">
                      Faction (page wiki)
                    </th>
                    <th class="py-1.5 px-3 font-medium text-right">
                      Commendations
                    </th>
                    <th class="py-1.5 px-3 font-medium text-right">
                      High Seas only
                    </th>
                    <th class="py-1.5 pl-3 font-medium">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="f in result.perFaction"
                    :key="f.factionKey"
                    class="border-b border-muted/10"
                  >
                    <td class="py-1.5 pr-3">
                      {{ f.title }}
                    </td>
                    <td class="py-1.5 px-3 text-right">
                      {{ f.total }}
                    </td>
                    <td class="py-1.5 px-3 text-right">
                      {{ f.highSeas }}
                    </td>
                    <td class="py-1.5 pl-3">
                      <span
                        v-if="f.error"
                        class="text-error"
                      >{{ f.error }}</span>
                      <UIcon
                        v-else
                        name="i-lucide-check"
                        class="w-4 h-4 text-success"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Emblèmes non rapprochés (diagnostic) -->
          <UAlert
            v-if="result.unmatchedNames.length"
            icon="i-lucide-info"
            color="neutral"
            variant="subtle"
            :title="`${result.unmatched} emblème(s) sans correspondance wiki`"
          >
            <template #description>
              <p class="text-xs">
                Laissés inchangés. Échantillon : {{ result.unmatchedNames.join(', ') }}
              </p>
            </template>
          </UAlert>
        </div>
      </template>
    </UCard>
  </UContainer>
</template>
