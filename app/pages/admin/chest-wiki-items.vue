<script setup lang="ts">
const { isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Items du wiki - Administration'
})

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

interface Cost { gold?: number, doubloons?: number, ancientCoins?: number }
interface Prereqs { commendations?: Array<{ name: string, grade: number | null }>, factionLevels?: Record<string, number>, legendary?: boolean, requires?: string }
interface WikiChestItem {
  id: number
  title: string
  category: string
  subcategory: string | null
  description: string | null
  image: string | null
  cost: Cost | null
  prerequisites: Prereqs | null
  published: boolean
  // Items officiels du même périmètre portant ce nom : > 0 = doublon probable.
  officialMatches: number
  officialDuplicates: Array<{ id: number, name: string, enName: string, image: string | null, owners: number }>
}

const { data: items, status, refresh } = await useFetch<WikiChestItem[]>('/api/admin/chest-wiki-items', { default: () => [] })

// Filtres : statut, périmètre (catégorie / sous-catégorie), recherche par titre.
const statusFilter = ref<'draft' | 'published' | 'all' | 'duplicates'>('draft')
const statusOptions = [
  { value: 'draft' as const, label: 'Non publiés' },
  { value: 'published' as const, label: 'Publiés' },
  { value: 'all' as const, label: 'Tous' },
  { value: 'duplicates' as const, label: 'Doublons probables' }
]
const duplicateCount = computed(() => items.value.filter(it => it.officialMatches > 0).length)
// 'all' plutôt que '' : un SelectItem ne peut pas avoir une valeur vide.
const scopeFilter = ref('all')
const search = ref('')

function scopeOf(it: WikiChestItem): string {
  return it.subcategory ? `${it.category} / ${it.subcategory}` : it.category
}

const scopeOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const it of items.value) counts.set(scopeOf(it), (counts.get(scopeOf(it)) ?? 0) + 1)
  return [
    { label: 'Tous les périmètres', value: 'all' },
    ...[...counts].map(([scope, n]) => ({ label: `${scope} (${n})`, value: scope }))
  ]
})

const draftCount = computed(() => items.value.filter(it => !it.published).length)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter(it =>
    (statusFilter.value === 'all'
      || (statusFilter.value === 'duplicates' ? it.officialMatches > 0 : it.published === (statusFilter.value === 'published')))
    && (scopeFilter.value === 'all' || scopeOf(it) === scopeFilter.value)
    && (!q || it.title.toLowerCase().includes(q))
  )
})

// Affichage par pages de 100 (un périmètre peut compter des centaines d'items).
const PAGE = 100
const shown = ref(PAGE)
watch([statusFilter, scopeFilter, search], () => {
  shown.value = PAGE
  selectedIds.value = new Set()
})
const visible = computed(() => filtered.value.slice(0, shown.value))

const selectedIds = ref<Set<number>>(new Set())
function toggle(id: number) {
  const set = new Set(selectedIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  selectedIds.value = set
}
const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(it => selectedIds.value.has(it.id)))
function toggleAll() {
  selectedIds.value = allSelected.value ? new Set() : new Set(filtered.value.map(it => it.id))
}

const acting = ref(false)

async function setPublished(published: boolean) {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  acting.value = true
  try {
    const res = await $fetch<{ updated: number }>('/api/admin/chest-wiki-items/publish', {
      method: 'POST',
      body: { ids, published }
    })
    toast.add({ title: `${res.updated} item(s) ${published ? 'publié(s)' : 'dépublié(s)'}`, color: 'success' })
    selectedIds.value = new Set()
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la mise à jour', color: 'error' })
  } finally {
    acting.value = false
  }
}

async function removeSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  if (!confirm(`Supprimer définitivement ${ids.length} item(s) créé(s) depuis le wiki ?`)) return
  acting.value = true
  try {
    const res = await $fetch<{ deleted: number }>('/api/admin/chest-wiki-items/delete', {
      method: 'POST',
      body: { ids }
    })
    toast.add({ title: `${res.deleted} item(s) supprimé(s)`, color: 'success' })
    selectedIds.value = new Set()
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
  } finally {
    acting.value = false
  }
}

function formatCost(cost: Cost | null): string {
  if (!cost) return ''
  const parts: string[] = []
  if (cost.gold != null) parts.push(`${cost.gold.toLocaleString('fr-FR')} or`)
  if (cost.doubloons != null) parts.push(`${cost.doubloons.toLocaleString('fr-FR')} doublons`)
  if (cost.ancientCoins != null) parts.push(`${cost.ancientCoins.toLocaleString('fr-FR')} pièces anciennes`)
  return parts.join(' · ')
}

function formatPrereqs(pr: Prereqs | null): string {
  if (!pr) return ''
  const parts: string[] = []
  for (const c of pr.commendations ?? []) parts.push(c.grade != null ? `${c.name} (grade ${c.grade})` : c.name)
  for (const [faction, level] of Object.entries(pr.factionLevels ?? {})) parts.push(`${faction} niv. ${level}`)
  if (pr.legendary) parts.push('Pirate Légendaire')
  if (pr.requires) parts.push(pr.requires)
  return parts.join(' · ')
}
</script>

