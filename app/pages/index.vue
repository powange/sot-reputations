<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface UserInfo {
  id: number
  username: string
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

interface ReputationData {
  users: UserInfo[]
  factions: FactionWithCampaigns[]
}

interface TableRow {
  id: number
  name: string
  description: string
  image: string
  [key: string]: string | number | boolean | undefined
}

const toast = useToast()

// Données de réputation
const { data: reputationData, refresh } = await useFetch<ReputationData>('/api')

// État du formulaire d'import
const isImportModalOpen = ref(false)
const importForm = ref({
  username: '',
  password: '',
  jsonText: ''
})
const isImporting = ref(false)

// État du formulaire de suppression
const isDeleteModalOpen = ref(false)
const deleteForm = ref({
  username: '',
  password: ''
})
const isDeleting = ref(false)

// Charger les identifiants sauvegardés (uniquement pour l'import)
onMounted(() => {
  const savedUsername = localStorage.getItem('reputation_username')
  const savedPassword = localStorage.getItem('reputation_password')
  if (savedUsername) importForm.value.username = savedUsername
  if (savedPassword) importForm.value.password = savedPassword
})

// Faction sélectionnée
const selectedFactionKey = ref<string>('')

// Utilisateurs sélectionnés pour l'affichage
const selectedUserIds = ref<number[]>([])

// Campagnes sélectionnées pour l'affichage
const selectedCampaignIds = ref<number[]>([])

// Filtre de complétion des emblèmes : 'all' | 'incomplete' | 'complete'
const emblemCompletionFilter = ref<'all' | 'incomplete' | 'complete'>('all')

// Recherche dans les succès
const searchQuery = ref('')

// Détecte si une recherche est active
const isSearchActive = computed(() => searchQuery.value.trim().length > 0)

// Toutes les factions sélectionnées ?
const allFactionsSelected = computed(() => selectedFactionKey.value === '')

// Initialiser les utilisateurs (pas de faction par défaut = toutes)
watch(reputationData, (data, oldData) => {
  // Sélectionner tous les utilisateurs par défaut, ou ajouter les nouveaux
  if (data?.users) {
    if (selectedUserIds.value.length === 0) {
      selectedUserIds.value = data.users.map(u => u.id)
    } else {
      // Ajouter les nouveaux utilisateurs qui ne sont pas encore sélectionnés
      const existingIds = new Set(oldData?.users?.map(u => u.id) || [])
      const newUsers = data.users.filter(u => !existingIds.has(u.id))
      for (const user of newUsers) {
        selectedUserIds.value.push(user.id)
      }
    }
  }
}, { immediate: true })

const selectedFaction = computed(() => {
  return reputationData.value?.factions.find(f => f.key === selectedFactionKey.value)
})

// Quand la faction change, sélectionner toutes ses campagnes par défaut
watch(selectedFaction, (faction) => {
  if (faction?.campaigns) {
    selectedCampaignIds.value = faction.campaigns.map(c => c.id)
  }
}, { immediate: true })

// Vérifier si la faction a plusieurs campagnes (pas juste "default")
const hasMultipleCampaigns = computed(() => {
  if (!selectedFaction.value?.campaigns) return false
  return selectedFaction.value.campaigns.length > 1 ||
    (selectedFaction.value.campaigns.length === 1 && selectedFaction.value.campaigns[0].key !== 'default')
})

// Campagnes filtrées (pour une faction spécifique)
const filteredCampaigns = computed(() => {
  if (!selectedFaction.value?.campaigns) return []
  return selectedFaction.value.campaigns.filter(c => selectedCampaignIds.value.includes(c.id))
})

// Toutes les factions avec leurs campagnes (pour l'affichage "Toutes")
const allFactionsCampaigns = computed(() => {
  if (!reputationData.value?.factions) return []
  return reputationData.value.factions.map(faction => ({
    faction,
    campaigns: faction.campaigns.filter(c => c.key !== 'default' || faction.campaigns.length === 1)
  }))
})

// Résultats de recherche globaux (toutes factions/campagnes)
const searchResults = computed(() => {
  if (!isSearchActive.value || !reputationData.value?.factions) return []

  const query = searchQuery.value.toLowerCase().trim()
  const results: Array<{
    factionName: string
    campaignName: string
    campaignKey: string
    emblems: Array<EmblemInfo & { userProgress: Record<number, UserEmblemProgress> }>
  }> = []

  for (const faction of reputationData.value.factions) {
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

// Vérifier si un emblème est complété par tous les utilisateurs sélectionnés
function isEmblemCompletedByAll(emblem: { userProgress: Record<number, UserEmblemProgress> }): boolean {
  for (const user of selectedUsers.value) {
    const progress = emblem.userProgress[user.id]
    if (!progress?.completed) {
      return false
    }
  }
  return true
}

// Filtrer les emblèmes selon le filtre de complétion
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

const users = computed(() => reputationData.value?.users || [])

// Formater la date du dernier import
function formatLastImport(dateStr: string | null): string {
  if (!dateStr) return 'Jamais importé'
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const selectedUsers = computed(() => {
  return users.value.filter(u => selectedUserIds.value.includes(u.id))
})

// Générer les colonnes dynamiquement
const columns = computed<TableColumn<TableRow>[]>(() => {
  const cols: TableColumn<TableRow>[] = [
    {
      accessorKey: 'name',
      header: 'Succes',
      cell: ({ row }) => {
        const children = []

        // Image si disponible
        if (row.original.image) {
          children.push(h('img', {
            src: row.original.image,
            alt: row.original.name,
            class: 'w-10 h-10 object-contain shrink-0'
          }))
        }

        // Texte (nom + description)
        children.push(h('div', {}, [
          h('div', { class: 'font-medium' }, row.original.name),
          h('div', { class: 'text-xs text-muted' }, row.original.description)
        ]))

        return h('div', { class: 'flex items-center gap-3' }, children)
      }
    }
  ]

  // Ajouter une colonne par utilisateur sélectionné
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

// Transformer les emblèmes en données de table (avec filtrage par complétion)
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
    // Garder au moins un utilisateur
    selectedUserIds.value.splice(index, 1)
  }
}

function toggleCampaign(campaignId: number) {
  const allCampaignIds = selectedFaction.value?.campaigns.map(c => c.id) || []
  const allSelected = selectedCampaignIds.value.length === allCampaignIds.length

  if (allSelected) {
    // Toutes les campagnes sont sélectionnées : ne garder que celle cliquée
    selectedCampaignIds.value = [campaignId]
  } else {
    // Mode toggle normal
    const index = selectedCampaignIds.value.indexOf(campaignId)
    if (index === -1) {
      selectedCampaignIds.value.push(campaignId)
    } else if (selectedCampaignIds.value.length > 1) {
      // Garder au moins une campagne
      selectedCampaignIds.value.splice(index, 1)
    }
  }
}

async function submitImport() {
  if (!importForm.value.username || !importForm.value.password || !importForm.value.jsonText) {
    toast.add({
      title: 'Erreur',
      description: 'Tous les champs sont requis',
      color: 'error'
    })
    return
  }

  let jsonData: unknown
  try {
    jsonData = JSON.parse(importForm.value.jsonText)
  } catch {
    toast.add({
      title: 'Erreur',
      description: 'JSON invalide',
      color: 'error'
    })
    return
  }

  isImporting.value = true

  try {
    const result = await $fetch('/api/import', {
      method: 'POST',
      body: {
        username: importForm.value.username,
        password: importForm.value.password,
        jsonData
      }
    })

    // Sauvegarder les identifiants pour la prochaine fois
    localStorage.setItem('reputation_username', importForm.value.username)
    localStorage.setItem('reputation_password', importForm.value.password)

    toast.add({
      title: 'Succes',
      description: (result as { message: string }).message,
      color: 'success'
    })

    isImportModalOpen.value = false
    importForm.value.jsonText = ''
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string }
    const message = err.data?.message || err.message || 'Erreur lors de l\'import'
    toast.add({
      title: 'Erreur',
      description: message,
      color: 'error'
    })
  } finally {
    isImporting.value = false
  }
}

async function submitDelete() {
  if (!deleteForm.value.username || !deleteForm.value.password) {
    toast.add({
      title: 'Erreur',
      description: 'Pseudo et mot de passe sont requis',
      color: 'error'
    })
    return
  }

  isDeleting.value = true

  try {
    const result = await $fetch('/api/delete', {
      method: 'POST',
      body: {
        username: deleteForm.value.username,
        password: deleteForm.value.password
      }
    })

    // Supprimer les identifiants sauvegardés
    localStorage.removeItem('reputation_username')
    localStorage.removeItem('reputation_password')

    toast.add({
      title: 'Succes',
      description: (result as { message: string }).message,
      color: 'success'
    })

    isDeleteModalOpen.value = false
    deleteForm.value = { username: '', password: '' }
    importForm.value = { username: '', password: '', jsonText: '' }
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }, message?: string }
    const message = err.data?.message || err.message || 'Erreur lors de la suppression'
    toast.add({
      title: 'Erreur',
      description: message,
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <UContainer class="py-8">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-4xl font-pirate">
          Reputations Sea of Thieves
        </h1>
        <p class="text-muted mt-1">
          Comparez votre progression avec les autres pirates
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          to="/tutoriel"
          icon="i-lucide-help-circle"
          label="Comment faire ?"
          variant="outline"
        />
        <UButton
          icon="i-lucide-upload"
          label="Importer mes donnees"
          @click="isImportModalOpen = true"
        />
        <UButton
          icon="i-lucide-trash-2"
          label="Supprimer mes donnees"
          color="error"
          variant="outline"
          @click="isDeleteModalOpen = true"
        />
      </div>
    </div>

    <!-- Message si pas de données -->
    <div
      v-if="!users.length"
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
        Soyez le premier a importer vos donnees de reputation !
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
          <!-- Recherche dans les succès -->
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-muted">Recherche :</span>
            <UInput
              v-model="searchQuery"
              placeholder="Rechercher un succes..."
              icon="i-lucide-search"
              class="max-w-xs"
            />
          </div>

          <!-- Sélection de faction (masqué si recherche active) -->
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
              v-for="faction in reputationData?.factions"
              :key="faction.key"
              :color="selectedFactionKey === faction.key ? 'primary' : 'neutral'"
              :variant="selectedFactionKey === faction.key ? 'solid' : 'outline'"
              size="sm"
              @click="selectedFactionKey = faction.key"
            >
              {{ faction.name }}
            </UButton>
          </div>

          <!-- Sélection des campagnes (masqué si recherche active ou toutes factions) -->
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

          <!-- Sélection des utilisateurs -->
          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-medium text-muted">Utilisateurs :</span>
            <UTooltip
              v-for="user in users"
              :key="user.id"
              :text="`Dernier import : ${formatLastImport(user.lastImportAt)}`"
            >
              <UButton
                :color="selectedUserIds.includes(user.id) ? 'success' : 'neutral'"
                :variant="selectedUserIds.includes(user.id) ? 'solid' : 'outline'"
                size="sm"
                @click="toggleUser(user.id)"
              >
                {{ user.username }}
              </UButton>
            </UTooltip>
          </div>

          <!-- Filtre de complétion des succès (masqué si recherche active) -->
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

      <!-- Résultats de recherche globaux -->
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

          <UTable
            :data="getTableData(result.emblems)"
            :columns="columns"
          />
        </div>
      </template>

      <!-- Tableau des succès - Toutes les factions -->
      <template v-else-if="allFactionsSelected">
        <template
          v-for="{ faction, campaigns } in allFactionsCampaigns"
          :key="faction.key"
        >
          <!-- N'afficher la faction que si au moins une campagne a des données -->
          <div
            v-if="campaigns.some(c => filterEmblems(c.emblems).length > 0)"
            class="mb-8"
          >
            <h2 class="text-2xl font-pirate">
              {{ faction.name }}
            </h2>
            <p
              v-if="faction.motto"
              class="text-muted italic mb-4"
            >
              « {{ faction.motto }} »
            </p>

            <template
              v-for="campaign in campaigns"
              :key="campaign.id"
            >
              <!-- N'afficher la campagne que si elle a des données -->
              <div
                v-if="filterEmblems(campaign.emblems).length > 0"
                class="mb-6"
              >
                <div v-if="campaign.key !== 'default'" class="mb-4">
                  <h3 class="text-lg font-semibold">
                    {{ campaign.name }}
                  </h3>
                  <p
                    v-if="campaign.description"
                    class="text-sm text-muted italic"
                  >
                    {{ campaign.description }}
                  </p>
                </div>

                <UTable
                  :data="getTableData(campaign.emblems)"
                  :columns="columns"
                />
              </div>
            </template>
          </div>
        </template>
      </template>

      <!-- Tableau des succès - Une faction spécifique -->
      <template v-else-if="selectedFaction">
        <div class="mb-6">
          <h2 class="text-2xl font-pirate">
            {{ selectedFaction.name }}
          </h2>
          <p
            v-if="selectedFaction.motto"
            class="text-muted italic"
          >
            « {{ selectedFaction.motto }} »
          </p>
        </div>

        <template
          v-for="campaign in filteredCampaigns"
          :key="campaign.id"
        >
          <!-- N'afficher la campagne que si elle a des données -->
          <div
            v-if="filterEmblems(campaign.emblems).length > 0"
            class="mb-8"
          >
            <div v-if="campaign.key !== 'default'" class="mb-4">
              <h3 class="text-lg font-semibold">
                {{ campaign.name }}
              </h3>
              <p
                v-if="campaign.description"
                class="text-sm text-muted italic"
              >
                {{ campaign.description }}
              </p>
            </div>

            <UTable
              :data="getTableData(campaign.emblems)"
              :columns="columns"
            />
          </div>
        </template>
      </template>
    </template>

    <!-- Modal d'import -->
    <UModal v-model:open="isImportModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold">
              Importer vos donnees de reputation
            </h2>
          </template>

          <div class="space-y-4">
            <UAlert
              icon="i-lucide-alert-triangle"
              color="warning"
              title="Important : JSON en francais uniquement"
            >
              <template #description>
                <p class="text-sm mb-2">
                  Le site Sea of Thieves doit etre en francais pour recuperer vos donnees.
                  <UButton
                    to="/tutoriel"
                    size="xs"
                    variant="link"
                    label="Voir le tutoriel"
                    class="p-0"
                    @click="isImportModalOpen = false"
                  />
                </p>
              </template>
            </UAlert>

            <UFormField label="Pseudo" class="w-full">
              <UInput
                v-model="importForm.username"
                placeholder="Votre pseudo de pirate"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Mot de passe" class="w-full">
              <UInput
                v-model="importForm.password"
                type="password"
                placeholder="Creez un mot de passe pour mettre a jour vos donnees"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Donnees JSON" class="w-full">
              <UTextarea
                v-model="importForm.jsonText"
                placeholder="Collez ici le JSON de l'API reputation..."
                :rows="10"
                class="w-full"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Annuler"
                color="neutral"
                variant="outline"
                @click="isImportModalOpen = false"
              />
              <UButton
                label="Importer"
                icon="i-lucide-upload"
                :loading="isImporting"
                @click="submitImport"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal de suppression -->
    <UModal v-model:open="isDeleteModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="text-xl font-semibold text-error">
              Supprimer mon compte
            </h2>
          </template>

          <div class="space-y-4">
            <UAlert
              icon="i-lucide-alert-triangle"
              color="error"
              title="Attention : action irreversible"
            >
              <template #description>
                <p class="text-sm">
                  Cette action supprimera definitivement votre compte et toutes vos donnees de progression.
                </p>
              </template>
            </UAlert>

            <UFormField label="Pseudo" class="w-full">
              <UInput
                v-model="deleteForm.username"
                placeholder="Votre pseudo de pirate"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Mot de passe" class="w-full">
              <UInput
                v-model="deleteForm.password"
                type="password"
                placeholder="Votre mot de passe"
                class="w-full"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Annuler"
                color="neutral"
                variant="outline"
                @click="isDeleteModalOpen = false"
              />
              <UButton
                label="Supprimer"
                icon="i-lucide-trash-2"
                color="error"
                :loading="isDeleting"
                @click="submitDelete"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
