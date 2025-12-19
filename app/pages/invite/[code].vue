<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const { t } = useI18n()
const { isAuthenticated, isLoading: authLoading, loginWithMicrosoft } = useAuth()

const code = route.params.code as string

// Récupérer les infos de l'invitation
const { data: inviteInfo, error, status } = await useFetch<{
  groupName: string
  groupUid: string
  alreadyMember: boolean
  isAuthenticated: boolean
}>(`/api/invite/${code}`)

const isJoining = ref(false)
const hasJoined = ref(false)

async function handleJoin() {
  isJoining.value = true
  try {
    const result = await $fetch<{ success: boolean; message: string; groupUid: string }>(`/api/invite/${code}`, {
      method: 'POST'
    })
    toast.add({
      title: t('invite.welcome'),
      description: result.message,
      color: 'success'
    })
    hasJoined.value = true
    // Rediriger vers le groupe après 1 seconde
    setTimeout(() => {
      navigateTo(`/${result.groupUid}`)
    }, 1000)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: t('common.error'),
      description: err.data?.message || t('invite.joinError'),
      color: 'error'
    })
  } finally {
    isJoining.value = false
  }
}

function goToGroup() {
  if (inviteInfo.value?.groupUid) {
    navigateTo(`/${inviteInfo.value.groupUid}`)
  }
}
</script>

<template>
  <UContainer class="py-16">
    <div class="max-w-md mx-auto">
      <!-- Chargement -->
      <div v-if="status === 'pending' || authLoading" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
      </div>

      <!-- Erreur : invitation non trouvée ou expirée -->
      <template v-else-if="error">
        <UCard>
          <div class="text-center py-8">
            <UIcon name="i-lucide-link-2-off" class="w-16 h-16 text-error mx-auto mb-4" />
            <h1 class="text-2xl font-pirate mb-2">{{ $t('invite.invalidInvitation') }}</h1>
            <p class="text-muted mb-6">
              {{ error.data?.message || $t('invite.invalidInvitationMessage') }}
            </p>
            <UButton
              :label="$t('invite.backToHome')"
              icon="i-lucide-home"
              @click="navigateTo('/')"
            />
          </div>
        </UCard>
      </template>

      <!-- Invitation valide -->
      <template v-else-if="inviteInfo">
        <UCard>
          <div class="text-center py-4">
            <UIcon name="i-lucide-users" class="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 class="text-2xl font-pirate mb-2">{{ $t('invite.invitationToGroup') }}</h1>
            <p class="text-lg mb-6">
              {{ $t('invite.invitedToJoin') }}
              <strong class="text-primary">{{ inviteInfo.groupName }}</strong>
            </p>

            <!-- Déjà membre -->
            <template v-if="inviteInfo.alreadyMember">
              <UAlert icon="i-lucide-check-circle" color="success" class="mb-4">
                <template #description>
                  {{ $t('invite.alreadyMember') }}
                </template>
              </UAlert>
              <UButton
                :label="$t('invite.accessGroup')"
                icon="i-lucide-arrow-right"
                @click="goToGroup"
              />
            </template>

            <!-- A rejoint avec succès -->
            <template v-else-if="hasJoined">
              <UAlert icon="i-lucide-check-circle" color="success" class="mb-4">
                <template #description>
                  {{ $t('invite.joinedRedirecting') }}
                </template>
              </UAlert>
            </template>

            <!-- Non connecté -->
            <template v-else-if="!isAuthenticated">
              <p class="text-muted mb-4">
                {{ $t('invite.loginToJoin') }}
              </p>
              <UButton
                :label="$t('auth.loginXbox')"
                icon="i-lucide-gamepad-2"
                color="success"
                size="lg"
                @click="loginWithMicrosoft"
              />
            </template>

            <!-- Connecté, peut rejoindre -->
            <template v-else>
              <UButton
                :label="$t('invite.joinGroup')"
                icon="i-lucide-user-plus"
                size="lg"
                :loading="isJoining"
                @click="handleJoin"
              />
            </template>
          </div>
        </UCard>
      </template>
    </div>
  </UContainer>
</template>