<template>
  <UContainer class="py-8 max-w-5xl">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        Items du wiki
      </h1>
      <p class="text-muted mt-2">
        Objets du coffre créés depuis le wiki Sea of Thieves, absents des imports des joueurs
        (création depuis
        <NuxtLink
          to="/admin/chest-costs"
          class="underline"
        >Données wiki du coffre</NuxtLink>, section « Pages wiki sans item »).
        Non publiés, ils ne sont visibles que dans l'administration ; publiés, ils apparaissent
        dans le coffre et l'API, avec leur nom anglais et l'image du wiki. Quand un joueur importe
        l'objet, il est rattaché automatiquement à l'item officiel (nom français, image officielle).
      </p>
    </div>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.value === 'draft' ? `${opt.label} (${draftCount})` : opt.value === 'duplicates' ? `${opt.label} (${duplicateCount})` : opt.label"
            size="xs"
            :color="statusFilter === opt.value ? 'primary' : 'neutral'"
            :variant="statusFilter === opt.value ? 'solid' : 'outline'"
            @click="statusFilter = opt.value"
          />
          <USelect
            v-model="scopeFilter"
            :items="scopeOptions"
            size="xs"
            class="min-w-48"
          />
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Rechercher un titre"
            size="xs"
            class="min-w-48"
          />
        </div>
      </template>

      <div
        v-if="status === 'pending'"
        class="flex justify-center py-8"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-6 h-6 animate-spin text-primary"
        />
      </div>

      <p
        v-else-if="!filtered.length"
        class="text-center py-8 text-muted"
      >
        Aucun item du wiki pour ces filtres.
      </p>

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <UCheckbox
              :model-value="allSelected"
              @update:model-value="toggleAll"
            />
            Tout sélectionner ({{ filtered.length }})
          </label>
          <div class="flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-eye"
              :label="`Publier (${selectedIds.size})`"
              size="sm"
              color="success"
              :loading="acting"
              :disabled="selectedIds.size === 0 || acting"
              @click="setPublished(true)"
            />
            <UButton
              icon="i-lucide-eye-off"
              :label="`Dépublier (${selectedIds.size})`"
              size="sm"
              variant="soft"
              :disabled="selectedIds.size === 0 || acting"
              @click="setPublished(false)"
            />
            <UButton
              icon="i-lucide-trash-2"
              :label="`Supprimer (${selectedIds.size})`"
              size="sm"
              color="error"
              variant="soft"
              :disabled="selectedIds.size === 0 || acting"
              @click="removeSelected"
            />
          </div>
        </div>

        <ul class="divide-y divide-default">
          <li
            v-for="it in visible"
            :key="it.id"
            class="py-2"
          >
            <label class="flex items-start gap-3 cursor-pointer">
              <UCheckbox
                class="mt-1"
                :model-value="selectedIds.has(it.id)"
                @update:model-value="toggle(it.id)"
              />
              <ChestItemImage
                v-if="it.image"
                :src="it.image"
                :alt="it.title"
                :size="48"
                format="webp"
                loading="lazy"
                class="w-12 h-12 object-contain shrink-0 rounded bg-elevated"
              />
              <div
                v-else
                class="w-12 h-12 shrink-0 rounded bg-elevated"
              />
              <div class="min-w-0 flex-1 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">{{ it.title }}</span>
                  <UBadge
                    :color="it.published ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ it.published ? 'Publié' : 'Brouillon' }}
                  </UBadge>
                  <span class="text-xs text-muted">{{ scopeOf(it) }}</span>
                  <UBadge
                    v-if="it.officialMatches"
                    color="warning"
                    variant="subtle"
                    size="sm"
                    :title="`${it.officialMatches} item(s) officiel(s) du même périmètre portent ce nom (qualités de trophée, guillemets ignorés)`"
                  >
                    doublon probable ({{ it.officialMatches }} officiel{{ it.officialMatches > 1 ? 's' : '' }})
                  </UBadge>
                </div>
                <p
                  v-if="it.description"
                  class="text-xs text-muted line-clamp-2"
                >
                  {{ it.description }}
                </p>
                <p
                  v-if="formatCost(it.cost) || formatPrereqs(it.prerequisites)"
                  class="text-xs mt-0.5"
                >
                  {{ [formatCost(it.cost), formatPrereqs(it.prerequisites)].filter(Boolean).join(' — ') }}
                </p>
                <!-- Doublon probable : items officiels correspondants et leurs possesseurs -->
                <div
                  v-if="it.officialDuplicates.length"
                  class="mt-1.5 pl-2 border-l-2 border-warning/40 space-y-1"
                >
                  <p class="text-xs text-warning">
                    Déjà au catalogue en item{{ it.officialDuplicates.length > 1 ? 's' : '' }} officiel{{ it.officialDuplicates.length > 1 ? 's' : '' }} :
                  </p>
                  <div
                    v-for="d in it.officialDuplicates"
                    :key="d.id"
                    class="flex items-center gap-2 text-xs"
                  >
                    <ChestItemImage
                      v-if="d.image"
                      :src="d.image"
                      :alt="d.name"
                      :size="24"
                      format="webp"
                      loading="lazy"
                      class="w-6 h-6 object-contain shrink-0 rounded bg-elevated"
                    />
                    <span class="font-medium">{{ d.name }}</span>
                    <span
                      v-if="d.enName !== d.name"
                      class="text-muted"
                    >· {{ d.enName }}</span>
                    <UBadge
                      size="xs"
                      variant="subtle"
                      :color="d.owners ? 'success' : 'neutral'"
                    >
                      {{ d.owners }} joueur{{ d.owners > 1 ? 's' : '' }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </label>
          </li>
        </ul>

        <div
          v-if="filtered.length > shown"
          class="flex justify-center mt-4"
        >
          <UButton
            :label="`Afficher plus (${filtered.length - shown} restants)`"
            variant="soft"
            size="sm"
            @click="shown += PAGE"
          />
        </div>
      </template>
    </UCard>
  </UContainer>
</template>
