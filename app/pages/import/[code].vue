<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const { t } = useI18n()
const { user, isAuthenticated, isLoading: authLoading, loginWithMicrosoft } = useAuth()

const code = route.params.code as string

// Récupérer les données temporaires
const { data: tempData, error, status } = await useFetch<{ success: boolean, data: unknown }>(`/api/import-temp/${code}`)

const isImporting = ref(false)
const importSuccess = ref(false)

async function handleImport() {
  if (!tempData.value?.data) return

  isImporting.value = true
  try {
    await $fetch('/api/import', {
      method: 'POST',
      body: {
        jsonData: tempData.value.data
      }
    })
    toast.add({
      title: t('importPage.success'),
      description: t('importPage.successDescription'),
      color: 'success'
    })
    importSuccess.value = true
    // Rediriger vers mes réputations après 2 secondes
    setTimeout(() => {
      navigateTo('/mes-reputations')
    }, 2000)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: t('common.error'),
      description: err.data?.message || t('importPage.importError'),
      color: 'error'
    })
  } finally {
    isImporting.value = false
  }
}

// Le payload peut être { reputation, chest } (bookmarklet v7+) ou la réputation brute.
type FactionData = Record<string, { Emblems?: { Emblems?: unknown[] }, Campaigns?: Record<string, { Emblems?: unknown[] }> }>

const repData = computed<FactionData | null>(() => {
  const raw = tempData.value?.data as { reputation?: unknown } | null
  if (!raw) return null
  if (raw.reputation && typeof raw.reputation === 'object') return raw.reputation as FactionData
  return raw as FactionData
})

// Compter le nombre d'accomplissements dans les données
const emblemCount = computed(() => {
  const data = repData.value
  if (!data) return 0
  let count = 0
  for (const faction of Object.values(data)) {
    if (faction.Emblems?.Emblems) {
      count += faction.Emblems.Emblems.length
    }
    if (faction.Campaigns) {
      for (const campaign of Object.values(faction.Campaigns)) {
        if (campaign.Emblems) {
          count += campaign.Emblems.length
        }
      }
    }
  }
  return count
})

const factionCount = computed(() => repData.value ? Object.keys(repData.value).length : 0)

// Nombre d'items du coffre (si présent dans le payload)
const chestItemCount = computed(() => {
  const raw = tempData.value?.data as { chest?: { chestData?: Record<string, unknown> } } | null
  const chestData = raw?.chest?.chestData
  if (!chestData) return 0
  return Object.values(chestData).reduce<number>((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)
})
</script>

<template>
  <UContainer class="py-16">
    <div class="max-w-md mx-auto">
      <!-- Chargement -->
      <div
        v-if="status === 'pending' || authLoading"
        class="flex justify-center py-16"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-8 h-8 animate-spin text-primary"
        />
      </div>

      <!-- Erreur : données non trouvées ou expirées -->
      <template v-else-if="error">
        <UCard>
          <div class="text-center py-8">
            <UIcon
              name="i-lucide-clock"
              class="w-16 h-16 text-error mx-auto mb-4"
            />
            <h1 class="text-2xl font-pirate mb-2">
              {{ $t('importPage.expired') }}
            </h1>
            <p class="text-muted mb-6">
              {{ $t('importPage.expiredDescription') }}
              <br>
              {{ $t('importPage.expiredHint') }}
            </p>
            <UButton
              :label="$t('invite.backToHome')"
              icon="i-lucide-home"
              @click="navigateTo('/')"
            />
          </div>
        </UCard>
      </template>

      <!-- Données trouvées -->
      <template v-else-if="tempData?.data">
        <UCard>
          <div class="text-center py-4">
            <UIcon
              name="i-lucide-download"
              class="w-16 h-16 text-primary mx-auto mb-4"
            />
            <h1 class="text-2xl font-pirate mb-2">
              {{ $t('importPage.title') }}
            </h1>

            <!-- Résumé des données -->
            <div class="bg-muted/50 rounded-lg p-4 mb-6">
              <p class="text-sm text-muted mb-2">
                {{ $t('importPage.dataRetrieved') }}
              </p>
              <div class="flex justify-center gap-6">
                <div class="text-center">
                  <div class="text-2xl font-bold text-primary">
                    {{ factionCount }}
                  </div>
                  <div class="text-xs text-muted">
                    {{ $t('importPage.factions') }}
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-primary">
                    {{ emblemCount }}
                  </div>
                  <div class="text-xs text-muted">
                    {{ $t('importPage.achievements') }}
                  </div>
                </div>
                <div
                  v-if="chestItemCount > 0"
                  class="text-center"
                >
                  <div class="text-2xl font-bold text-primary">
                    {{ chestItemCount }}
                  </div>
                  <div class="text-xs text-muted">
                    {{ $t('importPage.chestItems') }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Import réussi -->
            <template v-if="importSuccess">
              <UAlert
                icon="i-lucide-check-circle"
                color="success"
                class="mb-4"
              >
                <template #description>
                  {{ $t('importPage.success') }}
                </template>
              </UAlert>
            </template>

            <!-- Non connecté -->
            <template v-else-if="!isAuthenticated">
              <p class="text-muted mb-4">
                {{ $t('importPage.loginToImport') }}
              </p>
              <UButton
                :label="$t('auth.loginXbox')"
                icon="i-lucide-gamepad-2"
                color="success"
                size="lg"
                @click="loginWithMicrosoft"
              />
            </template>

            <!-- Connecté, peut importer -->
            <template v-else>
              <p class="text-muted mb-4">
                {{ $t('importPage.dataAssociated') }} <strong>{{ user?.username }}</strong>.
              </p>
              <UButton
                :label="$t('importPage.importMyReputations')"
                icon="i-lucide-download"
                size="lg"
                :loading="isImporting"
                @click="handleImport"
              />
            </template>
          </div>
        </UCard>
      </template>
    </div>
  </UContainer>
</template>
