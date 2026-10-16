<script setup lang="ts">
// Recalage du planning des feux d'artifice : si le jeu décale les horaires (redémarrage des
// serveurs, mise à jour), on indique un show observé « tel avant-poste à telle heure ».
const { isAdmin, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Feux d\'artifice - Administration'
})

// Redirection si non admin
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

interface AnchorState {
  anchor: FireworksAnchor
  custom: boolean
  updatedAt: string | null
}

const { data: state, refresh } = await useFetch<AnchorState>('/api/fireworks-anchor', { key: 'admin-fireworks-anchor' })

const outpostOptions = FIREWORKS_OUTPOSTS.map((o, index) => ({ label: o.name, value: index }))

// Saisie dans l'heure locale du navigateur (input datetime-local), convertie en instant UTC
const outpost = ref(0)
const localDateTime = ref('')
const browserTz = ref('')

function toLocalInput(time: number): string {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const mounted = ref(false)

onMounted(() => {
  mounted.value = true
  browserTz.value = detectTimeZone()
  // Pré-rempli avec le show en cours selon le planning actuel
  const show = fireworksShowAt(Date.now(), state.value?.anchor ?? DEFAULT_FIREWORKS_ANCHOR)
  outpost.value = show.outpost
  localDateTime.value = toLocalInput(show.start)
})

const draftAnchor = computed<FireworksAnchor | null>(() => {
  const at = new Date(localDateTime.value).getTime()
  return Number.isFinite(at) ? { at, outpost: outpost.value } : null
})

const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const utcFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })

// Aperçu : les prochains shows avec l'ancrage saisi
const preview = computed(() => {
  // Uniquement après montage : l'heure courante n'existe pas au rendu serveur
  if (!draftAnchor.value || !mounted.value) return []
  const now = Date.now()
  return [fireworksShowAt(now, draftAnchor.value), ...upcomingFireworksShows(now, 5, draftAnchor.value)]
})

const saving = ref(false)

async function save() {
  if (!draftAnchor.value) return
  saving.value = true
  try {
    state.value = await $fetch<AnchorState>('/api/admin/fireworks-anchor', { method: 'PUT', body: draftAnchor.value })
    toast.add({ title: 'Planning recalé', color: 'success' })
  } catch {
    toast.add({ title: 'Échec de l\'enregistrement', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function reset() {
  if (!confirm('Revenir au planning par défaut (00:20 UTC à Sanctuary) ?')) return
  saving.value = true
  try {
    state.value = await $fetch<AnchorState>('/api/admin/fireworks-anchor', { method: 'DELETE' })
    toast.add({ title: 'Planning par défaut rétabli', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Échec de la réinitialisation', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl">
    <div class="mb-6">
      <UButton
        to="/admin"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Administration"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        Feux d'artifice
      </h1>
      <p class="text-muted mt-2">
        Si le jeu décale les horaires (redémarrage des serveurs, mise à jour), indiquez un feu
        d'artifice observé : le planning de la page
        <ULink
          to="/tools/fireworks"
          class="text-primary hover:underline"
        >Horaires des feux d'artifice</ULink>
        repart de là (un show toutes les 24 minutes, dans l'ordre des avant-postes).
      </p>
    </div>

    <UCard class="mb-6">
      <h2 class="font-semibold mb-2">
        Ancrage actuel
      </h2>
      <p
        v-if="state"
        class="text-sm"
      >
        <UBadge
          :color="state.custom ? 'warning' : 'neutral'"
          variant="subtle"
          :label="state.custom ? 'Recalé manuellement' : 'Par défaut'"
          class="mr-2"
        />
        {{ FIREWORKS_OUTPOSTS[state.anchor.outpost]?.name }} à
        <ClientOnly>{{ fmt.format(state.anchor.at) }}</ClientOnly>
        ({{ utcFmt.format(state.anchor.at) }} UTC)
        <span
          v-if="state.updatedAt"
          class="text-muted"
        >— modifié le {{ state.updatedAt }} UTC</span>
      </p>
    </UCard>

    <UCard>
      <h2 class="font-semibold mb-4">
        Recaler le planning
      </h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Avant-poste">
          <USelect
            v-model="outpost"
            :items="outpostOptions"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Heure du feu d'artifice"
          :help="browserTz ? `Heure de votre navigateur (${browserTz})` : undefined"
        >
          <UInput
            v-model="localDateTime"
            type="datetime-local"
            class="w-full"
          />
        </UFormField>
      </div>

      <div
        v-if="preview.length"
        class="mt-4"
      >
        <p class="text-sm font-medium mb-2">
          Aperçu avec ce réglage
        </p>
        <ul class="text-sm space-y-1">
          <li
            v-for="(show, i) in preview"
            :key="show.slot"
            class="flex gap-2"
          >
            <span class="w-20 text-muted">{{ i === 0 ? 'En cours' : 'Ensuite' }}</span>
            <span class="w-40 tabular-nums">{{ fmt.format(show.start) }}</span>
            <span>{{ FIREWORKS_OUTPOSTS[show.outpost]?.name }}</span>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap gap-2 mt-6">
        <UButton
          icon="i-lucide-save"
          label="Enregistrer"
          :loading="saving"
          :disabled="!draftAnchor"
          @click="save"
        />
        <UButton
          v-if="state?.custom"
          icon="i-lucide-rotate-ccw"
          variant="soft"
          color="neutral"
          label="Revenir au planning par défaut"
          :disabled="saving"
          @click="reset"
        />
      </div>
    </UCard>
  </UContainer>
</template>
