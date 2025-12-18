<script setup lang="ts">
const { isAdmin, isAuthenticated } = useAuth()

useSeoMeta({
  title: 'Factions - Administration'
})

// Redirection si non admin
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value || !isAdmin.value) {
      navigateTo('/')
    }
  }
})

interface Emblem {
  id: number
  key: string
  name: string
  description: string | null
  image: string | null
  maxGrade: number
  sortOrder: number
  userCount: number
}

interface Campaign {
  id: number
  key: string
  name: string
  description: string | null
  sortOrder: number
  emblems: Emblem[]
}

interface Faction {
  id: number
  key: string
  name: string
  motto: string | null
  campaigns: Campaign[]
}

const { data: factions, status } = await useFetch<Faction[]>('/api/admin/factions')

// Compteurs
const stats = computed(() => {
  if (!factions.value) return { factions: 0, campaigns: 0, emblems: 0 }

  let campaigns = 0
  let emblems = 0

  for (const faction of factions.value) {
    campaigns += faction.campaigns.length
    for (const campaign of faction.campaigns) {
      emblems += campaign.emblems.length
    }
  }

  return {
    factions: factions.value.length,
    campaigns,
    emblems
  }
})

// Accordéon ouvert
const openFactions = ref<string[]>([])
const openCampaigns = ref<string[]>([])

function toggleFaction(key: string) {
  const index = openFactions.value.indexOf(key)
  if (index === -1) {
    openFactions.value.push(key)
  } else {
    openFactions.value.splice(index, 1)
  }
}

function toggleCampaign(key: string) {
  const index = openCampaigns.value.indexOf(key)
  if (index === -1) {
    openCampaigns.value.push(key)
  } else {
    openCampaigns.value.splice(index, 1)
  }
}

function isFactionOpen(key: string) {
  return openFactions.value.includes(key)
}

function isCampaignOpen(key: string) {
  return openCampaigns.value.includes(key)
}

// Edition des grades
const editingEmblem = ref<Emblem | null>(null)
const isEditModalOpen = computed({
  get: () => editingEmblem.value !== null,
  set: (value) => {
    if (!value) editingEmblem.value = null
  }
})

function editEmblemGrades(emblem: Emblem) {
  editingEmblem.value = emblem
}

function onGradesSaved() {
  // On pourrait rafraîchir les données ici si nécessaire
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
        Factions & Emblemes
      </h1>
      <p class="text-muted mt-2">
        Gestion des factions, campagnes et emblemes
      </p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-4 mb-8">
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-primary">{{ stats.factions }}</div>
          <div class="text-sm text-muted">Factions</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-primary">{{ stats.campaigns }}</div>
          <div class="text-sm text-muted">Campagnes</div>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-primary">{{ stats.emblems }}</div>
          <div class="text-sm text-muted">Emblemes</div>
        </div>
      </UCard>
    </div>

    <!-- Loading -->
    <div v-if="status === 'pending'" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>

    <!-- Factions -->
    <div v-else-if="factions && factions.length > 0" class="space-y-4">
      <UCard v-for="faction in factions" :key="faction.id">
        <!-- Header Faction -->
        <div
          class="flex items-center justify-between cursor-pointer"
          @click="toggleFaction(faction.key)"
        >
          <div class="flex items-center gap-3">
            <UIcon
              :name="isFactionOpen(faction.key) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="w-5 h-5 text-muted"
            />
            <div>
              <h3 class="font-semibold">{{ faction.name }}</h3>
              <p v-if="faction.motto" class="text-sm text-muted italic">{{ faction.motto }}</p>
            </div>
          </div>
          <div class="flex items-center gap-4 text-sm text-muted">
            <span>{{ faction.campaigns.length }} campagne{{ faction.campaigns.length > 1 ? 's' : '' }}</span>
            <UBadge color="neutral" size="xs">{{ faction.key }}</UBadge>
          </div>
        </div>

        <!-- Campagnes -->
        <div v-if="isFactionOpen(faction.key)" class="mt-4 ml-8 space-y-3">
          <div
            v-for="campaign in faction.campaigns"
            :key="campaign.id"
            class="border border-muted/30 rounded-lg overflow-hidden"
          >
            <!-- Header Campagne -->
            <div
              class="flex items-center justify-between p-3 bg-muted/10 cursor-pointer"
              @click="toggleCampaign(`${faction.key}-${campaign.key}`)"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="isCampaignOpen(`${faction.key}-${campaign.key}`) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  class="w-4 h-4 text-muted"
                />
                <span class="font-medium">{{ campaign.name }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm text-muted">
                <span>{{ campaign.emblems.length }} embleme{{ campaign.emblems.length > 1 ? 's' : '' }}</span>
                <UBadge color="neutral" size="xs">{{ campaign.key }}</UBadge>
              </div>
            </div>

            <!-- Emblèmes -->
            <div v-if="isCampaignOpen(`${faction.key}-${campaign.key}`)" class="p-3">
              <table v-if="campaign.emblems.length > 0" class="w-full text-sm">
                <thead>
                  <tr class="border-b border-muted/30">
                    <th class="text-left py-2 px-2 font-medium">Embleme</th>
                    <th class="text-left py-2 px-2 font-medium">Key</th>
                    <th class="text-center py-2 px-2 font-medium">Grades</th>
                    <th class="text-center py-2 px-2 font-medium">Joueurs</th>
                    <th class="w-10" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="emblem in campaign.emblems"
                    :key="emblem.id"
                    class="border-b border-muted/20 last:border-0"
                  >
                    <td class="py-2 px-2">
                      <div class="flex items-center gap-2">
                        <img
                          v-if="emblem.image"
                          :src="emblem.image"
                          :alt="emblem.name"
                          class="w-8 h-8 rounded"
                        />
                        <div v-else class="w-8 h-8 rounded bg-muted/30 flex items-center justify-center">
                          <UIcon name="i-lucide-image-off" class="w-4 h-4 text-muted" />
                        </div>
                        <div>
                          <div class="font-medium">{{ emblem.name }}</div>
                          <div v-if="emblem.description" class="text-xs text-muted truncate max-w-xs">
                            {{ emblem.description }}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-2 px-2">
                      <code class="text-xs bg-muted/30 px-1 py-0.5 rounded">{{ emblem.key }}</code>
                    </td>
                    <td class="py-2 px-2 text-center">
                      {{ emblem.maxGrade }}
                    </td>
                    <td class="py-2 px-2 text-center">
                      <UBadge v-if="emblem.userCount > 0" color="success" size="xs">
                        {{ emblem.userCount }}
                      </UBadge>
                      <span v-else class="text-muted">-</span>
                    </td>
                    <td class="py-2 px-2 text-center">
                      <UButton
                        v-if="emblem.maxGrade > 1"
                        icon="i-lucide-pencil"
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        @click.stop="editEmblemGrades(emblem)"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="text-muted text-center py-4">Aucun embleme</p>
            </div>
          </div>

          <p v-if="faction.campaigns.length === 0" class="text-muted text-center py-4">
            Aucune campagne
          </p>
        </div>
      </UCard>
    </div>

    <div v-else class="text-center py-8 text-muted">
      Aucune faction
    </div>

    <!-- Modal edition grades -->
    <UModal v-model:open="isEditModalOpen">
      <template #content>
        <UCard>
          <EmblemGradesEditor
            v-if="editingEmblem"
            :emblem="editingEmblem"
            @close="editingEmblem = null"
            @saved="onGradesSaved"
          />
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
