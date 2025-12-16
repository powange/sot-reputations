<script setup lang="ts">
const { isAdmin, isAuthenticated } = useAuth()

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
  microsoftId: string | null
  createdAt: string
  lastImportAt: string | null
  groups: UserGroup[]
}

const { data: users, status } = await useFetch<User[]>('/api/admin/users')

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
        label="Retour"
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
              <th class="text-left py-3 px-4 font-medium">Groupes</th>
              <th class="text-left py-3 px-4 font-medium">Inscription</th>
              <th class="text-left py-3 px-4 font-medium">Dernier import</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in users"
              :key="user.id"
              class="border-b border-muted/50 hover:bg-muted/20"
            >
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ user.username }}</span>
                  <UBadge v-if="user.isAdmin" color="warning" size="xs">
                    Admin
                  </UBadge>
                  <UIcon
                    v-if="user.microsoftId"
                    name="i-simple-icons-xbox"
                    class="w-4 h-4 text-green-500"
                    title="Compte Xbox"
                  />
                </div>
              </td>
              <td class="py-3 px-4">
                <div v-if="user.groups.length > 0" class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="group in user.groups"
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
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="py-3 px-4 text-muted">
                {{ formatDate(user.lastImportAt) }}
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
