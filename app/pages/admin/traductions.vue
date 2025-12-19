<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Traductions - Administration'
})

// Redirection si non admin/moderateur
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value || !isAdminOrModerator.value) {
      navigateTo('/')
    }
  }
})

interface EmblemWithTranslations {
  id: number
  key: string
  name: string
  description: string | null
  image: string | null
  campaign_name: string
  campaign_key: string
  faction_name: string
  faction_key: string
  translations: Record<string, { name: string | null; description: string | null }>
}

const { data: emblems, status, refresh } = await useFetch<EmblemWithTranslations[]>('/api/admin/translations')

// Recherche
const searchQuery = ref('')

// Filtre par statut de traduction
const translationFilter = ref<'all' | 'missing_en' | 'missing_es' | 'complete'>('all')

// Emblème en cours d'édition
const editingEmblem = ref<EmblemWithTranslations | null>(null)
const isEditModalOpen = computed({
  get: () => editingEmblem.value !== null && !isChainMode.value,
  set: (value) => {
    if (!value) editingEmblem.value = null
  }
})

// Formulaire d'édition
const editForm = ref({
  en: { name: '', description: '' },
  es: { name: '', description: '' }
})
const isSaving = ref(false)

function openEditModal(emblem: EmblemWithTranslations) {
  editingEmblem.value = emblem
  editForm.value = {
    en: {
      name: emblem.translations.en?.name || '',
      description: emblem.translations.en?.description || ''
    },
    es: {
      name: emblem.translations.es?.name || '',
      description: emblem.translations.es?.description || ''
    }
  }
}

