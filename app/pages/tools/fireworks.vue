<script setup lang="ts">
// Horaires des feux d'artifice des avant-postes. Le planning est calculé en UTC
// (shared/utils/fireworks.ts) et seulement converti pour l'affichage dans le fuseau choisi.
const { t, locale } = useI18n()

useSeoMeta({
  title: () => `${t('tools.fireworks.title')} - SoT Reputations`,
  description: () => t('tools.fireworks.description'),
  ogTitle: () => `${t('tools.fireworks.title')} - SoT Reputations`,
  ogDescription: () => t('tools.fireworks.description')
})

// Ancrage du planning (redéfinissable par un admin si le jeu décale les horaires)
const { data: anchorState } = await useFetch<{ anchor: FireworksAnchor, custom: boolean, updatedAt: string | null }>('/api/fireworks-anchor', {
  key: 'fireworks-anchor'
})
const anchor = computed(() => anchorState.value?.anchor ?? DEFAULT_FIREWORKS_ANCHOR)

// Couleur distincte par avant-poste (même ordre que FIREWORKS_OUTPOSTS)
const OUTPOST_COLORS = [
  { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-500/50' },
  { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/50' },
  { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/50' },
  { text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10', ring: 'ring-sky-500/50' },
  { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/50' },
  { text: 'text-lime-600 dark:text-lime-400', bg: 'bg-lime-500/10', ring: 'ring-lime-500/50' }
]

// --- Horloge et fuseau : connus seulement côté client (pas de rendu serveur de l'heure) ---
const TZ_KEY = 'fireworks-timezone'
const ready = ref(false)
const now = ref(0)
const detectedTz = ref('UTC')
const tz = ref('UTC')
const tzOptions = ref<string[]>([])
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  detectedTz.value = detectTimeZone()
  let saved: string | null = null
  try {
    saved = localStorage.getItem(TZ_KEY)
  } catch {
    // Stockage indisponible (navigation privée…) : fuseau détecté
  }
  tz.value = isValidTimeZone(saved) ? saved : detectedTz.value
  tzOptions.value = listTimeZones()
  if (!tzOptions.value.includes(tz.value)) tzOptions.value.unshift(tz.value)
  now.value = Date.now()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  ready.value = true
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

watch(tz, (value) => {
  if (!ready.value) return
  try {
    if (value === detectedTz.value) localStorage.removeItem(TZ_KEY)
    else localStorage.setItem(TZ_KEY, value)
  } catch {
    // ignoré
  }
})

const offset = computed(() => timeZoneOffsetLabel(tz.value, now.value))
const timeFmt = computed(() => new Intl.DateTimeFormat(locale.value, { timeZone: tz.value, hour: '2-digit', minute: '2-digit' }))
const dateFmt = computed(() => new Intl.DateTimeFormat(locale.value, { timeZone: tz.value, weekday: 'short', day: 'numeric', month: 'short' }))
const formatTime = (time: number) => timeFmt.value.format(time)

// --- Planning ---
const current = computed(() => fireworksShowAt(now.value, anchor.value))
const upcoming = computed(() => upcomingFireworksShows(now.value, 7, anchor.value))
const next = computed(() => upcoming.value[0]!)
const later = computed(() => upcoming.value.slice(1))
const todayKey = computed(() => dayKeyIn(tz.value, now.value))

const countdownMs = computed(() => Math.max(0, next.value.start - now.value))
const countdown = computed(() => {
  const s = Math.ceil(countdownMs.value / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
// Lecteurs d'écran : annonce à la minute, pas chaque seconde
const countdownMinutes = computed(() => Math.max(1, Math.ceil(countdownMs.value / 60_000)))

// Planning du jour dans le fuseau choisi : shows dont le jour local est aujourd'hui
const daySchedule = computed(() => {
  const shows = fireworksShowsBetween(now.value - 30 * 3_600_000, now.value + 30 * 3_600_000, anchor.value)
    .filter(s => dayKeyIn(tz.value, s.start) === todayKey.value)
  return FIREWORKS_OUTPOSTS.map((outpost, index) => ({
    outpost,
    index,
    shows: shows.filter(s => s.outpost === index)
  }))
})

const outpostName = (index: number) => FIREWORKS_OUTPOSTS[index]!.name
const isOtherDay = (time: number) => dayKeyIn(tz.value, time) !== todayKey.value
</script>

<template>
  <UContainer class="py-8 max-w-5xl">
    <div class="mb-6">
      <UButton
        to="/tools"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('tools.title')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        {{ $t('tools.fireworks.title') }}
      </h1>
      <p class="text-muted mt-2">
        {{ $t('tools.fireworks.intro') }}
      </p>
    </div>

    <!-- Fuseau horaire -->
    <UCard class="mb-6">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1 flex items-center gap-2 text-sm">
          <UIcon
            name="i-lucide-globe"
            class="size-5 text-primary shrink-0"
          />
          <span v-if="ready">
            {{ $t('tools.fireworks.timezone.shown', { tz, offset: offset && offset !== tz ? `(${offset})` : '' }) }}
          </span>
          <USkeleton
            v-else
            class="h-4 w-56"
          />
        </div>
        <!-- Sélecteur rendu côté client seulement : il ne sert à rien avant que le fuseau
             du navigateur soit connu -->
        <ClientOnly>
          <template #fallback>
            <USkeleton class="h-8 w-full sm:w-64" />
          </template>
          <div class="flex flex-wrap gap-2">
            <USelectMenu
              v-model="tz"
              :items="tzOptions"
              :disabled="!ready"
              icon="i-lucide-search"
              :aria-label="$t('tools.fireworks.timezone.select')"
              :placeholder="$t('tools.fireworks.timezone.select')"
              class="w-full sm:w-64"
            />
            <UButton
              v-if="ready && tz !== detectedTz"
              icon="i-lucide-locate-fixed"
              variant="soft"
              color="neutral"
              :label="$t('tools.fireworks.timezone.reset', { tz: detectedTz })"
              @click="tz = detectedTz"
            />
          </div>
        </ClientOnly>
      </div>
    </UCard>

    <!-- Chargement : l'heure et le fuseau ne sont connus que dans le navigateur -->
    <div
      v-if="!ready"
      class="grid gap-4 sm:grid-cols-2"
      :aria-label="$t('tools.fireworks.loading')"
    >
      <USkeleton class="h-36" />
      <USkeleton class="h-36" />
      <USkeleton class="h-48 sm:col-span-2" />
    </div>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 mb-6">
        <!-- Avant-poste en cours -->
        <UCard :class="['ring-2', OUTPOST_COLORS[current.outpost]!.ring]">
          <p class="text-xs uppercase tracking-wide text-muted">
            {{ $t('tools.fireworks.current') }}
          </p>
          <p class="flex items-center gap-2 mt-2 text-xl font-semibold">
            <span :class="['p-2 rounded-lg', OUTPOST_COLORS[current.outpost]!.bg]">
              <UIcon
                name="i-lucide-sparkles"
                :class="['size-6 block', OUTPOST_COLORS[current.outpost]!.text]"
              />
            </span>
            {{ outpostName(current.outpost) }}
          </p>
          <p class="text-sm text-muted mt-2">
            {{ $t('tools.fireworks.startedAt', { time: formatTime(current.start) }) }}
          </p>
        </UCard>

        <!-- Prochain show + compte à rebours -->
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">
            {{ $t('tools.fireworks.next') }}
          </p>
          <p class="flex items-center gap-2 mt-2 text-xl font-semibold">
            <span :class="['p-2 rounded-lg', OUTPOST_COLORS[next.outpost]!.bg]">
              <UIcon
                name="i-lucide-sparkles"
                :class="['size-6 block', OUTPOST_COLORS[next.outpost]!.text]"
              />
            </span>
            {{ outpostName(next.outpost) }}
          </p>
          <p class="mt-2 flex items-baseline gap-2">
            <span
              class="text-3xl font-bold tabular-nums"
              aria-hidden="true"
            >{{ countdown }}</span>
            <span class="text-sm text-muted">{{ $t('tools.fireworks.at', { time: formatTime(next.start) }) }}</span>
          </p>
          <p
            class="sr-only"
            aria-live="polite"
          >
            {{ $t('tools.fireworks.countdownAria', { outpost: outpostName(next.outpost), minutes: countdownMinutes }) }}
          </p>
        </UCard>
      </div>

      <!-- Prochains shows -->
      <UCard class="mb-6">
        <h2 class="font-semibold mb-3">
          {{ $t('tools.fireworks.upcoming') }}
        </h2>
        <ul class="divide-y divide-default">
          <li
            v-for="show in later"
            :key="show.slot"
            class="flex items-center gap-3 py-2"
          >
            <UIcon
              name="i-lucide-map-pin"
              :class="['size-5 shrink-0', OUTPOST_COLORS[show.outpost]!.text]"
            />
            <span class="flex-1">{{ outpostName(show.outpost) }}</span>
            <span class="tabular-nums font-semibold">{{ formatTime(show.start) }}</span>
            <span
              v-if="isOtherDay(show.start)"
              class="text-xs text-muted w-24 text-right"
            >{{ dateFmt.format(show.start) }}</span>
          </li>
        </ul>
      </UCard>

      <!-- Planning du jour -->
      <UCard>
        <h2 class="font-semibold">
          {{ $t('tools.fireworks.schedule') }}
        </h2>
        <p class="text-sm text-muted mb-4">
          {{ $t('tools.fireworks.scheduleHint', { day: dateFmt.format(now) }) }}
        </p>
        <div class="space-y-3">
          <div
            v-for="row in daySchedule"
            :key="row.outpost.key"
            class="sm:flex sm:items-start gap-3"
          >
            <p class="flex items-center gap-2 font-medium sm:w-56 shrink-0 mb-1 sm:mb-0 sm:pt-1">
              <UIcon
                name="i-lucide-map-pin"
                :class="['size-4 shrink-0', OUTPOST_COLORS[row.index]!.text]"
              />
              {{ row.outpost.name }}
            </p>
            <ul class="flex flex-wrap gap-1.5">
              <li
                v-for="show in row.shows"
                :key="show.slot"
                :class="[
                  'px-2 py-0.5 rounded-md text-sm tabular-nums',
                  show.slot === current.slot
                    ? ['font-bold ring-2', OUTPOST_COLORS[row.index]!.ring, OUTPOST_COLORS[row.index]!.bg]
                    : show.start + FIREWORKS_INTERVAL_MS <= now ? 'text-dimmed' : 'bg-elevated'
                ]"
                :aria-current="show.slot === current.slot ? 'time' : undefined"
              >
                {{ formatTime(show.start) }}
              </li>
            </ul>
          </div>
        </div>
      </UCard>

      <p class="text-xs text-muted mt-4">
        {{ $t('tools.fireworks.rule') }}
        <template v-if="anchorState?.custom && anchorState.updatedAt">
          {{ $t('tools.fireworks.adjusted', { date: new Date(anchorState.updatedAt.replace(' ', 'T') + 'Z').toLocaleDateString(locale) }) }}
        </template>
      </p>
    </template>
  </UContainer>
</template>
