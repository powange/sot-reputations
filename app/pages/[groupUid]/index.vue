<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface UserInfo {
  id: number
  username: string
  lastImportAt: string | null
}

type GroupRole = 'chef' | 'moderator' | 'member'

interface GroupMember {
  id: number
  groupId: number
  userId: number
  username: string
  role: GroupRole
  joinedAt: string
  lastImportAt: string | null
}

interface FactionInfo {
  id: number
  key: string
  name: string
  motto: string
}

interface GradeThreshold {
  grade: number
  threshold: number
}

interface EmblemInfo {
  id: number
  key: string
  name: string
  description: string
  image: string
  maxGrade: number
  maxThreshold: number | null
  gradeThresholds: GradeThreshold[]
  campaignId: number
  factionKey: string
  campaignName: string
}

interface UserEmblemProgress {
  userId: number
  username: string
  value: number
  threshold: number
  grade: number
  completed: boolean
}

interface CampaignWithEmblems {
  id: number
  key: string
  name: string
  description: string
  factionId: number
  emblems: Array<EmblemInfo & { userProgress: Record<number, UserEmblemProgress> }>
}

interface FactionWithCampaigns extends FactionInfo {
  campaigns: CampaignWithEmblems[]
}

interface GroupData {
  group: {
    id: number
    uid: string
    name: string
    createdAt: string
    createdBy: number
  }
  members: GroupMember[]
  userRole: GroupRole
  reputationData: {
    users: UserInfo[]
    factions: FactionWithCampaigns[]
  }
}