async function saveTranslations() {
  if (!editingEmblem.value) return

  isSaving.value = true
  try {
    await $fetch(`/api/admin/emblems/${editingEmblem.value.id}/translations`, {
      method: 'PUT',
      body: {
        translations: [
          { locale: 'en', name: editForm.value.en.name || null, description: editForm.value.en.description || null },
          { locale: 'es', name: editForm.value.es.name || null, description: editForm.value.es.description || null }
        ]
      }
    })
    toast.add({ title: 'Traductions sauvegardées', color: 'success' })
    editingEmblem.value = null
    await refresh()
  } catch {
    toast.add({ title: 'Erreur', description: 'Impossible de sauvegarder les traductions', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

// ============ IMPORT AUTOMATIQUE ============

// Modal d'import
const isImportModalOpen = ref(false)
const frenchJson = ref('')
const targetLocale = ref<'en' | 'es'>('en')
const targetJson = ref('')
const selectedFactions = ref<string[]>([])
const isAnalyzing = ref(false)

// Liste des factions disponibles (extraites des emblèmes)
const availableFactions = computed(() => {
  if (!emblems.value) return []
  const factions = new Map<string, string>()
  for (const emblem of emblems.value) {
    if (!factions.has(emblem.faction_key)) {
      factions.set(emblem.faction_key, emblem.faction_name)
    }
  }
  return Array.from(factions.entries()).map(([key, name]) => ({
    value: key,
    label: name
  })).sort((a, b) => a.label.localeCompare(b.label))
})

// Structure des données JSON du jeu
interface GameEmblemData {
  DisplayName?: string
  '#Name'?: string
  Description?: string
  image?: string
}

interface GameCampaignData {
  Emblems?: GameEmblemData[]
}

interface GameFactionData {
  Emblems?: { Emblems?: GameEmblemData[] }
  Campaigns?: Record<string, GameCampaignData>
}

type GameJson = Record<string, GameFactionData>

// Correspondance trouvée
interface MatchedTranslation {
  emblem: EmblemWithTranslations
  translatedName: string
  translatedDescription: string
}

// Mode chaîne de traduction
const isChainMode = ref(false)
const matchedTranslations = ref<MatchedTranslation[]>([])
const currentMatchIndex = ref(0)
const chainStats = ref({ saved: 0, skipped: 0 })

// Ouvrir la modal d'import
function openImportModal() {
  frenchJson.value = ''
  targetJson.value = ''
  targetLocale.value = 'en'
  selectedFactions.value = []
  isImportModalOpen.value = true
}

// Extraire tous les emblèmes d'un JSON du jeu avec l'image comme clé
function extractEmblemsByImage(json: GameJson): Map<string, { name: string; description: string }> {
  const result = new Map<string, { name: string; description: string }>()

  for (const factionData of Object.values(json)) {
    // Factions avec Campaigns (BilgeRats, HuntersCall)
    if (factionData.Campaigns) {
      for (const campaign of Object.values(factionData.Campaigns)) {
        if (campaign.Emblems) {
          for (const emblem of campaign.Emblems) {
            if (emblem.image) {
              result.set(emblem.image, {
                name: emblem.DisplayName || '',
                description: emblem.Description || ''
              })
            }
          }
        }
      }
    }

    // Factions standard avec Emblems.Emblems
    if (factionData.Emblems?.Emblems) {
      for (const emblem of factionData.Emblems.Emblems) {
        if (emblem.image) {
          result.set(emblem.image, {
            name: emblem.DisplayName || '',
            description: emblem.Description || ''
          })
        }
      }
    }
  }

  return result
}

// Créer un mapping nom français → image (depuis JSON français)
function buildFrenchNameToImageMap(json: GameJson): Map<string, string> {
  const result = new Map<string, string>()

  for (const factionData of Object.values(json)) {
    if (factionData.Campaigns) {
      for (const campaign of Object.values(factionData.Campaigns)) {
        if (campaign.Emblems) {
          for (const emblem of campaign.Emblems) {
            const name = emblem.DisplayName || emblem['#Name']
            if (name && emblem.image) {
              result.set(name, emblem.image)
            }
          }
        }
      }
    }

    if (factionData.Emblems?.Emblems) {
      for (const emblem of factionData.Emblems.Emblems) {
        const name = emblem.DisplayName || emblem['#Name']
        if (name && emblem.image) {
          result.set(name, emblem.image)
        }
      }
    }
  }

  return result
}

// Analyser les JSONs et trouver les correspondances
function analyzeJsons() {
  if (!frenchJson.value.trim() || !targetJson.value.trim()) {
    toast.add({ title: 'Erreur', description: 'Veuillez remplir les deux champs JSON', color: 'error' })
    return
  }

  isAnalyzing.value = true

  try {
    const frJson = JSON.parse(frenchJson.value) as GameJson
    const tgtJson = JSON.parse(targetJson.value) as GameJson

    // Étape 1: Mapping nom français → image (depuis JSON FR)
    const frNameToImage = buildFrenchNameToImageMap(frJson)

    // Étape 2: Mapping image → traduction (depuis JSON cible)
    const tgtEmblemsByImage = extractEmblemsByImage(tgtJson)

    // Stats de diagnostic
    let alreadyTranslated = 0
    let noMatchInFrJson = 0
    let noMatchByImage = 0

    // Trouver les correspondances avec les emblèmes de la base
    const matches: MatchedTranslation[] = []

    if (emblems.value) {
      for (const emblem of emblems.value) {
        // Filtrer par faction si sélectionnée
        if (selectedFactions.value.length > 0 && !selectedFactions.value.includes(emblem.faction_key)) {
          continue
        }

        // Vérifier si la traduction existe déjà
        const existingTranslation = emblem.translations[targetLocale.value]
        if (existingTranslation?.name && existingTranslation?.description) {
          alreadyTranslated++
          continue
        }

        // Étape 1: BDD key (nom FR) → image via JSON FR
        const imageUrl = frNameToImage.get(emblem.key)
        if (!imageUrl) {
          noMatchInFrJson++
          continue
        }

        // Étape 2: image → traduction via JSON cible
        const translation = tgtEmblemsByImage.get(imageUrl)
        if (translation && (translation.name || translation.description)) {
          matches.push({
            emblem,
            translatedName: translation.name,
            translatedDescription: translation.description
          })
        } else {
          noMatchByImage++
        }
      }
    }

    // Afficher les stats de diagnostic
    console.log('=== Diagnostic Import ===')
    console.log(`Emblèmes dans la base: ${emblems.value?.length || 0}`)
    console.log(`Noms FR avec image dans JSON FR: ${frNameToImage.size}`)
    console.log(`Images dans JSON cible: ${tgtEmblemsByImage.size}`)
    console.log(`Déjà traduits: ${alreadyTranslated}`)
    console.log(`Pas trouvé dans JSON FR: ${noMatchInFrJson}`)
    console.log(`Pas de correspondance par image: ${noMatchByImage}`)
    console.log(`Correspondances trouvées: ${matches.length}`)

    if (matches.length === 0) {
      let description = 'Aucun nouvel emblème à traduire n\'a été trouvé.'
      if (alreadyTranslated > 0) {
        description += ` ${alreadyTranslated} déjà traduit(s).`
      }
      if (noMatchInFrJson > 0) {
        description += ` ${noMatchInFrJson} non trouvé(s) dans le JSON français.`
      }
      if (noMatchByImage > 0) {
        description += ` ${noMatchByImage} sans correspondance d'image.`
      }
      toast.add({
        title: 'Aucune correspondance',
        description,
        color: 'warning'
      })
      return
    }

    // Démarrer le mode chaîne
    matchedTranslations.value = matches
    currentMatchIndex.value = 0
    chainStats.value = { saved: 0, skipped: 0 }
    isImportModalOpen.value = false
    isChainMode.value = true

    // Ouvrir la première traduction
    openChainTranslation()

    toast.add({
      title: 'Analyse terminée',
      description: `${matches.length} correspondance(s) trouvée(s)`,
      color: 'success'
    })
  } catch (e) {
    toast.add({
      title: 'Erreur JSON',
      description: 'Format JSON invalide. Vérifiez vos données.',
      color: 'error'
    })
  } finally {
    isAnalyzing.value = false
  }
}

// Ouvrir la traduction courante en mode chaîne
function openChainTranslation() {
  const match = matchedTranslations.value[currentMatchIndex.value]
  if (!match) return

  editingEmblem.value = match.emblem

  // Pré-remplir seulement la langue cible
  const otherLocale = targetLocale.value === 'en' ? 'es' : 'en'
  editForm.value = {
    en: targetLocale.value === 'en'
      ? { name: match.translatedName, description: match.translatedDescription }
      : { name: match.emblem.translations.en?.name || '', description: match.emblem.translations.en?.description || '' },
    es: targetLocale.value === 'es'
      ? { name: match.translatedName, description: match.translatedDescription }
      : { name: match.emblem.translations.es?.name || '', description: match.emblem.translations.es?.description || '' }
  }
}

// Sauvegarder et passer au suivant
async function saveAndNext() {
  if (!editingEmblem.value) return

  isSaving.value = true
  try {
    await $fetch(`/api/admin/emblems/${editingEmblem.value.id}/translations`, {
      method: 'PUT',
      body: {
        translations: [
          { locale: 'en', name: editForm.value.en.name || null, description: editForm.value.en.description || null },
          { locale: 'es', name: editForm.value.es.name || null, description: editForm.value.es.description || null }
        ]
      }
    })
    chainStats.value.saved++
    goToNext()
  } catch {
    toast.add({ title: 'Erreur', description: 'Impossible de sauvegarder', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

// Passer sans sauvegarder
function skipAndNext() {
  chainStats.value.skipped++
  goToNext()
}

// Aller au suivant ou terminer
function goToNext() {
  currentMatchIndex.value++
  if (currentMatchIndex.value >= matchedTranslations.value.length) {
    // Fin de la chaîne
    endChainMode()
  } else {
    openChainTranslation()
  }
}

// Terminer le mode chaîne
function endChainMode() {
  isChainMode.value = false
  editingEmblem.value = null
  matchedTranslations.value = []

  toast.add({
    title: 'Import terminé',
    description: `${chainStats.value.saved} traduction(s) sauvegardée(s), ${chainStats.value.skipped} ignorée(s)`,
    color: 'success'
  })

  refresh()
}

// Annuler le mode chaîne
function cancelChainMode() {
  isChainMode.value = false
  editingEmblem.value = null
  matchedTranslations.value = []

  if (chainStats.value.saved > 0) {
    toast.add({
      title: 'Import interrompu',
      description: `${chainStats.value.saved} traduction(s) sauvegardée(s) avant l'annulation`,
      color: 'warning'
    })
    refresh()
  }
}

// Valider toutes les traductions restantes
const isSavingAll = ref(false)

async function saveAllRemaining() {
  isSavingAll.value = true

  const remaining = matchedTranslations.value.slice(currentMatchIndex.value)
  let savedCount = 0
  let errorCount = 0

  for (const match of remaining) {
    try {
      // Préparer les traductions à sauvegarder
      const translations = []

      if (targetLocale.value === 'en') {
        translations.push({
          locale: 'en',
          name: match.translatedName || null,
          description: match.translatedDescription || null
        })
        // Conserver la traduction ES existante
        if (match.emblem.translations.es) {
          translations.push({
            locale: 'es',
            name: match.emblem.translations.es.name || null,
            description: match.emblem.translations.es.description || null
          })
        }
      } else {
        // Conserver la traduction EN existante
        if (match.emblem.translations.en) {
          translations.push({
            locale: 'en',
            name: match.emblem.translations.en.name || null,
            description: match.emblem.translations.en.description || null
          })
        }
        translations.push({
          locale: 'es',
          name: match.translatedName || null,
          description: match.translatedDescription || null
        })
      }

      await $fetch(`/api/admin/emblems/${match.emblem.id}/translations`, {
        method: 'PUT',
        body: { translations }
      })
      savedCount++
    } catch {
      errorCount++
    }
  }

  chainStats.value.saved += savedCount
  isSavingAll.value = false

  // Terminer le mode chaîne
  isChainMode.value = false
  editingEmblem.value = null
  matchedTranslations.value = []

  toast.add({
    title: 'Import terminé',
    description: `${chainStats.value.saved} traduction(s) sauvegardée(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}, ${chainStats.value.skipped} ignorée(s)`,
    color: errorCount > 0 ? 'warning' : 'success'
  })

  refresh()
}

// Vérifier si une traduction est complète
function hasTranslation(emblem: EmblemWithTranslations, locale: string): boolean {
  const t = emblem.translations[locale]
  return !!(t?.name && t?.description)
}

function hasPartialTranslation(emblem: EmblemWithTranslations, locale: string): boolean {
  const t = emblem.translations[locale]
  return !!(t?.name || t?.description) && !(t?.name && t?.description)
}

// Filtrer les emblèmes
const filteredEmblems = computed(() => {
  if (!emblems.value) return []

  let result = emblems.value

  // Filtre par recherche
  if (searchQuery.value.trim()) {
    const query = normalizeForSearch(searchQuery.value)
    result = result.filter(e => emblemMatchesSearch(e, query))
  }

  // Filtre par statut de traduction
  if (translationFilter.value === 'missing_en') {
    result = result.filter(e => !hasTranslation(e, 'en'))
  } else if (translationFilter.value === 'missing_es') {
    result = result.filter(e => !hasTranslation(e, 'es'))
  } else if (translationFilter.value === 'complete') {
    result = result.filter(e => hasTranslation(e, 'en') && hasTranslation(e, 'es'))
  }

  return result
})

// Pagination
const currentPage = ref(1)
const pageSize = 50

const paginatedEmblems = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredEmblems.value.slice(start, start + pageSize)
})

const totalPages = computed(() => Math.ceil(filteredEmblems.value.length / pageSize))

// Reset page when filters change
watch([searchQuery, translationFilter], () => {
  currentPage.value = 1
})

// Statistiques
const stats = computed(() => {
  if (!emblems.value) return { total: 0, completeEn: 0, completeEs: 0, complete: 0 }

  const total = emblems.value.length
  const completeEn = emblems.value.filter(e => hasTranslation(e, 'en')).length
  const completeEs = emblems.value.filter(e => hasTranslation(e, 'es')).length
  const complete = emblems.value.filter(e => hasTranslation(e, 'en') && hasTranslation(e, 'es')).length

  return { total, completeEn, completeEs, complete }
})
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
        Traductions des accomplissements
      </h1>
      <p class="text-muted mt-2">
        Gérer les traductions anglaises et espagnoles
      </p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <UCard>
        <div class="text-center">
          <div class="text-3xl font-bold text-primary">{{ stats.total }}</div>
          <div class="text-sm text-muted">Total</div>
        </div>
      </UCard>
      <UCard
        :class="[
          stats.completeEn < stats.total ? 'cursor-pointer hover:bg-muted/10' : '',
          translationFilter === 'missing_en' ? 'ring-2 ring-warning' : ''
        ]"
        @click="translationFilter = translationFilter === 'missing_en' ? 'all' : 'missing_en'"
      >
        <div class="text-center">
          <div class="text-3xl font-bold" :class="stats.completeEn === stats.total ? 'text-success' : 'text-warning'">
            {{ stats.completeEn }}/{{ stats.total }}
          </div>
          <div class="text-sm text-muted">Anglais</div>
        </div>
      </UCard>
      <UCard
        :class="[
          stats.completeEs < stats.total ? 'cursor-pointer hover:bg-muted/10' : '',
          translationFilter === 'missing_es' ? 'ring-2 ring-warning' : ''
        ]"
        @click="translationFilter = translationFilter === 'missing_es' ? 'all' : 'missing_es'"
      >
        <div class="text-center">
          <div class="text-3xl font-bold" :class="stats.completeEs === stats.total ? 'text-success' : 'text-warning'">
            {{ stats.completeEs }}/{{ stats.total }}
          </div>
          <div class="text-sm text-muted">Espagnol</div>
        </div>
      </UCard>
      <UCard
        :class="[
          stats.complete < stats.total ? 'cursor-pointer hover:bg-muted/10' : '',
          translationFilter === 'complete' ? 'ring-2 ring-success' : ''
        ]"
        @click="translationFilter = translationFilter === 'complete' ? 'all' : 'complete'"
      >
        <div class="text-center">
          <div class="text-3xl font-bold" :class="stats.complete === stats.total ? 'text-success' : 'text-primary'">
            {{ stats.complete }}
          </div>
          <div class="text-sm text-muted">Complets</div>
        </div>
      </UCard>
    </div>

    <!-- Recherche, Filtres et Import -->
    <div class="flex flex-wrap items-center gap-4 mb-6">
      <UInput
        v-model="searchQuery"
        placeholder="Rechercher un accomplissement..."
        icon="i-lucide-search"
        size="lg"
        class="w-full sm:w-64"
      />
      <USelectMenu
        v-model="translationFilter"
        :items="[
          { label: 'Tous les emblèmes', value: 'all' },
          { label: 'Manquant en anglais', value: 'missing_en' },
          { label: 'Manquant en espagnol', value: 'missing_es' },
          { label: 'Traductions complètes', value: 'complete' }
        ]"
        value-key="value"
        class="w-56"
      />
      <UButton
        icon="i-lucide-upload"
        label="Import automatique"
        variant="soft"
        @click="openImportModal"
      />
    </div>

    <!-- Loading -->
    <div v-if="status === 'pending'" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>

    <!-- Liste des emblèmes -->
    <div v-else-if="filteredEmblems.length > 0" class="space-y-4">
      <!-- Info pagination -->
      <div class="flex items-center justify-between text-sm text-muted">
        <span>{{ filteredEmblems.length }} emblème(s) trouvé(s)</span>
        <span v-if="totalPages > 1">Page {{ currentPage }} / {{ totalPages }}</span>
      </div>

      <div class="space-y-2">
        <div
          v-for="emblem in paginatedEmblems"
          :key="emblem.id"
          class="flex items-center gap-4 p-4 rounded-lg border border-muted/30 hover:bg-muted/10 cursor-pointer"
          @click="openEditModal(emblem)"
        >
        <img
          v-if="emblem.image"
          :src="emblem.image"
          :alt="emblem.name"
          class="w-12 h-12 rounded shrink-0"
        />
        <div v-else class="w-12 h-12 rounded bg-muted/30 flex items-center justify-center shrink-0">
          <UIcon name="i-lucide-image-off" class="w-6 h-6 text-muted" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="font-medium">{{ emblem.name }}</div>
          <div class="text-xs text-muted truncate">{{ emblem.description }}</div>
          <div class="text-xs text-muted mt-1">
            {{ emblem.faction_name }} / {{ emblem.campaign_name }}
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <!-- Status EN -->
          <UTooltip text="Anglais">
            <div
              class="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
              :class="[
                hasTranslation(emblem, 'en') ? 'bg-success/20 text-success' :
                hasPartialTranslation(emblem, 'en') ? 'bg-warning/20 text-warning' :
                'bg-muted/20 text-muted'
              ]"
            >
              EN
            </div>
          </UTooltip>
          <!-- Status ES -->
          <UTooltip text="Espagnol">
            <div
              class="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
              :class="[
                hasTranslation(emblem, 'es') ? 'bg-success/20 text-success' :
                hasPartialTranslation(emblem, 'es') ? 'bg-warning/20 text-warning' :
                'bg-muted/20 text-muted'
              ]"
            >
              ES
            </div>
          </UTooltip>
        </div>
      </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center mt-6">
        <UPagination
          v-model:page="currentPage"
          :total="filteredEmblems.length"
          :items-per-page="pageSize"
          show-edges
        />
      </div>
    </div>

    <div v-else class="text-center py-8 text-muted">
      <template v-if="searchQuery.trim()">
        Aucun accomplissement trouvé pour "{{ searchQuery }}"
      </template>
      <template v-else>
        Aucun accomplissement
      </template>
    </div>

    <!-- Modal édition -->
    <UModal v-model:open="isEditModalOpen" :ui="{ width: 'max-w-2xl' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <img
                v-if="editingEmblem?.image"
                :src="editingEmblem.image"
                :alt="editingEmblem?.name"
                class="w-10 h-10 rounded"
              />
              <div>
                <h2 class="text-lg font-semibold">{{ editingEmblem?.name }}</h2>
                <p class="text-sm text-muted">{{ editingEmblem?.faction_name }} / {{ editingEmblem?.campaign_name }}</p>
              </div>
            </div>
          </template>

          <div class="space-y-6">
            <!-- Texte original (FR) -->
            <div class="p-4 bg-muted/20 rounded-lg">
              <div class="text-sm font-medium text-muted mb-2">Français (original)</div>
              <div class="font-medium">{{ editingEmblem?.name }}</div>
              <div class="text-sm text-muted mt-1">{{ editingEmblem?.description }}</div>
            </div>

            <!-- Anglais -->
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">EN</div>
                <span class="font-medium">Anglais</span>
              </div>
              <div>
                <label class="text-sm text-muted mb-1 block">Nom</label>
                <UInput
                  v-model="editForm.en.name"
                  placeholder="Nom en anglais"
                  class="w-full"
                />
              </div>
              <div>
                <label class="text-sm text-muted mb-1 block">Description</label>
                <UTextarea
                  v-model="editForm.en.description"
                  placeholder="Description en anglais"
                  :rows="3"
                  class="w-full"
                />
              </div>
            </div>

            <!-- Espagnol -->
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">ES</div>
                <span class="font-medium">Espagnol</span>
              </div>
              <div>
                <label class="text-sm text-muted mb-1 block">Nom</label>
                <UInput
                  v-model="editForm.es.name"
                  placeholder="Nombre en español"
                  class="w-full"
                />
              </div>
              <div>
                <label class="text-sm text-muted mb-1 block">Description</label>
                <UTextarea
                  v-model="editForm.es.description"
                  placeholder="Descripción en español"
                  :rows="3"
                  class="w-full"
                />
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Annuler"
                color="neutral"
                variant="outline"
                @click="editingEmblem = null"
              />
              <UButton
                label="Sauvegarder"
                icon="i-lucide-save"
                :loading="isSaving"
                @click="saveTranslations"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal import automatique -->
    <UModal v-model:open="isImportModalOpen" :ui="{ width: 'max-w-3xl' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-primary/10">
                <UIcon name="i-lucide-upload" class="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 class="text-lg font-semibold">Import automatique des traductions</h2>
                <p class="text-sm text-muted">Comparer les JSONs pour pré-remplir les traductions</p>
              </div>
            </div>
          </template>

          <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
              <!-- Sélection de la langue cible -->
              <div>
                <label class="text-sm font-medium mb-2 block">Langue cible</label>
                <USelectMenu
                  v-model="targetLocale"
                  :items="[
                    { label: 'Anglais (EN)', value: 'en' },
                    { label: 'Espagnol (ES)', value: 'es' }
                  ]"
                  value-key="value"
                  class="w-full"
                />
              </div>

              <!-- Sélection des factions -->
              <div>
                <label class="text-sm font-medium mb-2 block">
                  Factions
                  <span class="text-muted font-normal">(toutes si vide)</span>
                </label>
                <USelectMenu
                  v-model="selectedFactions"
                  :items="availableFactions"
                  value-key="value"
                  multiple
                  placeholder="Toutes les factions"
                  class="w-full"
                />
              </div>
            </div>

            <!-- JSON Français -->
            <div>
              <label class="text-sm font-medium mb-2 block">JSON Français</label>
              <UTextarea
                v-model="frenchJson"
                placeholder="Collez ici le JSON exporté depuis Sea of Thieves en français..."
                :rows="6"
                class="w-full font-mono text-xs"
              />
            </div>

            <!-- JSON Langue cible -->
            <div>
              <label class="text-sm font-medium mb-2 block">
                JSON {{ targetLocale === 'en' ? 'Anglais' : 'Espagnol' }}
              </label>
              <UTextarea
                v-model="targetJson"
                :placeholder="`Collez ici le JSON exporté depuis Sea of Thieves en ${targetLocale === 'en' ? 'anglais' : 'espagnol'}...`"
                :rows="6"
                class="w-full font-mono text-xs"
              />
            </div>

            <div class="p-4 bg-info/10 rounded-lg text-sm">
              <div class="flex items-start gap-2">
                <UIcon name="i-lucide-info" class="w-5 h-5 text-info shrink-0 mt-0.5" />
                <div>
                  <p class="font-medium text-info">Comment ça marche ?</p>
                  <p class="text-muted mt-1">
                    L'outil utilise les <strong>images</strong> comme pont entre les deux JSONs :
                    BDD (nom FR) → JSON FR (image) → JSON cible (traduction).
                    Utilisez les JSONs d'un même joueur au même moment pour garantir les mêmes images.
                  </p>
                </div>
              </div>
            </div>
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
                label="Analyser"
                icon="i-lucide-search"
                :loading="isAnalyzing"
                @click="analyzeJsons"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal traduction en chaîne -->
    <UModal v-model:open="isChainMode" :ui="{ width: 'max-w-2xl' }">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <img
                  v-if="editingEmblem?.image"
                  :src="editingEmblem.image"
                  :alt="editingEmblem?.name"
                  class="w-10 h-10 rounded"
                />
                <div>
                  <h2 class="text-lg font-semibold">{{ editingEmblem?.name }}</h2>
                  <p class="text-sm text-muted">{{ editingEmblem?.faction_name }} / {{ editingEmblem?.campaign_name }}</p>
                </div>
              </div>
              <!-- Indicateur de progression -->
              <div class="text-sm text-muted bg-muted/20 px-3 py-1 rounded-full">
                {{ currentMatchIndex + 1 }} / {{ matchedTranslations.length }}
              </div>
            </div>
          </template>

          <div class="space-y-6">
            <!-- Texte original (FR) -->
            <div class="p-4 bg-muted/20 rounded-lg">
              <div class="text-sm font-medium text-muted mb-2">Français (original)</div>
              <div class="font-medium">{{ editingEmblem?.name }}</div>
              <div class="text-sm text-muted mt-1">{{ editingEmblem?.description }}</div>
            </div>

            <!-- Traduction cible uniquement -->
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {{ targetLocale.toUpperCase() }}
                </div>
                <span class="font-medium">{{ targetLocale === 'en' ? 'Anglais' : 'Espagnol' }}</span>
                <span class="text-xs text-success bg-success/10 px-2 py-0.5 rounded">Pré-rempli</span>
              </div>
              <div>
                <label class="text-sm text-muted mb-1 block">Nom</label>
                <UInput
                  v-model="editForm[targetLocale].name"
                  :placeholder="targetLocale === 'en' ? 'Nom en anglais' : 'Nombre en español'"
                  class="w-full"
                />
              </div>
              <div>
                <label class="text-sm text-muted mb-1 block">Description</label>
                <UTextarea
                  v-model="editForm[targetLocale].description"
                  :placeholder="targetLocale === 'en' ? 'Description en anglais' : 'Descripción en español'"
                  :rows="3"
                  class="w-full"
                />
              </div>
            </div>

            <!-- Barre de progression -->
            <div class="h-2 bg-muted/20 rounded-full overflow-hidden">
              <div
                class="h-full bg-primary transition-all duration-300"
                :style="{ width: `${((currentMatchIndex + 1) / matchedTranslations.length) * 100}%` }"
              />
            </div>

            <!-- Stats en cours -->
            <div class="flex items-center justify-center gap-6 text-sm">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-check" class="w-4 h-4 text-success" />
                <span>{{ chainStats.saved }} sauvegardée(s)</span>
              </div>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-skip-forward" class="w-4 h-4 text-muted" />
                <span>{{ chainStats.skipped }} ignorée(s)</span>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-between">
              <UButton
                label="Annuler l'import"
                color="neutral"
                variant="ghost"
                @click="cancelChainMode"
              />
              <div class="flex gap-2">
                <UButton
                  label="Passer"
                  icon="i-lucide-skip-forward"
                  color="neutral"
                  variant="outline"
                  :disabled="isSaving || isSavingAll"
                  @click="skipAndNext"
                />
                <UButton
                  :label="currentMatchIndex === matchedTranslations.length - 1 ? 'Valider et terminer' : 'Valider et suivant'"
                  icon="i-lucide-check"
                  :loading="isSaving"
                  :disabled="isSavingAll"
                  @click="saveAndNext"
                />
                <UButton
                  v-if="matchedTranslations.length - currentMatchIndex > 1"
                  :label="`Valider tous (${matchedTranslations.length - currentMatchIndex})`"
                  icon="i-lucide-check-check"
                  color="success"
                  :loading="isSavingAll"
                  :disabled="isSaving"
                  @click="saveAllRemaining"
                />
              </div>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
