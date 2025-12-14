<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface UserInfo {
  id: number
  username: string
  lastImportAt: string | null
}

interface GroupMember {
  id: number
  groupId: number
  userId: number
  username: string
  role: 'admin' | 'member'
  joinedAt: string
  lastImportAt: string | null
}

interface FactionInfo {
  id: number
  key: string
  name: string
  motto: string
}

interface EmblemInfo {
  id: number
  key: string
  name: string
  description: string
  image: string
  maxGrade: number
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
  isAdmin: boolean
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
  [key: string]: string | number | boolean | undefined
}

const route = useRoute()
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
const isInviteModalOpen = ref(false)
const inviteUsername = ref('')
const isInviting = ref(false)

const isPromoteModalOpen = ref(false)
const memberToPromote = ref<GroupMember | null>(null)
const isPromoting = ref(false)

const isLeaveModalOpen = ref(false)
const isLeaving = ref(false)

const isDeleteModalOpen = ref(false)
const isDeleting = ref(false)

const isImportModalOpen = ref(false)
const importJsonText = ref('')
const isImporting = ref(false)

// Filtres
const selectedFactionKey = ref<string>('')
const selectedUserIds = ref<number[]>([])
const selectedCampaignIds = ref<number[]>([])
const emblemCompletionFilter = ref<'all' | 'incomplete' | 'complete'>('all')
const searchQuery = ref('')

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
const allFactionsSelected = computed(() => selectedFactionKey.value === '')

const users = computed(() => groupData.value?.reputationData.users || [])
const factions = computed(() => groupData.value?.reputationData.factions || [])
const members = computed(() => groupData.value?.members || [])
const isAdmin = computed(() => groupData.value?.isAdmin || false)

// Initialiser les utilisateurs sélectionnés
watch(users, (newUsers) => {
  if (newUsers.length > 0 && selectedUserIds.value.length === 0) {
    selectedUserIds.value = newUsers.map(u => u.id)
  }
}, { immediate: true })

const selectedFaction = computed(() => {
  return factions.value.find(f => f.key === selectedFactionKey.value)
})

watch(selectedFaction, (faction) => {
  if (faction?.campaigns) {
    selectedCampaignIds.value = faction.campaigns.map(c => c.id)
  }
}, { immediate: true })

const hasMultipleCampaigns = computed(() => {
  if (!selectedFaction.value?.campaigns) return false
  return selectedFaction.value.campaigns.length > 1 ||
    (selectedFaction.value.campaigns.length === 1 && selectedFaction.value.campaigns[0].key !== 'default')
})

const filteredCampaigns = computed(() => {
  if (!selectedFaction.value?.campaigns) return []
  return selectedFaction.value.campaigns.filter(c => selectedCampaignIds.value.includes(c.id))
})

