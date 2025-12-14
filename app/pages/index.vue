<script setup lang="ts">
const toast = useToast()
const { user, isAuthenticated, isLoading, login } = useAuth()
const { groups, fetchGroups, createGroup } = useGroups()

// Formulaire de connexion
const loginForm = ref({
  username: '',
  password: ''
})
const isLoggingIn = ref(false)
const loginError = ref('')

// Modal création de groupe
const isCreateGroupModalOpen = ref(false)
const newGroupName = ref('')
const isCreatingGroup = ref(false)

// Charger les groupes si connecté
watch(isAuthenticated, async (authenticated) => {
  if (authenticated) {
    await fetchGroups()
  }
}, { immediate: true })

async function handleLogin() {
  if (!loginForm.value.username || !loginForm.value.password) {
    loginError.value = 'Pseudo et mot de passe requis'
    return
  }

  isLoggingIn.value = true
  loginError.value = ''

  try {
    await login(loginForm.value.username, loginForm.value.password)
    toast.add({
      title: 'Connexion reussie',
      description: `Bienvenue, ${loginForm.value.username} !`,
      color: 'success'
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string }
    loginError.value = err.data?.message || err.message || 'Erreur de connexion'
  } finally {
    isLoggingIn.value = false
  }
}

async function handleCreateGroup() {
  if (!newGroupName.value.trim()) {
    toast.add({
      title: 'Erreur',
      description: 'Nom du groupe requis',
      color: 'error'
    })
    return
  }

  isCreatingGroup.value = true

  try {
    const group = await createGroup(newGroupName.value.trim())
    toast.add({
      title: 'Groupe cree',
      description: `Le groupe "${group.name}" a ete cree`,
      color: 'success'
    })
    isCreateGroupModalOpen.value = false
    newGroupName.value = ''

    // Rediriger vers le groupe
    navigateTo(`/${group.uid}`)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string }
    toast.add({
      title: 'Erreur',
      description: err.data?.message || err.message || 'Erreur lors de la creation',
      color: 'error'
    })
  } finally {
    isCreatingGroup.value = false
  }
}
</script>

<template>
  <UContainer class="py-8">
    <!-- Chargement -->
    <div v-if="isLoading" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
    </div>

    <!-- Non connecté : Formulaire de connexion -->
    <template v-else-if="!isAuthenticated">
      <div class="max-w-md mx-auto">
        <div class="text-center mb-8">
          <UIcon name="i-lucide-anchor" class="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 class="text-3xl font-pirate mb-2">
            SoT Reputations
          </h1>
          <p class="text-muted">
            Connectez-vous pour acceder a vos groupes de comparaison
          </p>
        </div>

        <UCard>
          <form @submit.prevent="handleLogin" class="space-y-4">
            <UAlert
              v-if="loginError"
              icon="i-lucide-alert-circle"
              color="error"
              :title="loginError"
              class="mb-4"
            />

            <UFormField label="Pseudo">
              <UInput
                v-model="loginForm.username"
                placeholder="Votre pseudo de pirate"
                icon="i-lucide-user"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Mot de passe">
              <UInput
                v-model="loginForm.password"
                type="password"
                placeholder="Votre mot de passe"
                icon="i-lucide-lock"
                class="w-full"
              />
            </UFormField>

            <UButton
              type="submit"
              label="Se connecter"
              icon="i-lucide-log-in"
              :loading="isLoggingIn"
              block
            />
          </form>

          <template #footer>
            <p class="text-sm text-muted text-center">
              Pas encore de compte ?
              <NuxtLink to="/tutoriel" class="text-primary hover:underline">
                Suivez le tutoriel
              </NuxtLink>
              pour importer vos donnees.
            </p>
          </template>
        </UCard>
      </div>
    </template>

    <!-- Connecté : Liste des groupes -->
    <template v-else>
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-pirate">
            Mes groupes
          </h1>
          <p class="text-muted mt-1">
            Bienvenue, {{ user?.username }} !
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          label="Creer un groupe"
          @click="isCreateGroupModalOpen = true"
        />
      </div>

      <!-- Liste des groupes -->
      <div v-if="groups.length === 0" class="text-center py-16">
        <UIcon name="i-lucide-users" class="w-16 h-16 text-muted mx-auto mb-4" />
        <h2 class="text-xl font-semibold mb-2">
          Aucun groupe
        </h2>
        <p class="text-muted mb-4">
          Creez un groupe pour commencer a comparer vos reputations avec d'autres pirates !
        </p>
        <UButton
          icon="i-lucide-plus"
          label="Creer mon premier groupe"
          @click="isCreateGroupModalOpen = true"
        />
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="group in groups"
          :key="group.uid"
          :to="`/${group.uid}`"
          class="block"
        >
          <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="font-semibold text-lg">
                  {{ group.name }}
                </h3>
                <UBadge
                  :color="group.role === 'admin' ? 'primary' : 'neutral'"
                  :label="group.role === 'admin' ? 'Admin' : 'Membre'"
                  size="sm"
                  class="mt-2"
                />
              </div>
              <UIcon name="i-lucide-chevron-right" class="w-5 h-5 text-muted" />
            </div>
          </UCard>
        </NuxtLink>
      </div>

      <!-- Modal création de groupe -->
      <UModal v-model:open="isCreateGroupModalOpen">
        <template #content>
          <UCard>
            <template #header>
              <h2 class="text-xl font-semibold">
                Creer un nouveau groupe
              </h2>
            </template>

            <form @submit.prevent="handleCreateGroup" class="space-y-4">
              <UFormField label="Nom du groupe">
                <UInput
                  v-model="newGroupName"
                  placeholder="Ex: Mon equipage"
                  icon="i-lucide-users"
                  class="w-full"
                />
              </UFormField>
            </form>

            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton
                  label="Annuler"
                  color="neutral"
                  variant="outline"
                  @click="isCreateGroupModalOpen = false"
                />
                <UButton
                  label="Creer"
                  icon="i-lucide-plus"
                  :loading="isCreatingGroup"
                  @click="handleCreateGroup"
                />
              </div>
            </template>
          </UCard>
        </template>
      </UModal>
    </template>
  </UContainer>
</template>
