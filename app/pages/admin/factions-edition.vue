<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()
const { importFactionMottos } = useFactionTranslationsImport()

useSeoMeta({
  title: 'Éditer les factions - Administration'
})

// Redirection si non admin/modérateur
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value) {
      saveRedirectUrl()
      navigateTo('/')
    } else if (!isAdminOrModerator.value) {
      navigateTo('/')
    }
  }
})

interface FactionTranslation {
  name: string | null
  motto: string | null
}

interface Faction {
  id: number
  key: string
  name: string
  motto: string | null
  campaignCount: number
  translations: Record<string, FactionTranslation>
}

const { data: factions, status, refresh } = await useFetch<Faction[]>('/api/admin/factions-edition')

// --- Formulaire de création / édition ---
const modalOpen = ref(false)
const isNew = ref(false)
const saving = ref(false)

const form = reactive({
  id: null as number | null,
  key: '',
  name: '',
  motto: '',
  en: { name: '', motto: '' },
  es: { name: '', motto: '' }
})

function resetForm() {
  form.id = null
  form.key = ''
  form.name = ''
  form.motto = ''
  form.en = { name: '', motto: '' }
  form.es = { name: '', motto: '' }
}

function openCreate() {
  resetForm()
  isNew.value = true
  modalOpen.value = true
}

async function openEdit(faction: Faction) {
  // Rafraîchir d'abord : éviter d'éditer (et de réécraser) des traductions
  // périmées si un import a eu lieu depuis le chargement de la page.
  await refresh()
  const fresh = factions.value?.find(f => f.id === faction.id) || faction
  form.id = fresh.id
  form.key = fresh.key
  form.name = fresh.name
  form.motto = fresh.motto || ''
  form.en = {
    name: fresh.translations.en?.name || '',
    motto: fresh.translations.en?.motto || ''
  }
  form.es = {
    name: fresh.translations.es?.name || '',
    motto: fresh.translations.es?.motto || ''
  }
  isNew.value = false
  modalOpen.value = true
}

function buildTranslations() {
  return [
    { locale: 'en', name: form.en.name, motto: form.en.motto },
    { locale: 'es', name: form.es.name, motto: form.es.motto }
  ]
}

async function save() {
  if (!form.name.trim()) {
    toast.add({ title: 'Le nom (français) est requis', color: 'error' })
    return
  }
  if (isNew.value && !form.key.trim()) {
    toast.add({ title: 'La clé est requise', color: 'error' })
    return
  }

  saving.value = true
  try {
    if (isNew.value) {
      await $fetch('/api/admin/factions-edition', {
        method: 'POST',
        body: {
          key: form.key.trim(),
          name: form.name.trim(),
          motto: form.motto.trim() || null,
          translations: buildTranslations()
        }
      })
      toast.add({ title: 'Faction créée', color: 'success' })
    } else {
      await $fetch(`/api/admin/factions-edition/${form.id}`, {
        method: 'PUT',
        body: {
          name: form.name.trim(),
          motto: form.motto.trim() || null,
          translations: buildTranslations()
        }
      })
      toast.add({ title: 'Faction mise à jour', color: 'success' })
    }
    modalOpen.value = false
    await refresh()
  } catch (err) {
    const message = (err as { data?: { message?: string } })?.data?.message || 'Échec de l\'enregistrement'
    toast.add({ title: 'Erreur', description: message, color: 'error' })
  } finally {
    saving.value = false
  }
}

const deletingId = ref<number | null>(null)

async function deleteFaction(faction: Faction) {
  if (!confirm(`Supprimer la faction "${faction.name}" ? Cette action est irréversible.`)) return
  deletingId.value = faction.id
  try {
    await $fetch(`/api/admin/factions-edition/${faction.id}`, { method: 'DELETE' })
    toast.add({ title: `Faction "${faction.name}" supprimée`, color: 'success' })
    await refresh()
  } catch (err) {
    const message = (err as { data?: { message?: string } })?.data?.message || 'Échec de la suppression'
    toast.add({ title: 'Erreur', description: message, color: 'error' })
  } finally {
    deletingId.value = null
  }
}

