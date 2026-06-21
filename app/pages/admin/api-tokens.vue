<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

const { isAdmin, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Jetons d\'API - Administration'
})

// Redirection si non admin (la gestion des jetons est réservée aux administrateurs)
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value) {
      saveRedirectUrl()
      navigateTo('/')
    } else if (!isAdmin.value) {
      navigateTo('/')
    }
  }
})

interface ApiToken {
  id: number
  name: string
  tokenPrefix: string
  createdBy: number | null
  createdByUsername: string | null
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

const { data: tokens, status, refresh } = await useFetch<ApiToken[]>('/api/admin/api-tokens')

// Création d'un jeton
const newTokenName = ref('')
const creating = ref(false)
// Jeton fraîchement créé (affiché une seule fois en clair)
const createdToken = ref<string | null>(null)
const createdTokenName = ref<string | null>(null)

async function createToken() {
  const name = newTokenName.value.trim()
  if (!name) {
    toast.add({ title: 'Le nom du jeton est requis', color: 'error' })
    return
  }
  creating.value = true
  try {
    const result = await $fetch<{ token: string, name: string }>('/api/admin/api-tokens', {
      method: 'POST',
      body: { name }
    })
    createdToken.value = result.token
    createdTokenName.value = result.name
    newTokenName.value = ''
    toast.add({ title: 'Jeton créé', color: 'success' })
    await refresh()
  } catch (err) {
    const message = (err as { data?: { message?: string } })?.data?.message || 'Impossible de créer le jeton'
    toast.add({ title: 'Erreur', description: message, color: 'error' })
  } finally {
    creating.value = false
  }
}

async function copyToken() {
  if (!createdToken.value) return
  try {
    await navigator.clipboard.writeText(createdToken.value)
    toast.add({ title: 'Jeton copié dans le presse-papiers', color: 'success' })
  } catch {
    toast.add({ title: 'Impossible de copier automatiquement', color: 'error' })
  }
}

function dismissCreatedToken() {
  createdToken.value = null
  createdTokenName.value = null
}

const actionId = ref<number | null>(null)

async function revokeToken(token: ApiToken) {
  if (!confirm(`Révoquer le jeton "${token.name}" ? Les agents qui l'utilisent perdront immédiatement l'accès.`)) return
  actionId.value = token.id
  try {
    await $fetch(`/api/admin/api-tokens/${token.id}`, { method: 'DELETE' })
    toast.add({ title: `Jeton "${token.name}" révoqué`, color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la révocation', color: 'error' })
  } finally {
    actionId.value = null
  }
}

async function deleteToken(token: ApiToken) {
  if (!confirm(`Supprimer définitivement le jeton "${token.name}" ?`)) return
  actionId.value = token.id
  try {
    await $fetch(`/api/admin/api-tokens/${token.id}?hard=true`, { method: 'DELETE' })
    toast.add({ title: `Jeton "${token.name}" supprimé`, color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
  } finally {
    actionId.value = null
  }
}

function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const columns: TableColumn<ApiToken>[] = [
  { accessorKey: 'name', header: 'Nom' },
  { accessorKey: 'tokenPrefix', header: 'Jeton' },
  { accessorKey: 'createdByUsername', header: 'Créé par' },
  { accessorKey: 'createdAt', header: 'Créé le' },
  { accessorKey: 'lastUsedAt', header: 'Dernière utilisation' },
  { id: 'status', header: 'Statut' },
  { id: 'actions', header: '' }
]

// Origine pour les exemples de documentation
const origin = computed(() => useRequestURL().origin)
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
        Jetons d'API
      </h1>
      <p class="text-muted mt-2">
        Générez des jetons d'accès pour les agents externes (IA). Chaque jeton donne un accès en
        lecture seule aux notes de version et aux recommandations.
      </p>
    </div>

    <!-- Jeton fraîchement créé : affiché une seule fois -->
    <UAlert
      v-if="createdToken"
      color="success"
      variant="subtle"
      icon="i-lucide-key-round"
      class="mb-6"
      :title="`Jeton « ${createdTokenName} » créé`"
    >
      <template #description>
        <p class="mb-2">
          Copiez ce jeton maintenant : pour des raisons de sécurité, il ne sera
          <strong>plus jamais affiché</strong>.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <code class="px-3 py-2 rounded bg-elevated text-sm break-all flex-1 min-w-0">{{ createdToken }}</code>
          <UButton
            icon="i-lucide-copy"
            size="sm"
            label="Copier"
            @click="copyToken"
          />
          <UButton
            icon="i-lucide-x"
            size="sm"
            color="neutral"
            variant="ghost"
            label="Fermer"
            @click="dismissCreatedToken"
          />
        </div>
      </template>
    </UAlert>

    <!-- Création -->
    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Créer un jeton
        </h2>
      </template>
      <form
        class="flex flex-wrap items-end gap-4"
        @submit.prevent="createToken"
      >
        <UFormField
          label="Nom du jeton"
          hint="Pour identifier l'agent (ex. « Agent IA SoT »)"
          class="flex-1 min-w-64"
        >
          <UInput
            v-model="newTokenName"
            placeholder="Nom de l'agent / usage"
            class="w-full"
            :maxlength="100"
          />
        </UFormField>
        <UButton
          type="submit"
          icon="i-lucide-plus"
          label="Générer le jeton"
          :loading="creating"
        />
      </form>
    </UCard>

    <!-- Liste -->
    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Jetons existants
        </h2>
      </template>

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
        v-else-if="tokens && tokens.length > 0"
        class="overflow-x-auto"
      >
        <UTable
          :data="tokens"
          :columns="columns"
          class="w-full"
        >
          <template #tokenPrefix-cell="{ row }">
            <code class="text-sm text-muted">{{ row.original.tokenPrefix }}…</code>
          </template>
          <template #createdByUsername-cell="{ row }">
            <span class="text-muted">{{ row.original.createdByUsername || '-' }}</span>
          </template>
          <template #createdAt-cell="{ row }">
            <span class="text-muted">{{ formatDate(row.original.createdAt) }}</span>
          </template>
          <template #lastUsedAt-cell="{ row }">
            <span class="text-muted">{{ formatDate(row.original.lastUsedAt) }}</span>
          </template>
          <template #status-cell="{ row }">
            <UBadge
              :color="row.original.revokedAt ? 'error' : 'success'"
              variant="subtle"
              size="sm"
            >
              {{ row.original.revokedAt ? 'Révoqué' : 'Actif' }}
            </UBadge>
          </template>
          <template #actions-cell="{ row }">
            <UButton
              v-if="!row.original.revokedAt"
              icon="i-lucide-ban"
              size="xs"
              variant="ghost"
              color="warning"
              label="Révoquer"
              :loading="actionId === row.original.id"
              @click="revokeToken(row.original)"
            />
            <UButton
              v-else
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              color="error"
              label="Supprimer"
              :loading="actionId === row.original.id"
              @click="deleteToken(row.original)"
            />
          </template>
        </UTable>
      </div>

      <div
        v-else
        class="text-center py-8 text-muted"
      >
        Aucun jeton pour le moment
      </div>
    </UCard>

    <!-- Documentation -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Utilisation
        </h2>
      </template>
      <div class="space-y-4 text-sm">
        <p>
          Authentifiez chaque requête, au choix, avec l'en-tête
          <code class="px-1.5 py-0.5 rounded bg-elevated">Authorization: Bearer &lt;jeton&gt;</code>
          (recommandé) ou le paramètre d'URL
          <code class="px-1.5 py-0.5 rounded bg-elevated">?token=&lt;jeton&gt;</code>.
        </p>
        <p class="text-warning">
          ⚠️ Le paramètre d'URL est plus pratique mais moins sûr : le jeton apparaît dans les
          journaux d'accès et l'historique du navigateur. Préférez l'en-tête quand c'est possible.
        </p>
        <div>
          <p class="font-medium mb-1">
            Notes de version (patch notes)
          </p>
          <code class="block px-3 py-2 rounded bg-elevated break-all">GET {{ origin }}/api/agent/release-notes</code>
        </div>
        <div>
          <p class="font-medium mb-1">
            Recommandations
          </p>
          <code class="block px-3 py-2 rounded bg-elevated break-all">GET {{ origin }}/api/agent/recommendations</code>
        </div>
        <div>
          <p class="font-medium mb-1">
            Catalogue du coffre
          </p>
          <code class="block px-3 py-2 rounded bg-elevated break-all">GET {{ origin }}/api/agent/chest-items</code>
        </div>
        <div>
          <p class="font-medium mb-1">
            Exemple (en-tête)
          </p>
          <code class="block px-3 py-2 rounded bg-elevated break-all whitespace-pre-wrap">curl -H "Authorization: Bearer &lt;jeton&gt;" {{ origin }}/api/agent/recommendations</code>
        </div>
        <div>
          <p class="font-medium mb-1">
            Exemple (URL)
          </p>
          <code class="block px-3 py-2 rounded bg-elevated break-all whitespace-pre-wrap">{{ origin }}/api/agent/recommendations?token=&lt;jeton&gt;</code>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
