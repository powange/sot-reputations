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

// Filtres
const searchQuery = ref('')
const selectedGroup = ref<string | null>(null)

// Pagination
const currentPage = ref(1)
const perPage = ref(30)
const perPageOptions = [
  { value: 10, label: '10 par page' },
  { value: 30, label: '30 par page' },
  { value: 50, label: '50 par page' },
  { value: 100, label: '100 par page' }
]

// Reset page quand les filtres ou le nombre par page changent
watch([searchQuery, selectedGroup, perPage], () => {
  currentPage.value = 1
})

// Liste des groupes disponibles pour le filtre
const availableGroups = computed(() => {
  if (!users.value) return []
  const groups = new Map<string, string>()
  for (const user of users.value) {
    for (const group of user.groups) {
      groups.set(group.uid, group.name)
    }
  }
  return Array.from(groups.entries())
    .map(([uid, name]) => ({ value: uid, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

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

// Configuration du tri (par défaut: date d'inscription décroissante)
const sorting = ref([{ id: 'createdAt', desc: true }])

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

// Données filtrées et triées
const sortedUsers = computed(() => {
  if (!users.value) return []

  // Filtrage par recherche pseudo
  let filtered = users.value.filter((user) => {
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      if (!user.username.toLowerCase().includes(query)) {
        return false
      }
    }
    // Filtrage par groupe
    if (selectedGroup.value) {
      if (!user.groups.some(g => g.uid === selectedGroup.value)) {
        return false
      }
    }
    return true
  })

  const sorted = [...filtered]
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

// Pagination
const totalPages = computed(() => Math.ceil(sortedUsers.value.length / perPage.value))

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  const end = start + perPage.value
  return sortedUsers.value.slice(start, end)
})

// Reset page si elle dépasse le nombre de pages
watch(totalPages, (newTotal) => {
  if (currentPage.value > newTotal && newTotal > 0) {
    currentPage.value = newTotal
  }
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
      <!-- Filtres -->
      <div class="flex flex-wrap items-center gap-4 mb-6">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Rechercher un pseudo..."
          class="w-64"
        />
        <USelectMenu
          v-model="selectedGroup"
          :items="[{ value: null, label: 'Tous les groupes' }, ...availableGroups]"
          value-key="value"
          class="w-64"
        />
        <USelectMenu
          v-model="perPage"
          :items="perPageOptions"
          value-key="value"
          class="w-40"
        />
      </div>

      <div v-if="status === 'pending'" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
      </div>

      <div v-else-if="sortedUsers && sortedUsers.length > 0" class="overflow-x-auto">
        <UTable
          :data="paginatedUsers"
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
                size="lg"
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
        <div class="flex flex-wrap items-center justify-between gap-4">
          <p class="text-sm text-muted">
            <template v-if="sortedUsers.length !== users.length">
              {{ sortedUsers.length }} / {{ users.length }} utilisateur{{ users.length > 1 ? 's' : '' }}
            </template>
            <template v-else>
              {{ users.length }} utilisateur{{ users.length > 1 ? 's' : '' }}
            </template>
          </p>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              variant="ghost"
              size="sm"
              :disabled="currentPage <= 1"
              @click="currentPage--"
            />
            <span class="text-sm text-muted px-2">
              Page {{ currentPage }} / {{ totalPages }}
            </span>
            <UButton
              icon="i-lucide-chevron-right"
              variant="ghost"
              size="sm"
              :disabled="currentPage >= totalPages"
              @click="currentPage++"
            />
          </div>
        </div>
      </template>
    </UCard>
  </UContainer>
</template>