interface TableRow {
  id: number
  name: string
  description: string
  image: string
  maxThreshold: number | null
  gradeThresholds: GradeThreshold[]
  [key: string]: string | number | boolean | null | undefined | GradeThreshold[]
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { user, isAuthenticated } = useAuth()
const { leaveGroup } = useGroups()

const groupUid = route.params.groupUid as string

// Récupérer les données du groupe
const { data: groupData, error, refresh } = await useFetch<GroupData>(`/api/groups/${groupUid}`)

// Rediriger si erreur (non membre ou groupe non trouvé)
if (error.value) {
  navigateTo('/')
}

// Modals
const isMembersModalOpen = ref(false)
const isInviteModalOpen = ref(false)
const inviteUsername = ref('')
const isInviting = ref(false)

const isRoleModalOpen = ref(false)
const memberToChangeRole = ref<GroupMember | null>(null)
const newRoleSelected = ref<GroupRole>('member')
const isChangingRole = ref(false)

const isKickModalOpen = ref(false)
const memberToKick = ref<GroupMember | null>(null)
const isKicking = ref(false)

const isLeaveModalOpen = ref(false)
const isLeaving = ref(false)

const isDeleteModalOpen = ref(false)
const isDeleting = ref(false)

const isImportModalOpen = ref(false)
const importJsonText = ref('')
const isImporting = ref(false)

// Lien d'invitation
const inviteLink = ref<{ code: string } | null>(null)
const isLoadingInviteLink = ref(false)
const isGeneratingInviteLink = ref(false)

const fullInviteLink = computed(() => {
  if (!inviteLink.value) return ''
  const baseUrl = window.location.origin
  return `${baseUrl}/invite/${inviteLink.value.code}`
})

// Invitations en attente du groupe
interface GroupPendingInvite {
  id: number
  username: string
  invitedByUsername: string
  createdAt: string
}
const groupPendingInvites = ref<GroupPendingInvite[]>([])
const isLoadingGroupPendingInvites = ref(false)
const cancellingInviteIds = ref<number[]>([])

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

// Menu dropdown actions
const dropdownItems = computed(() => {
  const items = [
    [{
      label: 'Quitter le groupe',
      icon: 'i-lucide-log-out',
      onSelect: () => { isLeaveModalOpen.value = true }
    }]
  ]

  if (isChef.value) {
    items[0].push({
      label: 'Supprimer le groupe',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => { isDeleteModalOpen.value = true }
    })
  }

  return items
})

// Filtres - initialisés depuis l'URL
const selectedFactionKeys = ref<string[]>(
  route.query.factions
    ? (route.query.factions as string).split(',').filter(k => k)
    : []
)
const selectedUserIds = ref<number[]>(
  route.query.users
    ? (route.query.users as string).split(',').map(Number).filter(n => !isNaN(n))
    : []
)
const selectedCampaignIds = ref<number[]>(
  route.query.campaigns
    ? (route.query.campaigns as string).split(',').map(Number).filter(n => !isNaN(n))
    : []
)
const emblemCompletionFilter = ref<'all' | 'incomplete' | 'complete'>(
  (['all', 'incomplete', 'complete'].includes(route.query.completion as string)
    ? route.query.completion as 'all' | 'incomplete' | 'complete'
    : 'all')
)
const ignoreUsersWithoutData = ref(route.query.ignoreEmpty === '1')
const onlyNotCompletedByAnyone = ref(route.query.noOneCompleted === '1')
const searchQuery = ref((route.query.search as string) || '')

// Flag pour savoir si les users ont été initialisés depuis l'URL
const usersInitializedFromUrl = route.query.users !== undefined

// Campagnes repliées
const collapsedCampaigns = ref<Set<number>>(new Set())

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
const allFactionsSelected = computed(() => selectedFactionKeys.value.length === 0)

const users = computed(() => groupData.value?.reputationData.users || [])
const factions = computed(() => groupData.value?.reputationData.factions || [])
const members = computed(() => groupData.value?.members || [])
const userRole = computed(() => groupData.value?.userRole || 'member')
const isChef = computed(() => userRole.value === 'chef')
const isModerator = computed(() => userRole.value === 'chef' || userRole.value === 'moderator')
const canManageMembers = computed(() => isModerator.value)

// Initialiser les utilisateurs sélectionnés (si pas déjà initialisé depuis l'URL)
watch(users, (newUsers) => {
  if (newUsers.length > 0 && selectedUserIds.value.length === 0 && !usersInitializedFromUrl) {
    selectedUserIds.value = newUsers.map(u => u.id)
  }
}, { immediate: true })

// Synchroniser les filtres avec l'URL (mise à jour légère sans Vue Router)
let urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null

function updateUrlWithFilters() {
  if (!import.meta.client) return

  const params = new URLSearchParams()

  if (searchQuery.value.trim()) {
    params.set('search', searchQuery.value.trim())
  }
  if (selectedFactionKeys.value.length > 0) {
    params.set('factions', selectedFactionKeys.value.join(','))
  }
  if (selectedCampaignIds.value.length > 0) {
    params.set('campaigns', selectedCampaignIds.value.join(','))
  }
  if (emblemCompletionFilter.value !== 'all') {
    params.set('completion', emblemCompletionFilter.value)
  }
  if (ignoreUsersWithoutData.value) {
    params.set('ignoreEmpty', '1')
  }
  if (onlyNotCompletedByAnyone.value) {
    params.set('noOneCompleted', '1')
  }
  // Ne sauvegarder les users que s'ils ne sont pas tous sélectionnés
  const allUserIds = users.value.map(u => u.id)
  const allUsersSelected = allUserIds.length > 0 &&
    selectedUserIds.value.length === allUserIds.length &&
    allUserIds.every(id => selectedUserIds.value.includes(id))
  if (!allUsersSelected && selectedUserIds.value.length > 0) {
    params.set('users', selectedUserIds.value.join(','))
  }

  const queryString = params.toString()
  const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname
  window.history.replaceState({}, '', newUrl)
}

watch(
  [searchQuery, selectedFactionKeys, selectedCampaignIds, emblemCompletionFilter, ignoreUsersWithoutData, onlyNotCompletedByAnyone, selectedUserIds],
  () => {
    if (urlUpdateTimeout) {
      clearTimeout(urlUpdateTimeout)
    }
    urlUpdateTimeout = setTimeout(updateUrlWithFilters, 300)
  },
  { deep: true }
)

// Factions sélectionnées (filtrées par selectedFactionKeys si défini)
const selectedFactions = computed(() => {
  if (allFactionsSelected.value) return factions.value
  return factions.value.filter(f => selectedFactionKeys.value.includes(f.key))
})

// Factions avec leurs campagnes filtrées
const filteredFactionsCampaigns = computed(() => {
  return selectedFactions.value.map(faction => ({
    faction,
    campaigns: faction.campaigns.filter(c =>
      selectedCampaignIds.value.includes(c.id) &&
      (c.key !== 'default' || faction.campaigns.length === 1)
    )
  }))
})

const searchResults = computed(() => {
  if (!isSearchActive.value) return []

  const query = searchQuery.value.toLowerCase().trim()
  const results: Array<{
    factionName: string
    campaignName: string
    campaignKey: string
    emblems: Array<EmblemInfo & { userProgress: Record<number, UserEmblemProgress> }>
  }> = []

  for (const faction of factions.value) {
    for (const campaign of faction.campaigns) {
      const matchingEmblems = campaign.emblems.filter(e =>
        e.name.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query)
      )

      if (matchingEmblems.length > 0) {
        results.push({
          factionName: faction.name,
          campaignName: campaign.name,
          campaignKey: campaign.key,
          emblems: matchingEmblems
        })
      }
    }
  }

  return results
})

const selectedUsers = computed(() => {
  return users.value.filter(u => selectedUserIds.value.includes(u.id))
})

// Fonctions pour sélectionner tous/aucun utilisateur
function selectAllUsers() {
  selectedUserIds.value = users.value.map(u => u.id)
}

function selectNoUsers() {
  // Garder au moins un utilisateur sélectionné
  if (users.value.length > 0) {
    selectedUserIds.value = [users.value[0].id]
  }
}

const allUsersSelected = computed(() => {
  return users.value.length > 0 && selectedUserIds.value.length === users.value.length
})

// Calculer le nombre total d'emblèmes (basé sur les filtres faction/campagne)
const totalEmblems = computed(() => {
  let count = 0

  for (const faction of selectedFactions.value) {
    // Déterminer les campagnes à considérer
    const campaignsToCount = selectedCampaignIds.value.length > 0
      ? faction.campaigns.filter(c => selectedCampaignIds.value.includes(c.id))
      : faction.campaigns

    for (const campaign of campaignsToCount) {
      count += campaign.emblems.length
    }
  }
  return count
})

