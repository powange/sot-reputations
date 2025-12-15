<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const { user, isAuthenticated, isLoading: authLoading, loginWithMicrosoft } = useAuth()

const code = route.params.code as string

// Récupérer les données temporaires
const { data: tempData, error, status } = await useFetch<{ success: boolean; data: unknown }>(`/api/import-temp/${code}`)

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
      title: 'Import reussi !',
      description: 'Vos donnees de reputation ont ete importees.',
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
      title: 'Erreur',
      description: err.data?.message || 'Erreur lors de l\'import',
      color: 'error'
    })
  } finally {
    isImporting.value = false
  }
}

// Compter le nombre d'emblèmes dans les données
const emblemCount = computed(() => {
  if (!tempData.value?.data) return 0
  const data = tempData.value.data as Record<string, { Emblems?: { Emblems?: unknown[] }, Campaigns?: Record<string, { Emblems?: unknown[] }> }>
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

const factionCount = computed(() => {
  if (!tempData.value?.data) return 0
  return Object.keys(tempData.value.data as object).length
})
</script>

<template>
  <UContainer class="py-16">
    <div class="max-w-md mx-auto">
      <!-- Chargement -->
      <div v-if="status === 'pending' || authLoading" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
      </div>

      <!-- Erreur : données non trouvées ou expirées -->
      <template v-else-if="error">
        <UCard>
          <div class="text-center py-8">
            <UIcon name="i-lucide-clock" class="w-16 h-16 text-error mx-auto mb-4" />
            <h1 class="text-2xl font-pirate mb-2">Lien expire</h1>
            <p class="text-muted mb-6">
              Ce lien d'import a expire ou a deja ete utilise.
              <br />
              Veuillez relancer le bookmarklet sur le site Sea of Thieves.
            </p>
            <UButton
              label="Retour a l'accueil"
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
            <UIcon name="i-lucide-download" class="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 class="text-2xl font-pirate mb-2">Importer mes reputations</h1>

            <!-- Résumé des données -->
            <div class="bg-muted/50 rounded-lg p-4 mb-6">
              <p class="text-sm text-muted mb-2">Donnees recuperees :</p>
              <div class="flex justify-center gap-6">
                <div class="text-center">
                  <div class="text-2xl font-bold text-primary">{{ factionCount }}</div>
                  <div class="text-xs text-muted">Factions</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-primary">{{ emblemCount }}</div>
                  <div class="text-xs text-muted">Emblemes</div>
                </div>
              </div>
            </div>

            <!-- Import réussi -->
            <template v-if="importSuccess">
              <UAlert icon="i-lucide-check-circle" color="success" class="mb-4">
                <template #description>
                  Import reussi ! Redirection en cours...
                </template>
              </UAlert>
            </template>

            <!-- Non connecté -->
            <template v-else-if="!isAuthenticated">
              <p class="text-muted mb-4">
                Connectez-vous avec votre compte Xbox pour importer ces donnees.
              </p>
              <UButton
                label="Connexion Xbox"
                icon="i-lucide-gamepad-2"
                color="success"
                size="lg"
                @click="loginWithMicrosoft"
              />
            </template>

            <!-- Connecté, peut importer -->
            <template v-else>
              <p class="text-muted mb-4">
                Ces donnees seront associees a votre compte <strong>{{ user?.username }}</strong>.
              </p>
              <UButton
                label="Importer mes reputations"
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
