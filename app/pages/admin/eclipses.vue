<script setup lang="ts">
// Réglages du calendrier des éclipses : recalage du planning sur une éclipse observée (si le
// jeu décale les horaires) et durée d'une éclipse.
const { isAdmin, isAuthenticated, saveRedirectUrl } = useAuth()
const toast = useToast()

useSeoMeta({
  title: 'Éclipses - Administration'
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

interface Settings {
  anchor: number
  observation: EclipseObservation | null
  updatedAt: string | null
  durationMinutes: number
}

const { data: state, refresh } = await useFetch<Settings>('/api/eclipses-settings', { key: 'admin-eclipses-settings' })

const orderOptions = ECLIPSE_OFFSETS_MINUTES.map((_, i) => ({ label: `${i + 1}${i ? 'e' : 're'} éclipse de la série`, value: i + 1 }))

// Saisie dans l'heure locale du navigateur (input datetime-local), convertie en instant UTC
const order = ref(1)
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
  // Pré-rempli avec la dernière éclipse selon le planning actuel
  const last = lastEclipse(Date.now(), state.value?.anchor ?? ECLIPSE_ANCHOR)
  order.value = last.order
  localDateTime.value = toLocalInput(last.start)
})

const draft = computed<EclipseObservation | null>(() => {
  const at = new Date(localDateTime.value).getTime()
  return Number.isFinite(at) ? { at, order: order.value } : null
})

const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const utcFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })

// Aperçu : la dernière éclipse et les suivantes avec le recalage saisi
const preview = computed(() => {
  // Uniquement après montage : l'heure courante n'existe pas au rendu serveur
  if (!draft.value || !mounted.value) return []
  const anchor = eclipseAnchorFromObservation(draft.value)
  const now = Date.now()
  return [lastEclipse(now, anchor), ...upcomingEclipses(now, 6, anchor)]
})

const saving = ref(false)

// --- Durée d'une éclipse ---
const durationMinutes = ref(DEFAULT_ECLIPSE_DURATION_MINUTES)
watch(() => state.value?.durationMinutes, (value) => {
  if (value !== undefined) durationMinutes.value = value
}, { immediate: true })
const savingDuration = ref(false)

async function saveDuration() {
  savingDuration.value = true
  try {
    state.value = await $fetch<Settings>('/api/admin/eclipses/duration', { method: 'PUT', body: { minutes: durationMinutes.value } })
    toast.add({ title: 'Durée enregistrée', color: 'success' })
  } catch {
    toast.add({ title: 'Durée invalide ou échec de l\'enregistrement', color: 'error' })
  } finally {
    savingDuration.value = false
  }
}

async function save() {
  if (!draft.value) return
  saving.value = true
  try {
    state.value = await $fetch<Settings>('/api/admin/eclipses/anchor', { method: 'PUT', body: draft.value })
    toast.add({ title: 'Planning recalé', color: 'success' })
  } catch {
    toast.add({ title: 'Échec de l\'enregistrement', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function reset() {
  if (!confirm('Revenir au planning par défaut (série du 30/12/2024 à 03:32 UTC) ?')) return
  saving.value = true
  try {
    state.value = await $fetch<Settings>('/api/admin/eclipses/anchor', { method: 'DELETE' })
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
        Éclipses
      </h1>
      <p class="text-muted mt-2">
        Si le jeu décale les horaires, indiquez une éclipse observée : le calendrier de la page
        <ULink
          to="/tools/eclipses"
          class="text-primary hover:underline"
        >Calendrier des éclipses</ULink>
        repart de là (séries de 4 éclipses à +0, +24, +57 et +81 min, une série toutes les 11 h 12).
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
          :color="state.observation ? 'warning' : 'neutral'"
          variant="subtle"
          :label="state.observation ? 'Recalé manuellement' : 'Par défaut'"
          class="mr-2"
        />
        <template v-if="state.observation">
          {{ state.observation.order }}{{ state.observation.order > 1 ? 'e' : 're' }} éclipse d'une série à
          <ClientOnly>{{ fmt.format(state.observation.at) }}</ClientOnly>
          ({{ utcFmt.format(state.observation.at) }} UTC)
        </template>
        <template v-else>
          début de série à <ClientOnly>{{ fmt.format(state.anchor) }}</ClientOnly>
          ({{ utcFmt.format(state.anchor) }} UTC)
        </template>
        <span
          v-if="state.updatedAt"
          class="text-muted"
        >— modifié le {{ state.updatedAt }} UTC</span>
      </p>
    </UCard>

    <UCard class="mb-6">
      <h2 class="font-semibold mb-1">
        Durée d'une éclipse
      </h2>
      <p class="text-sm text-muted mb-4">
        Pendant cette durée, la page affiche l'éclipse « en cours ». 0 = durée inconnue : la page
        affiche seulement la dernière et la prochaine éclipse.
      </p>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField
          label="Durée (minutes)"
          :help="`De ${ECLIPSE_DURATION_LIMITS.min} à ${ECLIPSE_DURATION_LIMITS.max} min`"
        >
          <UInputNumber
            v-model="durationMinutes"
            :min="ECLIPSE_DURATION_LIMITS.min"
            :max="ECLIPSE_DURATION_LIMITS.max"
            class="w-36"
          />
        </UFormField>
        <UButton
          icon="i-lucide-save"
          label="Enregistrer la durée"
          :loading="savingDuration"
          :disabled="durationMinutes === state?.durationMinutes"
          @click="saveDuration"
        />
      </div>
    </UCard>

    <UCard>
      <h2 class="font-semibold mb-4">
        Recaler le planning
      </h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Éclipse observée">
          <USelect
            v-model="order"
            :items="orderOptions"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Heure de l'éclipse"
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
            v-for="(e, i) in preview"
            :key="e.start"
            class="flex gap-2"
          >
            <span class="w-20 text-muted">{{ i === 0 ? 'Dernière' : 'Ensuite' }}</span>
            <span class="w-40 tabular-nums">{{ fmt.format(e.start) }}</span>
            <span>{{ e.order }}/4</span>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap gap-2 mt-6">
        <UButton
          icon="i-lucide-save"
          label="Enregistrer"
          :loading="saving"
          :disabled="!draft"
          @click="save"
        />
        <UButton
          v-if="state?.observation"
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
