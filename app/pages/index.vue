<script setup lang="ts">
type GroupRole = 'chef' | 'moderator' | 'member'

const toast = useToast()
const { user, isAuthenticated, isLoading, loginWithMicrosoft } = useAuth()
const { groups, pendingInvites, fetchGroups, createGroup, fetchPendingInvites, acceptInvite, rejectInvite } = useGroups()

// Labels des rôles
const roleLabels: Record<GroupRole, string> = {
  chef: 'Chef de groupe',
  moderator: 'Modérateur',
  member: 'Membre'
}

const roleBadgeColors: Record<GroupRole, 'primary' | 'info' | 'neutral'> = {
  chef: 'primary',
  moderator: 'info',
  member: 'neutral'
}

// Vérifier si erreur OAuth dans l'URL
const route = useRoute()
if (route.query.error === 'oauth') {
  toast.add({
    title: 'Erreur de connexion',
    description: 'La connexion Xbox a echoue. Veuillez reessayer.',
    color: 'error'
  })
}

// Modal création de groupe
const isCreateGroupModalOpen = ref(false)
const newGroupName = ref('')
const isCreatingGroup = ref(false)

// Charger les groupes et invitations si connecté
watch(isAuthenticated, async (authenticated) => {
  if (authenticated) {
    await Promise.all([fetchGroups(), fetchPendingInvites()])
  }
}, { immediate: true })

// Gestion des invitations
const processingInvites = ref<number[]>([])

async function handleAcceptInvite(inviteId: number) {
  processingInvites.value.push(inviteId)
  try {
    const response = await acceptInvite(inviteId)
    toast.add({
      title: 'Invitation acceptee',
      description: response.message,
      color: 'success'
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string }
    toast.add({
      title: 'Erreur',
      description: err.data?.message || err.message || 'Erreur lors de l\'acceptation',
      color: 'error'
    })
  } finally {
    processingInvites.value = processingInvites.value.filter(id => id !== inviteId)
  }
}

async function handleRejectInvite(inviteId: number) {
  processingInvites.value.push(inviteId)
  try {
    await rejectInvite(inviteId)
    toast.add({
      title: 'Invitation refusee',
      description: 'L\'invitation a ete refusee',
      color: 'info'
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string }
    toast.add({
      title: 'Erreur',
      description: err.data?.message || err.message || 'Erreur lors du refus',
      color: 'error'
    })
  } finally {
    processingInvites.value = processingInvites.value.filter(id => id !== inviteId)
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

    <!-- Non connecté : Bouton connexion Xbox -->
    <template v-else-if="!isAuthenticated">
      <div class="max-w-md mx-auto">
        <div class="text-center mb-8">
          <UIcon name="i-lucide-anchor" class="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 class="text-3xl font-pirate mb-2">
            SoT Reputations
          </h1>
          <p class="text-muted">
            Connectez-vous avec votre compte Xbox pour acceder a vos groupes de comparaison
          </p>
        </div>

        <UCard>
          <div class="space-y-4">
            <UButton
              label="Connexion Xbox"
              icon="i-lucide-gamepad-2"
              color="success"
              size="lg"
              block
              @click="loginWithMicrosoft"
            />
          </div>

          <template #footer>
            <p class="text-sm text-muted text-center">
              Besoin d'aide ?
              <NuxtLink to="/tutoriel" class="text-primary hover:underline">
                Consultez le tutoriel
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

      <!-- Invitations en attente -->
      <div v-if="pendingInvites.length > 0" class="mb-8">
        <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
          <UIcon name="i-lucide-mail" class="w-5 h-5 text-primary" />
          Invitations en attente
          <UBadge :label="String(pendingInvites.length)" color="primary" size="sm" />
        </h2>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <UCard v-for="invite in pendingInvites" :key="invite.id" class="border-2 border-primary/30">
            <div class="space-y-3">
              <div>
                <h3 class="font-semibold text-lg">
                  {{ invite.groupName }}
                </h3>
                <p class="text-sm text-muted">
                  Invite par {{ invite.invitedByUsername }}
                </p>
              </div>
              <div class="flex gap-2">
                <UButton
                  label="Accepter"
                  icon="i-lucide-check"
                  color="success"
                  size="sm"
                  :loading="processingInvites.includes(invite.id)"
                  @click="handleAcceptInvite(invite.id)"
                />
                <UButton
                  label="Refuser"
                  icon="i-lucide-x"
                  color="error"
                  variant="outline"
                  size="sm"
                  :loading="processingInvites.includes(invite.id)"
                  @click="handleRejectInvite(invite.id)"
                />
              </div>
            </div>
          </UCard>
        </div>
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
                  :color="roleBadgeColors[group.role as GroupRole]"
                  :label="roleLabels[group.role as GroupRole]"
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
