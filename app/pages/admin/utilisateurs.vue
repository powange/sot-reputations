<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

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
  moderator: 'Modérateur',
  member: 'Membre'
}

const roleColors: Record<string, string> = {
  chef: 'warning',
  moderator: 'info',
  member: 'neutral'
}

const siteRoleOptions = [
  { label: 'Utilisateur', value: 'user' },
  { label: 'Modérateur', value: 'moderator' },
  { label: 'Administrateur', value: 'admin' }
]

function getUserSiteRole(user: User): string {
  if (user.isAdmin) return 'admin'
  if (user.isModerator) return 'moderator'
  return 'user'
}

function getSiteRoleLabel(user: User): string {
  if (user.isAdmin) return 'Admin'
  if (user.isModerator) return 'Modérateur'
  return 'Utilisateur'
}

function getSiteRoleColor(user: User): string {
  if (user.isAdmin) return 'warning'
  if (user.isModerator) return 'info'
  return 'neutral'
}

// Valeur numérique pour le tri des rôles
function getSiteRoleOrder(user: User): number {
  if (user.isAdmin) return 0
  if (user.isModerator) return 1
  return 2
}

async function changeUserRole(user: User, newRole: string) {
  try {
    await $fetch(`/api/admin/users/${user.id}/role`, {
      method: 'PUT',
      body: { role: newRole }
    })
    toast.add({
      title: 'Droits modifiés',
      description: `${user.username} est maintenant ${newRole === 'admin' ? 'administrateur' : newRole === 'moderator' ? 'modérateur' : 'utilisateur'}`,
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

// Configuration du tri
const sorting = ref([{ id: 'username', desc: false }])

function getSortIcon(columnId: string) {
  const sort = sorting.value.find(s => s.id === columnId)
  if (!sort) return 'i-lucide-arrow-up-down'
  return sort.desc ? 'i-lucide-arrow-down-wide-narrow' : 'i-lucide-arrow-up-narrow-wide'
}

function toggleSort(columnId: string) {
  const existingSort = sorting.value.find(s => s.id === columnId)
  if (!existingSort) {
    sorting.value = [{ id: columnId, desc: false }]
  } else if (!existingSort.desc) {
    sorting.value = [{ id: columnId, desc: true }]
  } else {
    sorting.value = [{ id: columnId, desc: false }]
  }
}

// Colonnes du tableau
const columns: TableColumn<User>[] = [
  {
    accessorKey: 'username',
    header: () => h('button', {
      class: 'flex items-center gap-1 font-medium hover:text-primary transition-colors',
      onClick: () => toggleSort('username')
    }, [
      'Utilisateur',
      h(resolveComponent('UIcon'), { name: getSortIcon('username'), class: 'w-4 h-4' })
    ])
  },
  {
    accessorKey: 'role',
    id: 'role',
    accessorFn: (row) => getSiteRoleOrder(row),
    header: () => h('button', {
      class: 'flex items-center gap-1 font-medium hover:text-primary transition-colors',
      onClick: () => toggleSort('role')
    }, [
      'Droits',
      h(resolveComponent('UIcon'), { name: getSortIcon('role'), class: 'w-4 h-4' })
    ])
  },
  {
    accessorKey: 'groups',
    id: 'groups',
    accessorFn: (row) => row.groups.length,
    header: () => h('button', {
      class: 'flex items-center gap-1 font-medium hover:text-primary transition-colors',
      onClick: () => toggleSort('groups')
    }, [
      'Groupes',
      h(resolveComponent('UIcon'), { name: getSortIcon('groups'), class: 'w-4 h-4' })
    ])
  },
  {
    accessorKey: 'createdAt',
    header: () => h('button', {
      class: 'flex items-center gap-1 font-medium hover:text-primary transition-colors',
      onClick: () => toggleSort('createdAt')
    }, [
      'Inscription',
      h(resolveComponent('UIcon'), { name: getSortIcon('createdAt'), class: 'w-4 h-4' })
    ])
  },
  {
    accessorKey: 'lastImportAt',
    header: () => h('button', {
      class: 'flex items-center gap-1 font-medium hover:text-primary transition-colors',
      onClick: () => toggleSort('lastImportAt')
    }, [
      'Dernier import',
      h(resolveComponent('UIcon'), { name: getSortIcon('lastImportAt'), class: 'w-4 h-4' })
    ])
  }
]

// Données triées
const sortedUsers = computed(() => {
  if (!users.value) return []

  const sorted = [...users.value]
  const sort = sorting.value[0]

  if (!sort) return sorted

  sorted.sort((a, b) => {
    let aVal: any
    let bVal: any

    switch (sort.id) {
      case 'username':
        aVal = a.username.toLowerCase()
        bVal = b.username.toLowerCase()
        break
      case 'role':
        aVal = getSiteRoleOrder(a)
        bVal = getSiteRoleOrder(b)
        break
      case 'groups':
        aVal = a.groups.length
        bVal = b.groups.length
        break
      case 'createdAt':
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0
        break
      case 'lastImportAt':
        aVal = a.lastImportAt ? new Date(a.lastImportAt).getTime() : 0
        bVal = b.lastImportAt ? new Date(b.lastImportAt).getTime() : 0
        break
      default:
        return 0
    }

    if (aVal < bVal) return sort.desc ? 1 : -1
    if (aVal > bVal) return sort.desc ? -1 : 1
    return 0
  })

  return sorted
})
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

      <div v-else-if="sortedUsers && sortedUsers.length > 0" class="overflow-x-auto">
        <UTable
          :data="sortedUsers"
          :columns="columns"
          class="w-full"
        >
          <template #username-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ row.original.username }}</span>
              <UIcon
                v-if="row.original.microsoftId"
                name="i-simple-icons-xbox"
                class="w-4 h-4 text-green-500"
                title="Compte Xbox"
              />
            </div>
          </template>

          <template #role-cell="{ row }">
            <UDropdownMenu
              v-if="row.original.id !== currentUser?.id"
              :items="siteRoleOptions.map(opt => ({
                label: opt.label,
                icon: getUserSiteRole(row.original) === opt.value ? 'i-lucide-check' : undefined,
                onSelect: () => changeUserRole(row.original, opt.value)
              }))"
            >
              <UButton
                :color="getSiteRoleColor(row.original)"
                size="xs"
                variant="subtle"
                trailing-icon="i-lucide-chevron-down"
              >
                {{ getSiteRoleLabel(row.original) }}
              </UButton>
            </UDropdownMenu>
            <UBadge
              v-else
              :color="getSiteRoleColor(row.original)"
              size="xs"
            >
              {{ getSiteRoleLabel(row.original) }} (vous)
            </UBadge>
          </template>

          <template #groups-cell="{ row }">
            <div v-if="row.original.groups.length > 0" class="flex flex-wrap gap-1">
              <UBadge
                v-for="group in row.original.groups"
                :key="group.uid"
                :color="roleColors[group.role] || 'neutral'"
                size="xs"
                variant="subtle"
              >
                {{ group.name }} ({{ roleLabels[group.role] || group.role }})
              </UBadge>
            </div>
            <span v-else class="text-muted">-</span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-muted">{{ formatDate(row.original.createdAt) }}</span>
          </template>

          <template #lastImportAt-cell="{ row }">
            <span class="text-muted">{{ formatDate(row.original.lastImportAt) }}</span>
          </template>
        </UTable>
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