// Une traduction de faction = nom + devise. 'full' si les deux sont présents,
// 'partial' si un seul (ex. motto auto-importé sans nom), 'none' sinon.
function translationBadge(faction: Faction, locale: string): {
  color: 'success' | 'warning' | 'neutral'
  variant: 'subtle' | 'outline'
  symbol: string
  title: string
} {
  const t = faction.translations[locale]
  if (t?.name && t?.motto) {
    return { color: 'success', variant: 'subtle', symbol: '✓', title: 'Nom et devise traduits' }
  }
  if (t?.name || t?.motto) {
    return { color: 'warning', variant: 'subtle', symbol: '~', title: 'Traduction partielle (nom ou devise manquant)' }
  }
  return { color: 'neutral', variant: 'outline', symbol: '—', title: 'Aucune traduction' }
}

// --- Import des mottos traduits depuis les données de réputation officielles ---
const importModalOpen = ref(false)
const importing = ref(false)
const importJson = reactive({ fr: '', en: '', es: '' })

function openImportMottos() {
  importJson.fr = ''
  importJson.en = ''
  importJson.es = ''
  importModalOpen.value = true
}

async function importMottos() {
  const body: Record<string, unknown> = {}
  try {
    if (importJson.fr.trim()) body.fr = JSON.parse(importJson.fr)
    if (importJson.en.trim()) body.en = JSON.parse(importJson.en)
    if (importJson.es.trim()) body.es = JSON.parse(importJson.es)
  } catch {
    toast.add({ title: 'JSON invalide', description: 'Vérifiez le format des données collées', color: 'error' })
    return
  }

  // Chaque langue fournie doit être un objet de réputation (factions par clé),
  // non vide et pas un tableau.
  const isValidPayload = (v: unknown): boolean =>
    !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length > 0
  for (const loc of ['fr', 'en', 'es'] as const) {
    if (body[loc] !== undefined && !isValidPayload(body[loc])) {
      toast.add({
        title: 'Données invalides',
        description: `Le JSON ${loc.toUpperCase()} doit être un objet de réputation (factions indexées par clé).`,
        color: 'error'
      })
      return
    }
  }
  if (!body.fr && !body.en && !body.es) {
    toast.add({ title: 'Aucune donnée', description: 'Collez au moins une langue (FR, EN ou ES)', color: 'error' })
    return
  }

  importing.value = true
  try {
    const res = await importFactionMottos(body)
    toast.add({
      title: 'Import terminé',
      description: `FR : ${res.updatedFr} · EN : ${res.updatedEn} · ES : ${res.updatedEs}`,
      color: 'success'
    })
    importModalOpen.value = false
    await refresh()
  } catch (err) {
    const message = (err as { data?: { message?: string } })?.data?.message || 'Échec de l\'import'
    toast.add({ title: 'Erreur', description: message, color: 'error' })
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-4xl font-pirate">
            Éditer les factions
          </h1>
          <p class="text-muted mt-2">
            Modifier le nom et la devise des factions, en ajouter, et gérer leurs traductions (EN / ES).
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UButton
            icon="i-lucide-languages"
            label="Importer les mottos"
            color="neutral"
            variant="outline"
            @click="openImportMottos"
          />
          <UButton
            icon="i-lucide-plus"
            label="Ajouter une faction"
            @click="openCreate"
          />
        </div>
      </div>
    </div>

    <div
      v-if="status === 'pending'"
      class="flex justify-center py-8"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-muted"
      />
    </div>

    <div
      v-else-if="factions && factions.length > 0"
      class="space-y-3"
    >
      <UCard
        v-for="faction in factions"
        :key="faction.id"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-semibold">
                {{ faction.name }}
              </h3>
              <UBadge
                color="neutral"
                size="xs"
              >
                {{ faction.key }}
              </UBadge>
            </div>
            <p
              v-if="faction.motto"
              class="text-sm text-muted italic"
            >
              {{ faction.motto }}
            </p>
            <div class="flex items-center gap-1.5 mt-2">
              <UBadge
                :color="translationBadge(faction, 'en').color"
                :variant="translationBadge(faction, 'en').variant"
                :title="translationBadge(faction, 'en').title"
                size="xs"
              >
                EN {{ translationBadge(faction, 'en').symbol }}
              </UBadge>
              <UBadge
                :color="translationBadge(faction, 'es').color"
                :variant="translationBadge(faction, 'es').variant"
                :title="translationBadge(faction, 'es').title"
                size="xs"
              >
                ES {{ translationBadge(faction, 'es').symbol }}
              </UBadge>
              <span class="text-xs text-muted ml-2">
                {{ faction.campaignCount }} campagne{{ faction.campaignCount > 1 ? 's' : '' }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="openEdit(faction)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              color="error"
              :disabled="faction.campaignCount > 0"
              :title="faction.campaignCount > 0 ? 'Faction non vide : suppression impossible' : 'Supprimer'"
              :loading="deletingId === faction.id"
              @click="deleteFaction(faction)"
            />
          </div>
        </div>
      </UCard>
    </div>

    <div
      v-else
      class="text-center py-8 text-muted"
    >
      Aucune faction
    </div>

    <!-- Modal création / édition -->
    <UModal v-model:open="modalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              {{ isNew ? 'Ajouter une faction' : 'Éditer la faction' }}
            </h2>
          </template>

          <form
            class="space-y-5"
            @submit.prevent="save"
          >
            <!-- Base (français) -->
            <div class="space-y-3">
              <p class="text-sm font-medium text-muted">
                Français (base)
              </p>
              <UFormField
                label="Clé"
                :hint="isNew ? 'Identifiant technique, ex. GoldHoarders' : 'Non modifiable'"
              >
                <UInput
                  v-model="form.key"
                  :disabled="!isNew"
                  placeholder="GoldHoarders"
                  class="w-full"
                  :maxlength="100"
                />
              </UFormField>
              <UFormField label="Nom">
                <UInput
                  v-model="form.name"
                  placeholder="Collectionneurs d'or"
                  class="w-full"
                  :maxlength="200"
                />
              </UFormField>
              <UFormField label="Devise">
                <UInput
                  v-model="form.motto"
                  placeholder="Devise de la faction"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- English -->
            <div class="space-y-3 border-t border-muted/30 pt-4">
              <p class="text-sm font-medium text-muted">
                English (EN)
              </p>
              <UFormField label="Name">
                <UInput
                  v-model="form.en.name"
                  placeholder="Gold Hoarders"
                  class="w-full"
                  :maxlength="200"
                />
              </UFormField>
              <UFormField label="Motto">
                <UInput
                  v-model="form.en.motto"
                  placeholder="Faction motto"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- Español -->
            <div class="space-y-3 border-t border-muted/30 pt-4">
              <p class="text-sm font-medium text-muted">
                Español (ES)
              </p>
              <UFormField label="Nombre">
                <UInput
                  v-model="form.es.name"
                  placeholder="Acaparadores de Oro"
                  class="w-full"
                  :maxlength="200"
                />
              </UFormField>
              <UFormField label="Lema">
                <UInput
                  v-model="form.es.motto"
                  placeholder="Lema de la facción"
                  class="w-full"
                />
              </UFormField>
            </div>
          </form>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                label="Annuler"
                @click="modalOpen = false"
              />
              <UButton
                :label="isNew ? 'Créer' : 'Enregistrer'"
                :loading="saving"
                @click="save"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal import des mottos traduits -->
    <UModal v-model:open="importModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Importer les mottos traduits
            </h2>
          </template>

          <div class="space-y-4">
            <div class="p-3 bg-info/10 rounded-lg text-sm flex items-start gap-2">
              <UIcon
                name="i-lucide-info"
                class="w-5 h-5 text-info shrink-0 mt-0.5"
              />
              <p class="text-muted">
                Collez les données de réputation officielles (<code class="text-xs">/api/profilev2/reputation</code>)
                récupérées par langue. Le motto FR de base est rafraîchi et les mottos EN/ES sont enregistrés en
                traduction. Le <strong>nom</strong> des factions n'est pas modifié (il reste manuel). Astuce : le
                bookmarklet de la page <NuxtLink
                  to="/admin/traductions"
                  class="text-primary underline"
                >Traductions</NuxtLink> le fait automatiquement.
              </p>
            </div>

            <UFormField label="JSON Français (/fr)">
              <UTextarea
                v-model="importJson.fr"
                placeholder="Collez ici le JSON /fr/api/profilev2/reputation…"
                :rows="3"
                class="w-full font-mono text-xs"
              />
            </UFormField>
            <UFormField label="JSON Anglais (/en)">
              <UTextarea
                v-model="importJson.en"
                placeholder="Collez ici le JSON /api/profilev2/reputation (EN)…"
                :rows="3"
                class="w-full font-mono text-xs"
              />
            </UFormField>
            <UFormField label="JSON Espagnol (/es)">
              <UTextarea
                v-model="importJson.es"
                placeholder="Collez ici le JSON /es/api/profilev2/reputation…"
                :rows="3"
                class="w-full font-mono text-xs"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                label="Annuler"
                @click="importModalOpen = false"
              />
              <UButton
                icon="i-lucide-download"
                label="Importer les mottos"
                :loading="importing"
                @click="importMottos"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
