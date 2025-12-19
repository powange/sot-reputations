<script setup lang="ts">
const { isAdmin, isAuthenticated, user: currentUser } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Utilisateurs - Administration'
})

// Redirection si non admin
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value || !isAdmin.value) {
      navigateTo('/')
    }
  }
})

interface UserGroup {
  uid: string
  name: string
  role: string
}

interface User {
  id: number
  username: string
  isAdmin: boolean
  isModerator: boolean
  microsoftId: string | null
  createdAt: string
  lastImportAt: string | null
  groups: UserGroup[]
}

const { data: users, status, refresh } = await useFetch<User[]>('/api/admin/users')

const roleLabels: Record<string, string> = {
  chef: 'Chef',
  moderator: 'Moderateur',
  member: 'Membre'
}

const roleColors: Record<string, string> = {
  chef: 'warning',
  moderator: 'info',
  member: 'neutral'
}

const siteRoleOptions = [
  { label: 'Utilisateur', value: 'user' },
  { label: 'Moderateur', value: 'moderator' },
  { label: 'Administrateur', value: 'admin' }
]

function getUserSiteRole(user: User): string {
  if (user.isAdmin) return 'admin'
  if (user.isModerator) return 'moderator'
  return 'user'
}

function getSiteRoleLabel(user: User): string {
  if (user.isAdmin) return 'Admin'
  if (user.isModerator) return 'Moderateur'
  return 'Utilisateur'
}

function getSiteRoleColor(user: User): string {
  if (user.isAdmin) return 'warning'
  if (user.isModerator) return 'info'
  return 'neutral'
}

async function changeUserRole(user: User, newRole: string) {
  try {
    await $fetch(`/api/admin/users/${user.id}/role`, {
      method: 'PUT',
      body: { role: newRole }
    })
    toast.add({
      title: 'Droits modifies',
      description: `${user.username} est maintenant ${newRole === 'admin' ? 'administrateur' : newRole === 'moderator' ? 'moderateur' : 'utilisateur'}`,
      color: 'success'
    })
    await refresh()
  }
  catch (e) {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de modifier les droits',
      color: 'error'
    })
  }
}

function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
</script>

<template>
  <UContainer class="py-8 max-w-6xl">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        Utilisateurs
      </h1>
      <p class="text-muted mt-2">
        Liste de tous les utilisateurs inscrits
      </p>
    </div>

    <UCard>
      <div v-if="status === 'pending'" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="users && users.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-muted">
              <th class="text-left py-3 px-4 font-medium">Utilisateur</th>
              <th class="text-left py-3 px-4 font-medium">Droits</th>
              <th class="text-left py-3 px-4 font-medium">Groupes</th>
              <th class="text-left py-3 px-4 font-medium">Inscription</th>
              <th class="text-left py-3 px-4 font-medium">Dernier import</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in users"
              :key="u.id"
              class="border-b border-muted/50 hover:bg-muted/20"
            >
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ u.username }}</span>
                  <UIcon
                    v-if="u.microsoftId"
                    name="i-simple-icons-xbox"
                    class="w-4 h-4 text-green-500"
                    title="Compte Xbox"
                  />
                </div>
              </td>
              <td class="py-3 px-4">
                <UDropdownMenu
                  v-if="u.id !== currentUser?.id"
                  :items="[[
                    ...siteRoleOptions.map(opt => ({
                      label: opt.label,
                      icon: getUserSiteRole(u) === opt.value ? 'i-lucide-check' : undefined,
                      onSelect: () => changeUserRole(u, opt.value)
                    }))
                  ]]"
                >
                  <UButton
                    :color="getSiteRoleColor(u)"
                    size="xs"
                    variant="subtle"
                    trailing-icon="i-lucide-chevron-down"
                  >
                    {{ getSiteRoleLabel(u) }}
                  </UButton>
                </UDropdownMenu>
                <UBadge
                  v-else
                  :color="getSiteRoleColor(u)"
                  size="xs"
                >
                  {{ getSiteRoleLabel(u) }} (vous)
                </UBadge>
              </td>
              <td class="py-3 px-4">
                <div v-if="u.groups.length > 0" class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="group in u.groups"
                    :key="group.uid"
                    :color="roleColors[group.role] || 'neutral'"
                    size="xs"
                    variant="subtle"
                  >
                    {{ group.name }} ({{ roleLabels[group.role] || group.role }})
                  </UBadge>
                </div>
                <span v-else class="text-muted">-</span>
              </td>
              <td class="py-3 px-4 text-muted">
                {{ formatDate(u.createdAt) }}
              </td>
              <td class="py-3 px-4 text-muted">
                {{ formatDate(u.lastImportAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="text-center py-8 text-muted">
        Aucun utilisateur
      </div>

      <template v-if="users" #footer>
        <p class="text-sm text-muted">
          {{ users.length }} utilisateur{{ users.length > 1 ? 's' : '' }}
        </p>
      </template>
    </UCard>
  </UContainer>
</template>