const allFactionsCampaigns = computed(() => {
  return factions.value.map(faction => ({
    faction,
    campaigns: faction.campaigns.filter(c => c.key !== 'default' || faction.campaigns.length === 1)
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
  for (const user of selectedUsers.value) {
    const progress = emblem.userProgress[user.id]
    if (!progress?.completed) {
      return false
    }
  }
  return true
}

function filterEmblems<T extends { userProgress: Record<number, UserEmblemProgress> }>(emblems: T[]): T[] {
  if (emblemCompletionFilter.value === 'all') {
    return emblems
  }

  return emblems.filter(emblem => {
    const completedByAll = isEmblemCompletedByAll(emblem)
    if (emblemCompletionFilter.value === 'complete') {
      return completedByAll
    } else {
      return !completedByAll
    }
  })
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
  const filteredEmblems = filterEmblems(emblems)

  return filteredEmblems.map(emblem => {
    const row: TableRow = {
      id: emblem.id,
      name: emblem.name,
      description: emblem.description,
      image: emblem.image || ''
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

function toggleCampaign(campaignId: number) {
  const allCampaignIds = selectedFaction.value?.campaigns.map(c => c.id) || []
  const allSelected = selectedCampaignIds.value.length === allCampaignIds.length

  if (allSelected) {
    selectedCampaignIds.value = [campaignId]
  } else {
    const index = selectedCampaignIds.value.indexOf(campaignId)
    if (index === -1) {
      selectedCampaignIds.value.push(campaignId)
    } else if (selectedCampaignIds.value.length > 1) {
      selectedCampaignIds.value.splice(index, 1)
    }
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
    isInviteModalOpen.value = false
    inviteUsername.value = ''
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isInviting.value = false
  }
}

async function handlePromote() {
  if (!memberToPromote.value) return

  isPromoting.value = true
  try {
    const result = await $fetch<{ success: boolean, message: string }>(`/api/groups/${groupUid}/promote`, {
      method: 'POST',
      body: { userId: memberToPromote.value.userId }
    })
    toast.add({ title: 'Succes', description: result.message, color: 'success' })
    isPromoteModalOpen.value = false
    memberToPromote.value = null
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
  } finally {
    isPromoting.value = false
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

function openPromoteModal(member: GroupMember) {
  memberToPromote.value = member
  isPromoteModalOpen.value = true
}
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
          <UBadge :color="isAdmin ? 'primary' : 'neutral'" :label="isAdmin ? 'Admin' : 'Membre'" />
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
          v-if="isAdmin"
          icon="i-lucide-user-plus"
          label="Inviter"
          @click="isInviteModalOpen = true"
        />
        <UDropdownMenu>
          <UButton icon="i-lucide-more-vertical" variant="ghost" />
          <template #content>
            <UDropdownMenuItem
              icon="i-lucide-log-out"
              label="Quitter le groupe"
              @click="isLeaveModalOpen = true"
            />
            <UDropdownMenuItem
              v-if="isAdmin"
              icon="i-lucide-trash-2"
              label="Supprimer le groupe"
              class="text-error"
              @click="isDeleteModalOpen = true"
            />
          </template>
        </UDropdownMenu>
      </div>
    </div>

    <!-- Liste des membres -->
    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">Membres du groupe</h2>
      </template>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="member in members"
          :key="member.userId"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50"
        >
          <span class="font-medium">{{ member.username }}</span>
          <UBadge
            :color="member.role === 'admin' ? 'primary' : 'neutral'"
            :label="member.role === 'admin' ? 'Admin' : 'Membre'"
            size="xs"
          />
          <UButton
            v-if="isAdmin && member.role !== 'admin' && member.userId !== user?.id"
            icon="i-lucide-shield"
            size="xs"
            variant="ghost"
            title="Promouvoir admin"
            @click="openPromoteModal(member)"
          />
        </div>
      </div>
    </UCard>

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
      <!-- Filtres -->
      <UCard class="mb-6">
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-muted">Recherche :</span>
            <UInput
              v-model="searchQuery"
              placeholder="Rechercher un succes..."
              icon="i-lucide-search"
              class="max-w-xs"
            />
          </div>

          <div v-if="!isSearchActive" class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-medium text-muted">Faction :</span>
            <UButton
              :color="allFactionsSelected ? 'primary' : 'neutral'"
              :variant="allFactionsSelected ? 'solid' : 'outline'"
              size="sm"
              @click="selectedFactionKey = ''"
            >
              Toutes
            </UButton>
            <UButton
              v-for="faction in factions"
              :key="faction.key"
              :color="selectedFactionKey === faction.key ? 'primary' : 'neutral'"
              :variant="selectedFactionKey === faction.key ? 'solid' : 'outline'"
              size="sm"
              @click="selectedFactionKey = faction.key"
            >
              {{ faction.name }}
            </UButton>
          </div>

          <div
            v-if="!isSearchActive && !allFactionsSelected && hasMultipleCampaigns"
            class="flex items-center gap-3 flex-wrap"
          >
            <span class="text-sm font-medium text-muted">Campagnes :</span>
            <UButton
              v-for="campaign in selectedFaction?.campaigns"
              :key="campaign.id"
              :color="selectedCampaignIds.includes(campaign.id) ? 'info' : 'neutral'"
              :variant="selectedCampaignIds.includes(campaign.id) ? 'solid' : 'outline'"
              size="sm"
              @click="toggleCampaign(campaign.id)"
            >
              {{ campaign.name }}
            </UButton>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-medium text-muted">Utilisateurs :</span>
            <UTooltip
              v-for="u in users"
              :key="u.id"
              :text="`Dernier import : ${formatLastImport(u.lastImportAt)}`"
            >
              <UButton
                :color="selectedUserIds.includes(u.id) ? 'success' : 'neutral'"
                :variant="selectedUserIds.includes(u.id) ? 'solid' : 'outline'"
                size="sm"
                @click="toggleUser(u.id)"
              >
                {{ u.username }}
              </UButton>
            </UTooltip>
          </div>

          <div v-if="!isSearchActive" class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-medium text-muted">Filtrer succes :</span>
            <UButton
              :color="emblemCompletionFilter === 'all' ? 'primary' : 'neutral'"
              :variant="emblemCompletionFilter === 'all' ? 'solid' : 'outline'"
              size="sm"
              @click="emblemCompletionFilter = 'all'"
            >
              Tous
            </UButton>
            <UButton
              :color="emblemCompletionFilter === 'incomplete' ? 'warning' : 'neutral'"
              :variant="emblemCompletionFilter === 'incomplete' ? 'solid' : 'outline'"
              size="sm"
              @click="emblemCompletionFilter = 'incomplete'"
            >
              Non completes
            </UButton>
            <UButton
              :color="emblemCompletionFilter === 'complete' ? 'success' : 'neutral'"
              :variant="emblemCompletionFilter === 'complete' ? 'solid' : 'outline'"
              size="sm"
              @click="emblemCompletionFilter = 'complete'"
            >
              Completes
            </UButton>
          </div>
        </div>
      </UCard>

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
          <UTable :data="getTableData(result.emblems)" :columns="columns" />
        </div>
      </template>

      <!-- Toutes les factions -->
      <template v-else-if="allFactionsSelected">
        <template v-for="{ faction, campaigns } in allFactionsCampaigns" :key="faction.key">
          <div v-if="campaigns.some(c => filterEmblems(c.emblems).length > 0)" class="mb-8">
            <h2 class="text-2xl font-pirate">{{ faction.name }}</h2>
            <p v-if="faction.motto" class="text-muted italic mb-4">« {{ faction.motto }} »</p>

            <template v-for="campaign in campaigns" :key="campaign.id">
              <div v-if="filterEmblems(campaign.emblems).length > 0" class="mb-6">
                <div v-if="campaign.key !== 'default'" class="mb-4">
                  <h3 class="text-lg font-semibold">{{ campaign.name }}</h3>
                  <p v-if="campaign.description" class="text-sm text-muted italic">{{ campaign.description }}</p>
                </div>
                <UTable :data="getTableData(campaign.emblems)" :columns="columns" />
              </div>
            </template>
          </div>
        </template>
      </template>

      <!-- Faction spécifique -->
      <template v-else-if="selectedFaction">
        <div class="mb-6">
          <h2 class="text-2xl font-pirate">{{ selectedFaction.name }}</h2>
          <p v-if="selectedFaction.motto" class="text-muted italic">« {{ selectedFaction.motto }} »</p>
        </div>

        <template v-for="campaign in filteredCampaigns" :key="campaign.id">
          <div v-if="filterEmblems(campaign.emblems).length > 0" class="mb-8">
            <div v-if="campaign.key !== 'default'" class="mb-4">
              <h3 class="text-lg font-semibold">{{ campaign.name }}</h3>
              <p v-if="campaign.description" class="text-sm text-muted italic">{{ campaign.description }}</p>
            </div>
            <UTable :data="getTableData(campaign.emblems)" :columns="columns" />
          </div>
        </template>
      </template>
    </template>

    <!-- Modal Inviter -->
    <UModal v-model:open="isInviteModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Inviter un membre</h2>
          </template>
          <UFormField label="Pseudo de l'utilisateur">
            <UInput v-model="inviteUsername" placeholder="Pseudo exact" class="w-full" />
          </UFormField>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Annuler" color="neutral" variant="outline" @click="isInviteModalOpen = false" />
              <UButton label="Inviter" icon="i-lucide-user-plus" :loading="isInviting" @click="handleInvite" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal Promouvoir -->
    <UModal v-model:open="isPromoteModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">Promouvoir en admin</h2>
          </template>
          <p>Voulez-vous promouvoir <strong>{{ memberToPromote?.username }}</strong> en tant qu'admin ?</p>
          <p class="text-sm text-muted mt-2">Les admins peuvent inviter des membres et promouvoir d'autres utilisateurs.</p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Annuler" color="neutral" variant="outline" @click="isPromoteModalOpen = false" />
              <UButton label="Promouvoir" icon="i-lucide-shield" :loading="isPromoting" @click="handlePromote" />
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
