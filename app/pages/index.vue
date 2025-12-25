<script setup lang="ts">
type GroupRole = 'chef' | 'moderator' | 'member'

const { t } = useI18n()
const toast = useToast()
const { user, isAuthenticated, isLoading, loginWithMicrosoft } = useAuth()
const { groups, pendingInvites, isLoadingGroups, fetchGroups, createGroup, fetchPendingInvites, acceptInvite, rejectInvite } = useGroups()

// Labels des rôles
const roleLabels = computed<Record<GroupRole, string>>(() => ({
  chef: t('groups.roles.chef'),
  moderator: t('groups.roles.moderator'),
  member: t('groups.roles.member')
}))

const roleBadgeColors: Record<GroupRole, 'primary' | 'info' | 'neutral'> = {
  chef: 'primary',
  moderator: 'info',
  member: 'neutral'
}

// Vérifier si erreur OAuth dans l'URL
const route = useRoute()
if (route.query.error === 'oauth') {
  toast.add({
    title: t('auth.loginError'),
    description: t('auth.loginErrorMessage'),
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
      title: t('groups.invitationAccepted'),
      description: response.message,
      color: 'success'
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string }
    toast.add({
      title: t('common.error'),
      description: err.data?.message || err.message || t('groups.errorAccepting'),
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
      title: t('groups.invitationDeclined'),
      description: t('groups.invitationDeclinedMessage'),
      color: 'info'
    })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string }
    toast.add({
      title: t('common.error'),
      description: err.data?.message || err.message || t('groups.errorDeclining'),
      color: 'error'
    })
  } finally {
    processingInvites.value = processingInvites.value.filter(id => id !== inviteId)
  }
}

async function handleCreateGroup() {
  if (!newGroupName.value.trim()) {
    toast.add({
      title: t('common.error'),
      description: t('groups.groupNameRequired'),
      color: 'error'
    })
    return
  }

  isCreatingGroup.value = true

  try {
    const group = await createGroup(newGroupName.value.trim())
    toast.add({
      title: t('groups.groupCreated'),
      description: t('groups.groupCreatedMessage', { name: group.name }),
      color: 'success'
    })
    isCreateGroupModalOpen.value = false
    newGroupName.value = ''

    // Rediriger vers le groupe
    navigateTo(`/${group.uid}`)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string }
    toast.add({
      title: t('common.error'),
      description: err.data?.message || err.message || t('groups.errorCreating'),
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
            {{ $t('auth.loginPrompt') }}
          </p>
        </div>

        <UCard>
          <div class="space-y-4">
            <UButton
              :label="$t('auth.loginXbox')"
              icon="i-lucide-gamepad-2"
              color="success"
              size="lg"
              block
              @click="loginWithMicrosoft"
            />

            <div class="text-xs text-muted space-y-1 pt-2 border-t border-muted/20">
              <p class="flex items-start gap-1.5">
                <UIcon name="i-lucide-info" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{{ $t('auth.dataCollectedInfo') }}</span>
              </p>
              <p class="pl-5">
                <NuxtLink to="/mentions-legales" class="text-primary hover:underline">
                  {{ $t('auth.seePrivacyPolicy') }}
                </NuxtLink>
              </p>
            </div>
          </div>

          <template #footer>
            <p class="text-sm text-muted text-center">
              {{ $t('auth.needHelp') }}
              <NuxtLink to="/tutoriel" class="text-primary hover:underline">
                {{ $t('auth.checkTutorial') }}
              </NuxtLink>
              {{ $t('auth.toImportData') }}
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
            {{ $t('groups.title') }}
          </h1>
          <p class="text-muted mt-1">
            {{ $t('groups.welcome', { username: user?.username }) }}
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          :label="$t('groups.createGroup')"
          @click="isCreateGroupModalOpen = true"
        />
      </div>

      <!-- Invitations en attente -->
      <div v-if="pendingInvites.length > 0" class="mb-8">
        <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
          <UIcon name="i-lucide-mail" class="w-5 h-5 text-primary" />
          {{ $t('groups.pendingInvitations') }}
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
                  {{ $t('groups.invitedBy', { username: invite.invitedByUsername }) }}
                </p>
              </div>
              <div class="flex gap-2">
                <UButton
                  :label="$t('common.accept')"
                  icon="i-lucide-check"
                  color="success"
                  size="sm"
                  :loading="processingInvites.includes(invite.id)"
                  @click="handleAcceptInvite(invite.id)"
                />
                <UButton
                  :label="$t('common.decline')"
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
      <div v-if="isLoadingGroups" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
      </div>

      <div v-else-if="groups.length === 0" class="text-center py-16">
        <UIcon name="i-lucide-users" class="w-16 h-16 text-muted mx-auto mb-4" />
        <h2 class="text-xl font-semibold mb-2">
          {{ $t('groups.noGroups') }}
        </h2>
        <p class="text-muted mb-4">
          {{ $t('groups.noGroupsDescription') }}
        </p>
        <UButton
          icon="i-lucide-plus"
          :label="$t('groups.createFirstGroup')"
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
                {{ $t('groups.createNewGroup') }}
              </h2>
            </template>

            <form @submit.prevent="handleCreateGroup" class="space-y-4">
              <UFormField :label="$t('groups.groupName')">
                <UInput
                  v-model="newGroupName"
                  :placeholder="$t('groups.groupNamePlaceholder')"
                  icon="i-lucide-users"
                  class="w-full"
                />
              </UFormField>
            </form>

            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton
                  :label="$t('common.cancel')"
                  color="neutral"
                  variant="outline"
                  @click="isCreateGroupModalOpen = false"
                />
                <UButton
                  :label="$t('common.create')"
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