// Statistiques de complétion par utilisateur (basé sur les filtres faction/campagne)
const userCompletionStats = computed(() => {
  const stats: Record<number, { completed: number; total: number; percentage: number }> = {}

  for (const user of users.value) {
    let completed = 0
    let total = 0

    for (const faction of selectedFactions.value) {
      // Déterminer les campagnes à considérer
      const campaignsToCount = selectedCampaignIds.value.length > 0
        ? faction.campaigns.filter(c => selectedCampaignIds.value.includes(c.id))
        : faction.campaigns

      for (const campaign of campaignsToCount) {
        for (const emblem of campaign.emblems) {
          const progress = emblem.userProgress[user.id]
          // Ne compter que les emblèmes avec des données de progression (exclure null/undefined)
          if (progress !== null && progress !== undefined) {
            total++
            if (progress.completed) {
              completed++
            }
          }
        }
      }
    }

    stats[user.id] = {
      completed,
      total,
      percentage: total > 0 ? (completed === total ? 100 : Math.floor((completed / total) * 100)) : 0
    }
  }

  return stats
})

// Statistiques du groupe (basé sur les filtres faction/campagne)
const groupStats = computed(() => {
  const selectedUserList = selectedUsers.value
  if (selectedUserList.length === 0 || totalEmblems.value === 0) {
    return { completedByAll: 0, averageCompletion: 0, totalEmblems: 0 }
  }

  let completedByAll = 0
  let totalCompletions = 0

  for (const faction of selectedFactions.value) {
    // Déterminer les campagnes à considérer
    const campaignsToCount = selectedCampaignIds.value.length > 0
      ? faction.campaigns.filter(c => selectedCampaignIds.value.includes(c.id))
      : faction.campaigns

    for (const campaign of campaignsToCount) {
      for (const emblem of campaign.emblems) {
        let allCompleted = true
        let completionCount = 0

        for (const user of selectedUserList) {
          const progress = emblem.userProgress[user.id]
          if (progress?.completed) {
            completionCount++
          } else {
            allCompleted = false
          }
        }

        if (allCompleted) {
          completedByAll++
        }
        totalCompletions += completionCount
      }
    }
  }

  const totalPossible = totalEmblems.value * selectedUserList.length
  const averageCompletion = totalCompletions === totalPossible
    ? 100
    : Math.floor((totalCompletions / totalPossible) * 100)

  return {
    completedByAll,
    averageCompletion,
    totalEmblems: totalEmblems.value
  }
})

// Fonction pour replier/déplier une campagne
function toggleCampaignCollapse(campaignId: number) {
  if (collapsedCampaigns.value.has(campaignId)) {
    collapsedCampaigns.value.delete(campaignId)
  } else {
    collapsedCampaigns.value.add(campaignId)
  }
}

function isCampaignCollapsed(campaignId: number): boolean {
  return collapsedCampaigns.value.has(campaignId)
}

function formatLastImport(dateStr: string | null): string {
  if (!dateStr) return 'Jamais importe'
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isEmblemCompletedByAll(emblem: { userProgress: Record<number, UserEmblemProgress> }): boolean {
  let usersWithData = 0
  for (const user of selectedUsers.value) {
    const progress = emblem.userProgress[user.id]
    // Si on ignore les utilisateurs sans données et qu'il n'y a pas de progression, on passe
    if (ignoreUsersWithoutData.value && !progress) {
      continue
    }
    usersWithData++
    if (!progress?.completed) {
      return false
    }
  }
  // Si aucun utilisateur avec données, considérer comme non complété
  return usersWithData > 0
}

function isEmblemCompletedByNone(emblem: { userProgress: Record<number, UserEmblemProgress> }): boolean {
  for (const user of selectedUsers.value) {
    const progress = emblem.userProgress[user.id]
    if (progress?.completed) {
      return false
    }
  }
  return true
}

// Vérifie si au moins un utilisateur sélectionné a des données pour cet emblème
function hasAnyUserData(emblem: { userProgress: Record<number, UserEmblemProgress> }): boolean {
  for (const user of selectedUsers.value) {
    const progress = emblem.userProgress[user.id]
    if (progress !== null && progress !== undefined) {
      return true
    }
  }
  return false
}

function filterEmblemsArray<T extends { userProgress: Record<number, UserEmblemProgress> }>(emblems: T[]): T[] {
  return filterEmblems(
    emblems,
    {
      completionFilter: emblemCompletionFilter.value,
      ignoreWithoutData: ignoreUsersWithoutData.value,
      onlyNotCompletedByAnyone: onlyNotCompletedByAnyone.value
    },
    {
      isCompleted: isEmblemCompletedByAll,
      hasData: hasAnyUserData,
      isCompletedByNone: isEmblemCompletedByNone
    }
  )
}

// Mémoiser les emblèmes filtrés par campagne
// Note: On accède explicitement aux refs de filtre pour que Vue les détecte comme dépendances
const filteredEmblemsByCampaign = computed(() => {
  // Dépendances explicites pour la réactivité
  const _ = [
    emblemCompletionFilter.value,
    ignoreUsersWithoutData.value,
    onlyNotCompletedByAnyone.value,
    selectedUserIds.value
  ]

  const result: Record<number, Array<EmblemInfo & { userProgress: Record<number, UserEmblemProgress> }>> = {}

  for (const faction of factions.value) {
    for (const campaign of faction.campaigns) {
      result[campaign.id] = filterEmblemsArray(campaign.emblems)
    }
  }

  return result
})

function getFilteredEmblems(campaignId: number) {
  return filteredEmblemsByCampaign.value[campaignId] || []
}

const columns = computed<TableColumn<TableRow>[]>(() => {
  const cols: TableColumn<TableRow>[] = [
    {
      accessorKey: 'name',
      header: 'Succes',
      cell: ({ row }) => {
        const children = []

        if (row.original.image) {
          children.push(h('img', {
            src: row.original.image,
            alt: row.original.name,
            class: 'w-10 h-10 object-contain shrink-0'
          }))
        }

        children.push(h('div', {}, [
          h('div', { class: 'font-medium' }, row.original.name),
          h('div', { class: 'text-xs text-muted' }, row.original.description)
        ]))

        return h('div', { class: 'flex items-center gap-3' }, children)
      }
    },
    {
      accessorKey: 'maxThreshold',
      header: 'Max',
      cell: ({ row }) => {
        const maxThreshold = row.original.maxThreshold as number | null
        const gradeThresholds = row.original.gradeThresholds as GradeThreshold[]

        const displayValue = maxThreshold === null ? '?' : maxThreshold.toString()
        const hasThresholds = gradeThresholds && gradeThresholds.length > 0

        if (!hasThresholds) {
          return h('span', { class: maxThreshold === null ? 'text-muted' : '' }, displayValue)
        }

        // Créer le contenu du popover
        const popoverContent = gradeThresholds.map(gt =>
          h('div', { class: 'flex justify-between gap-4 text-sm' }, [
            h('span', { class: 'text-muted' }, `Grade ${gt.grade}`),
            h('span', { class: 'font-medium' }, gt.threshold.toString())
          ])
        )

        return h(
          resolveComponent('UPopover'),
          { mode: 'hover' },
          {
            default: () => h('span', { class: 'cursor-help underline decoration-dotted' }, displayValue),
            content: () => h('div', { class: 'p-2 space-y-1' }, popoverContent)
          }
        )
      }
    }
  ]

  for (const user of selectedUsers.value) {
    cols.push({
      accessorKey: `user_${user.id}`,
      header: () => h('div', {}, [
        h('div', { class: 'font-medium' }, user.username),
        h('div', { class: 'text-xs text-muted font-normal' }, formatLastImport(user.lastImportAt))
      ]),
      cell: ({ row }) => {
        const value = row.original[`user_${user.id}_display`] as string
        const completed = row.original[`user_${user.id}_completed`] as boolean
        const hasProgress = row.original[`user_${user.id}_hasProgress`] as boolean

        let colorClass = 'text-muted'
        if (completed) {
          colorClass = 'text-success font-medium'
        } else if (hasProgress) {
          colorClass = 'text-warning'
        }

        return h('span', { class: colorClass }, value)
      }
    })
  }

  return cols
})

function getTableData(emblems: Array<EmblemInfo & { userProgress: Record<number, UserEmblemProgress> }>): TableRow[] {
  return emblems.map((emblem) => {
    const row: TableRow = {
      id: emblem.id,
      name: emblem.name,
      description: emblem.description,
      image: emblem.image || '',
      maxThreshold: emblem.maxThreshold,
      gradeThresholds: emblem.gradeThresholds || []
    }

    for (const user of selectedUsers.value) {
      const progress = emblem.userProgress[user.id]
      if (progress) {
        row[`user_${user.id}_display`] = progress.threshold > 0
          ? `${progress.value}/${progress.threshold}`
          : (progress.completed ? 'Oui' : 'Non')
        row[`user_${user.id}_completed`] = progress.completed
        row[`user_${user.id}_hasProgress`] = progress.value > 0
      } else {
        row[`user_${user.id}_display`] = '-'
        row[`user_${user.id}_completed`] = false
        row[`user_${user.id}_hasProgress`] = false
      }
    }

    return row
  })
}

function toggleUser(userId: number) {
  const index = selectedUserIds.value.indexOf(userId)
  if (index === -1) {
    selectedUserIds.value.push(userId)
  } else if (selectedUserIds.value.length > 1) {
    selectedUserIds.value.splice(index, 1)
  }
}

async function handleInvite() {
  if (!inviteUsername.value.trim()) {
    toast.add({ title: 'Erreur', description: 'Pseudo requis', color: 'error' })
    return
  }

  isInviting.value = true
  try {
    const result = await $fetch<{ success: boolean, message: string }>(`/api/groups/${groupUid}/invite`, {
      method: 'POST',
      body: { username: inviteUsername.value.trim() }
    })
    toast.add({ title: 'Succes', description: result.message, color: 'success' })
    inviteUsername.value = ''
    await fetchGroupPendingInvites()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isInviting.value = false
  }
}

async function handleChangeRole() {
  if (!memberToChangeRole.value) return

  isChangingRole.value = true
  try {
    const result = await $fetch<{ success: boolean, message: string }>(`/api/groups/${groupUid}/promote`, {
      method: 'POST',
      body: { userId: memberToChangeRole.value.userId, newRole: newRoleSelected.value }
    })
    toast.add({ title: 'Succes', description: result.message, color: 'success' })
    isRoleModalOpen.value = false
    memberToChangeRole.value = null
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isChangingRole.value = false
  }
}

async function handleKick() {
  if (!memberToKick.value) return

  isKicking.value = true
  try {
    const result = await $fetch<{ success: boolean, message: string }>(`/api/groups/${groupUid}/kick`, {
      method: 'POST',
      body: { userId: memberToKick.value.userId }
    })
    toast.add({ title: 'Succes', description: result.message, color: 'success' })
    isKickModalOpen.value = false
    memberToKick.value = null
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isKicking.value = false
  }
}

async function handleLeave() {
  isLeaving.value = true
  try {
    await leaveGroup(groupUid)
    toast.add({ title: 'Succes', description: 'Vous avez quitte le groupe', color: 'success' })
    navigateTo('/')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isLeaving.value = false
  }
}

async function handleDelete() {
  isDeleting.value = true
  try {
    await $fetch(`/api/groups/${groupUid}`, { method: 'DELETE' })
    toast.add({ title: 'Succes', description: 'Groupe supprime', color: 'success' })
    navigateTo('/')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

async function handleImport() {
  if (!importJsonText.value.trim()) {
    toast.add({ title: 'Erreur', description: 'JSON requis', color: 'error' })
    return
  }

  let jsonData: unknown
  try {
    jsonData = JSON.parse(importJsonText.value)
  } catch {
    toast.add({ title: 'Erreur', description: 'JSON invalide', color: 'error' })
    return
  }

  isImporting.value = true
  try {
    await $fetch('/api/import', {
      method: 'POST',
      body: {
        username: user.value?.username,
        password: '', // Le mot de passe n'est plus nécessaire si on est connecté
        jsonData
      }
    })
    toast.add({ title: 'Succes', description: 'Donnees importees', color: 'success' })
    isImportModalOpen.value = false
    importJsonText.value = ''
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isImporting.value = false
  }
}

// Fonctions pour le lien d'invitation
async function fetchInviteLink() {
  isLoadingInviteLink.value = true
  try {
    const result = await $fetch<{ invite: { code: string } | null }>(`/api/groups/${groupUid}/invite-link`)
    inviteLink.value = result.invite
  } catch {
    // Pas de lien existant
    inviteLink.value = null
  } finally {
    isLoadingInviteLink.value = false
  }
}

async function generateInviteLink() {
  isGeneratingInviteLink.value = true
  try {
    const result = await $fetch<{ invite: { code: string } }>(`/api/groups/${groupUid}/invite-link`, {
      method: 'POST'
    })
    inviteLink.value = result.invite
    toast.add({ title: 'Succes', description: 'Lien d\'invitation genere', color: 'success' })
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isGeneratingInviteLink.value = false
  }
}

async function copyInviteLink() {
  if (!fullInviteLink.value) return
  try {
    await navigator.clipboard.writeText(fullInviteLink.value)
    toast.add({ title: 'Copie !', description: 'Lien copie dans le presse-papier', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur', description: 'Impossible de copier le lien', color: 'error' })
  }
}

async function fetchGroupPendingInvites() {
  isLoadingGroupPendingInvites.value = true
  try {
    const result = await $fetch<{ invites: GroupPendingInvite[] }>(`/api/groups/${groupUid}/pending-invites`)
    groupPendingInvites.value = result.invites
  } catch {
    groupPendingInvites.value = []
  } finally {
    isLoadingGroupPendingInvites.value = false
  }
}

async function cancelPendingInvite(inviteId: number) {
  cancellingInviteIds.value.push(inviteId)
  try {
    await $fetch(`/api/groups/${groupUid}/pending-invites/${inviteId}`, { method: 'DELETE' })
    groupPendingInvites.value = groupPendingInvites.value.filter(i => i.id !== inviteId)
    toast.add({ title: 'Invitation annulee', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur', description: 'Impossible d\'annuler l\'invitation', color: 'error' })
  } finally {
    cancellingInviteIds.value = cancellingInviteIds.value.filter(id => id !== inviteId)
  }
}

// Charger le lien d'invitation et les invitations en attente quand la modal s'ouvre
watch(isInviteModalOpen, async (isOpen) => {
  if (isOpen) {
    if (!inviteLink.value) {
      await fetchInviteLink()
    }
    await fetchGroupPendingInvites()
  }
})

function openRoleModal(member: GroupMember) {
  memberToChangeRole.value = member
  newRoleSelected.value = member.role
  isRoleModalOpen.value = true
}

function openKickModal(member: GroupMember) {
  memberToKick.value = member
  isKickModalOpen.value = true
}

// Vérifie si l'utilisateur courant peut modifier le rôle du membre
function canChangeRole(member: GroupMember): boolean {
  // Seul le chef peut modifier les rôles
  if (!isChef.value) return false
  // Ne peut pas modifier son propre rôle depuis la liste (sauf transfert)
  if (member.userId === user.value?.id) return false
  return true
}

// Vérifie si l'utilisateur courant peut retirer le membre
function canKickMember(member: GroupMember): boolean {
  // Doit être chef ou modérateur
  if (!canManageMembers.value) return false
  // Ne peut pas se retirer soi-même
  if (member.userId === user.value?.id) return false
  // Le chef ne peut pas être retiré
  if (member.role === 'chef') return false
  // Un modérateur ne peut pas retirer un autre modérateur
  if (userRole.value === 'moderator' && member.role === 'moderator') return false
  return true
}

// Connexion SSE pour les mises à jour en temps réel
const eventSource = ref<EventSource | null>(null)

function connectSSE() {
  if (!import.meta.client) return

  eventSource.value = new EventSource(`/api/sse/groups/${groupUid}`)

  eventSource.value.addEventListener('member-updated', async (event) => {
    const data = JSON.parse(event.data)
    // Ne pas rafraîchir si c'est nous qui avons importé
    if (data.userId !== user.value?.id) {
      toast.add({
        title: 'Donnees mises a jour',
        description: `${data.username} a importe ses donnees`,
        color: 'info'
      })
      await refresh()
    }
  })

  eventSource.value.addEventListener('error', () => {
    // Reconnexion automatique après 5 secondes en cas d'erreur
    eventSource.value?.close()
    setTimeout(() => {
      connectSSE()
    }, 5000)
  })
}

onMounted(() => {
  connectSSE()
})

onUnmounted(() => {
  eventSource.value?.close()
})
</script>

<template>
  <UContainer class="py-8">
    <!-- Header du groupe -->
    <div class="flex justify-between items-start mb-8">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <NuxtLink to="/" class="text-muted hover:text-foreground">
            <UIcon name="i-lucide-arrow-left" class="w-5 h-5" />
          </NuxtLink>
          <h1 class="text-3xl font-pirate">
            {{ groupData?.group.name }}
          </h1>
        </div>
        <div class="flex items-center gap-4">
          <UBadge :color="roleBadgeColors[userRole]" :label="roleLabels[userRole]" />
          <span class="text-sm text-muted">{{ members.length }} membre(s)</span>
        </div>
      </div>

      <div class="flex gap-2">
        <UButton
          icon="i-lucide-upload"
          label="Importer"
          variant="outline"
          @click="isImportModalOpen = true"
        />
        <UButton
          icon="i-lucide-users"
          label="Membres"
          variant="outline"
          @click="isMembersModalOpen = true"
        />
        <UDropdownMenu :items="dropdownItems">
          <UButton icon="i-lucide-more-vertical" variant="ghost" />
        </UDropdownMenu>
      </div>
    </div>

    <!-- Message si pas de données -->
    <div
      v-if="users.length === 0"
      class="text-center py-16"
    >
      <UIcon
        name="i-lucide-anchor"
        class="w-16 h-16 text-muted mx-auto mb-4"
      />
      <h2 class="text-xl font-semibold mb-2">
        Aucune donnee de reputation
      </h2>
      <p class="text-muted mb-4">
        Les membres du groupe doivent importer leurs donnees de reputation.
      </p>
      <UButton
        icon="i-lucide-upload"
        label="Importer mes donnees"
        @click="isImportModalOpen = true"
      />
    </div>

    <template v-else>
      <!-- Statistiques du groupe -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-muted/30 rounded-lg p-4">
          <div class="text-2xl font-bold text-success">{{ groupStats.completedByAll }}</div>
          <div class="text-sm text-muted">Completes par tous</div>
        </div>
        <div class="bg-muted/30 rounded-lg p-4">
          <div class="text-2xl font-bold text-primary">{{ groupStats.averageCompletion }}%</div>
          <div class="text-sm text-muted">Completion moyenne</div>
        </div>
        <div class="bg-muted/30 rounded-lg p-4">
          <div class="text-2xl font-bold">{{ groupStats.totalEmblems }}</div>
          <div class="text-sm text-muted">Emblemes au total</div>
        </div>
      </div>

      <!-- Filtres -->
      <ReputationFilters
        v-model:search-query="searchQuery"
        v-model:selected-faction-keys="selectedFactionKeys"
        v-model:selected-campaign-ids="selectedCampaignIds"
        v-model:emblem-completion-filter="emblemCompletionFilter"
        :factions="factions"
        :show-completion-filter="true"
      >
        <template #extra-filters="{ isSearchActive: searchActive }">
          <div v-if="!searchActive" class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-medium text-muted">Utilisateurs :</span>
            <UButton
              size="xs"
              variant="ghost"
              :disabled="allUsersSelected"
              @click="selectAllUsers"
            >
              Tous
            </UButton>
            <UTooltip
              v-for="u in users"
              :key="u.id"
              :text="`${userCompletionStats[u.id]?.completed || 0}/${userCompletionStats[u.id]?.total || 0} - Dernier import : ${formatLastImport(u.lastImportAt)}`"
            >
              <UButton
                :color="selectedUserIds.includes(u.id) ? 'primary' : 'neutral'"
                :variant="selectedUserIds.includes(u.id) ? 'solid' : 'outline'"
                size="sm"
                @click="toggleUser(u.id)"
              >
                {{ u.username }} - {{ userCompletionStats[u.id]?.percentage || 0 }}%
              </UButton>
            </UTooltip>
          </div>
        </template>

        <template #completion-extra>
          <div v-if="emblemCompletionFilter === 'incomplete'" class="flex items-center gap-2 ml-4 pl-4 border-l border-muted">
            <USwitch v-model="ignoreUsersWithoutData" size="sm" />
            <span class="text-sm text-muted">Ignorer sans donnees</span>
          </div>
          <div v-if="emblemCompletionFilter === 'incomplete'" class="flex items-center gap-2 ml-4 pl-4 border-l border-muted">
            <USwitch v-model="onlyNotCompletedByAnyone" size="sm" color="warning" />
            <span class="text-sm text-muted">Non completes par personne</span>
          </div>
        </template>
      </ReputationFilters>

      <!-- Résultats de recherche -->
      <template v-if="isSearchActive">
        <div v-if="searchResults.length === 0" class="text-center py-8 text-muted">
          Aucun succes trouve pour "{{ searchQuery }}"
        </div>
        <div
          v-for="(result, index) in searchResults"
          :key="`${result.factionName}-${result.campaignKey}-${index}`"
          class="mb-8"
        >
          <h3 class="text-lg font-semibold mb-4">
            {{ result.factionName }}
            <span v-if="result.campaignKey !== 'default'" class="text-muted font-normal">
              / {{ result.campaignName }}
            </span>
          </h3>
          <TableLoader>
            <UTable :data="getTableData(filterEmblemsArray(result.emblems))" :columns="columns" />
          </TableLoader>
        </div>
      </template>

      <!-- Factions (toutes ou filtrées) -->
      <template v-else>
        <template v-for="{ faction, campaigns } in filteredFactionsCampaigns" :key="faction.key">
          <div v-if="campaigns.some(c => getFilteredEmblems(c.id).length > 0)" class="mb-8">
            <h2 class="text-2xl font-pirate">{{ faction.name }}</h2>
            <p v-if="faction.motto" class="text-muted italic mb-4">« {{ faction.motto }} »</p>

            <template v-for="campaign in campaigns" :key="campaign.id">
              <div v-if="getFilteredEmblems(campaign.id).length > 0" class="mb-6">
                <div
                  v-if="campaign.key !== 'default'"
                  class="mb-4 flex items-center gap-2 cursor-pointer select-none"
                  @click="toggleCampaignCollapse(campaign.id)"
                >
                  <UIcon
                    :name="isCampaignCollapsed(campaign.id) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                    class="w-5 h-5 text-muted"
                  />
                  <div>
                    <h3 class="text-lg font-semibold">
                      {{ campaign.name }}
                      <span class="text-sm font-normal text-muted">({{ getFilteredEmblems(campaign.id).length }})</span>
                    </h3>
                    <p v-if="campaign.description && !isCampaignCollapsed(campaign.id)" class="text-sm text-muted italic">{{ campaign.description }}</p>
                  </div>
                </div>
                <TableLoader v-if="!isCampaignCollapsed(campaign.id)">
                  <UTable :data="getTableData(getFilteredEmblems(campaign.id))" :columns="columns" />
                </TableLoader>
              </div>
            </template>
          </div>
        </template>
      </template>
    </template>

    <!-- Modal Membres -->
    <UModal v-model:open="isMembersModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">Membres du groupe</h2>
              <UBadge :label="`${members.length} membre(s)`" color="neutral" />
            </div>
          </template>

          <div class="space-y-4">
            <!-- Liste des membres -->
            <div class="space-y-2">
              <div
                v-for="member in members"
                :key="member.userId"
                class="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div class="flex items-center gap-3">
                  <UIcon name="i-lucide-user" class="w-5 h-5 text-muted" />
                  <span class="font-medium">{{ member.username }}</span>
                  <UBadge
                    :color="roleBadgeColors[member.role]"
                    :label="roleLabels[member.role]"
                    size="xs"
                  />
                </div>
                <div class="flex items-center gap-1">
                  <!-- Bouton modifier le rôle (chef uniquement) -->
                  <UButton
                    v-if="canChangeRole(member)"
                    icon="i-lucide-shield"
                    size="xs"
                    variant="ghost"
                    title="Modifier le role"
                    @click="openRoleModal(member)"
                  />
                  <!-- Bouton retirer du groupe (chef et moderateur) -->
                  <UButton
                    v-if="canKickMember(member)"
                    icon="i-lucide-user-minus"
                    size="xs"
                    variant="ghost"
                    color="error"
                    title="Retirer du groupe"
                    @click="openKickModal(member)"
                  />
                </div>
              </div>
            </div>

          </div>

          <template #footer>
            <div class="flex justify-between">
              <UButton
                v-if="canManageMembers"
                label="Inviter"
                icon="i-lucide-user-plus"
                variant="outline"
                @click="isInviteModalOpen = true"
              />
              <div v-else />
              <UButton label="Fermer" color="neutral" variant="outline" @click="isMembersModalOpen = false" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal Inviter -->
    <UModal v-model:open="isInviteModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Inviter des pirates</h2>
          </template>

          <div class="space-y-6">
            <!-- Lien d'invitation -->
            <div>
              <h3 class="text-sm font-medium mb-2">Lien d'invitation</h3>
              <div v-if="isLoadingInviteLink" class="flex items-center gap-2 text-muted">
                <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
                <span>Chargement...</span>
              </div>
              <div v-else-if="inviteLink" class="space-y-2">
                <div class="flex gap-2">
                  <UInput
                    :model-value="fullInviteLink"
                    readonly
                    icon="i-lucide-link"
                    class="flex-1"
                  />
                  <UButton
                    icon="i-lucide-copy"
                    variant="outline"
                    title="Copier le lien"
                    @click="copyInviteLink"
                  />
                  <UButton
                    icon="i-lucide-refresh-cw"
                    variant="outline"
                    color="warning"
                    title="Regenerer le lien"
                    :loading="isGeneratingInviteLink"
                    @click="generateInviteLink"
                  />
                </div>
                <p class="text-xs text-muted">
                  Partagez ce lien pour inviter des pirates a rejoindre le groupe.
                </p>
              </div>
              <div v-else>
                <UButton
                  label="Generer un lien d'invitation"
                  icon="i-lucide-link"
                  variant="outline"
                  :loading="isGeneratingInviteLink"
                  @click="generateInviteLink"
                />
              </div>
            </div>

            <!-- Invitation par pseudo -->
            <div>
              <h3 class="text-sm font-medium mb-2">Inviter par Gamertag</h3>
              <div class="flex gap-2">
                <UInput
                  v-model="inviteUsername"
                  placeholder="Gamertag Xbox"
                  icon="i-lucide-user-plus"
                  class="flex-1"
                />
                <UButton
                  label="Inviter"
                  icon="i-lucide-plus"
                  :loading="isInviting"
                  @click="handleInvite"
                />
              </div>
              <p class="text-xs text-muted mt-2">
                L'utilisateur devra accepter l'invitation pour rejoindre le groupe.
              </p>
            </div>

            <!-- Invitations en attente -->
            <div v-if="isLoadingGroupPendingInvites" class="flex items-center gap-2 text-muted">
              <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
              <span>Chargement des invitations...</span>
            </div>
            <div v-else-if="groupPendingInvites.length > 0">
              <h3 class="text-sm font-medium mb-2">Invitations en attente ({{ groupPendingInvites.length }})</h3>
              <div class="space-y-2">
                <div
                  v-for="invite in groupPendingInvites"
                  :key="invite.id"
                  class="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div>
                    <span class="font-medium">{{ invite.username }}</span>
                    <span class="text-xs text-muted ml-2">invite par {{ invite.invitedByUsername }}</span>
                  </div>
                  <UButton
                    icon="i-lucide-x"
                    size="xs"
                    variant="ghost"
                    color="error"
                    title="Annuler l'invitation"
                    :loading="cancellingInviteIds.includes(invite.id)"
                    @click="cancelPendingInvite(invite.id)"
                  />
                </div>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end">
              <UButton label="Fermer" color="neutral" variant="outline" @click="isInviteModalOpen = false" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal Modifier le rôle -->
    <UModal v-model:open="isRoleModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Modifier le role</h2>
          </template>
          <div class="space-y-4">
            <p>Choisir le nouveau role pour <strong>{{ memberToChangeRole?.username }}</strong> :</p>

            <div class="space-y-2">
              <label
                v-for="role in (['chef', 'moderator', 'member'] as const)"
                :key="role"
                class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                :class="newRoleSelected === role ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted/50 hover:bg-muted'"
              >
                <input
                  v-model="newRoleSelected"
                  type="radio"
                  name="role"
                  :value="role"
                  class="sr-only"
                />
                <UBadge :color="roleBadgeColors[role]" :label="roleLabels[role]" />
                <span class="text-sm text-muted">
                  <template v-if="role === 'chef'">Tous les droits. Un seul chef par groupe.</template>
                  <template v-else-if="role === 'moderator'">Peut inviter et retirer des membres.</template>
                  <template v-else>Acces en lecture seule.</template>
                </span>
              </label>
            </div>

            <UAlert v-if="newRoleSelected === 'chef'" icon="i-lucide-alert-triangle" color="warning" title="Attention">
              <template #description>
                En transferant le role de Chef, vous deviendrez Moderateur.
              </template>
            </UAlert>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Annuler" color="neutral" variant="outline" @click="isRoleModalOpen = false" />
              <UButton
                label="Valider"
                icon="i-lucide-check"
                :loading="isChangingRole"
                :disabled="newRoleSelected === memberToChangeRole?.role"
                @click="handleChangeRole"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal Retirer un membre -->
    <UModal v-model:open="isKickModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold text-error">Retirer du groupe</h2>
          </template>
          <p>Voulez-vous vraiment retirer <strong>{{ memberToKick?.username }}</strong> du groupe ?</p>
          <p class="text-sm text-muted mt-2">Cette personne devra etre invitee a nouveau pour rejoindre le groupe.</p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Annuler" color="neutral" variant="outline" @click="isKickModalOpen = false" />
              <UButton label="Retirer" color="error" icon="i-lucide-user-minus" :loading="isKicking" @click="handleKick" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal Quitter -->
    <UModal v-model:open="isLeaveModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Quitter le groupe</h2>
          </template>
          <p>Voulez-vous vraiment quitter le groupe <strong>{{ groupData?.group.name }}</strong> ?</p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Annuler" color="neutral" variant="outline" @click="isLeaveModalOpen = false" />
              <UButton label="Quitter" color="warning" icon="i-lucide-log-out" :loading="isLeaving" @click="handleLeave" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal Supprimer -->
    <UModal v-model:open="isDeleteModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold text-error">Supprimer le groupe</h2>
          </template>
          <UAlert icon="i-lucide-alert-triangle" color="error" title="Attention">
            <template #description>
              Cette action est irreversible. Tous les membres seront retires du groupe.
            </template>
          </UAlert>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Annuler" color="neutral" variant="outline" @click="isDeleteModalOpen = false" />
              <UButton label="Supprimer" color="error" icon="i-lucide-trash-2" :loading="isDeleting" @click="handleDelete" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal Import -->
    <UModal v-model:open="isImportModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Importer mes donnees</h2>
          </template>
          <div class="space-y-4">
            <UAlert icon="i-lucide-info" color="info" title="Astuce">
              <template #description>
                <NuxtLink to="/tutoriel" class="underline" target="_blank">Voir le tutoriel</NuxtLink>
                pour savoir comment recuperer vos donnees.
              </template>
            </UAlert>
            <UFormField label="Donnees JSON">
              <UTextarea
                v-model="importJsonText"
                placeholder="Collez ici le JSON..."
                :rows="10"
                class="w-full"
              />
            </UFormField>
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Annuler" color="neutral" variant="outline" @click="isImportModalOpen = false" />
              <UButton label="Importer" icon="i-lucide-upload" :loading="isImporting" @click="handleImport" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
