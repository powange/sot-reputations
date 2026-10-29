<script setup lang="ts">
// Calendrier des éclipses. Le planning est calculé en UTC (shared/utils/eclipses.ts) et
// seulement converti pour l'affichage dans le fuseau choisi.
const { t, locale } = useI18n()

useSeoMeta({
  title: () => `${t('tools.eclipses.title')} - SoT Reputations`,
  description: () => t('tools.eclipses.description'),
  ogTitle: () => `${t('tools.eclipses.title')} - SoT Reputations`,
  ogDescription: () => t('tools.eclipses.description')
})

// Nombre de jours affichés dans le calendrier
const CALENDAR_DAYS = 3

// --- Horloge et fuseau : connus seulement côté client (pas de rendu serveur de l'heure) ---
const TZ_KEY = 'eclipses-timezone'
// Fuseau déjà choisi sur la page des feux d'artifice : repris par défaut
const FIREWORKS_TZ_KEY = 'fireworks-timezone'
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
    saved = localStorage.getItem(TZ_KEY) ?? localStorage.getItem(FIREWORKS_TZ_KEY)
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
const dateFmt = computed(() => new Intl.DateTimeFormat(locale.value, { timeZone: tz.value, weekday: 'long', day: 'numeric', month: 'long' }))
const formatTime = (time: number) => timeFmt.value.format(time)

// Durée lisible : « 2:05:09 » au-delà d'une heure, sinon « 5:09 »
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
// Durée approximative : « 9 h 51 » / « 12 min »
const approx = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

// --- Planning ---
const upcoming = computed(() => upcomingEclipses(now.value, 8))
const next = computed(() => upcoming.value[0]!)
const last = computed(() => lastEclipse(now.value))
// Début de la série suivante (si la prochaine éclipse n'ouvre pas déjà une série)
const nextSeries = computed(() => upcoming.value.find(e => e.order === 1 && e.series !== next.value.series))

const countdownMs = computed(() => Math.max(0, next.value.start - now.value))
// Lecteurs d'écran : annonce à la minute, pas chaque seconde
const countdownMinutes = computed(() => Math.max(1, Math.ceil(countdownMs.value / 60_000)))

// Calendrier : séries des prochains jours, regroupées par jour local (une série est
// rattachée au jour de sa première éclipse)
const calendar = computed(() => {
  const todayKey = dayKeyIn(tz.value, now.value)
  const eclipses = eclipsesBetween(now.value - 2 * 3_600_000, now.value + (CALENDAR_DAYS + 1) * 86_400_000)
  const series = new Map<number, Eclipse[]>()
  for (const e of eclipses) series.set(e.series, [...(series.get(e.series) ?? []), e])
  const days = new Map<string, { key: string, label: string, today: boolean, series: Eclipse[][] }>()
  for (const list of series.values()) {
    // Série déjà entamée avant la fenêtre : complétée par ses premières éclipses
    if (list[0]!.order !== 1) continue
    const key = dayKeyIn(tz.value, list[0]!.start)
    if (key < todayKey) continue
    if (!days.has(key)) days.set(key, { key, label: dateFmt.value.format(list[0]!.start), today: key === todayKey, series: [] })
    days.get(key)!.series.push(list)
  }
  return [...days.values()].slice(0, CALENDAR_DAYS)
})
const isPast = (e: Eclipse) => e.start <= now.value
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
        {{ $t('tools.eclipses.title') }}
      </h1>
      <p class="text-muted mt-2">
        {{ $t('tools.eclipses.intro') }}
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
      :aria-label="$t('tools.eclipses.loading')"
    >
      <USkeleton class="h-36" />
      <USkeleton class="h-36" />
      <USkeleton class="h-48 sm:col-span-2" />
    </div>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 mb-6">
        <!-- Prochaine éclipse + compte à rebours -->
        <UCard class="ring-2 ring-primary/50">
          <p class="text-xs uppercase tracking-wide text-muted">
            {{ $t('tools.eclipses.next') }}
          </p>
          <p class="mt-2 flex items-baseline gap-2">
            <span class="p-2 rounded-lg bg-primary/10 self-center">
              <UIcon
                name="i-lucide-moon"
                class="size-6 block text-primary"
              />
            </span>
            <span
              class="text-4xl font-bold tabular-nums"
              aria-hidden="true"
            >{{ clock(countdownMs) }}</span>
          </p>
          <p class="text-sm text-muted mt-2">
            {{ $t('tools.eclipses.at', { time: formatTime(next.start) }) }}
            · {{ $t('tools.eclipses.inSeries', { order: next.order }) }}
          </p>
          <p
            class="sr-only"
            aria-live="polite"
          >
            {{ $t('tools.eclipses.countdownAria', { minutes: countdownMinutes }) }}
          </p>
        </UCard>

        <!-- Dernière éclipse et série suivante -->
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">
            {{ $t('tools.eclipses.last') }}
          </p>
          <p class="mt-1 text-sm">
            <span class="font-semibold tabular-nums">{{ formatTime(last.start) }}</span>
            <span class="text-muted"> · {{ $t('tools.eclipses.ago', { time: approx(now - last.start) }) }}</span>
          </p>
          <template v-if="nextSeries">
            <p class="text-xs uppercase tracking-wide text-muted mt-4">
              {{ $t('tools.eclipses.nextSeries') }}
            </p>
            <p class="mt-1 text-sm">
              <span class="font-semibold tabular-nums">{{ formatTime(nextSeries.start) }}</span>
              <span class="text-muted"> · {{ $t('tools.eclipses.in', { time: approx(nextSeries.start - now) }) }}</span>
            </p>
          </template>
        </UCard>
      </div>

      <!-- Calendrier des prochains jours -->
      <UCard>
        <h2 class="font-semibold">
          {{ $t('tools.eclipses.calendar') }}
        </h2>
        <p class="text-sm text-muted mb-4">
          {{ $t('tools.eclipses.calendarHint', { days: CALENDAR_DAYS }) }}
        </p>
        <div class="space-y-5">
          <section
            v-for="day in calendar"
            :key="day.key"
          >
            <h3 class="text-sm font-medium mb-2 first-letter:uppercase">
              {{ day.label }}
              <UBadge
                v-if="day.today"
                :label="$t('tools.eclipses.today')"
                variant="subtle"
                size="sm"
                class="ml-1"
              />
            </h3>
            <div class="space-y-1.5">
              <div
                v-for="list in day.series"
                :key="list[0]!.series"
                class="flex flex-wrap items-center gap-1.5"
              >
                <span class="text-xs text-muted w-14 shrink-0">{{ $t('tools.eclipses.series') }}</span>
                <span
                  v-for="e in list"
                  :key="e.order"
                  :class="[
                    'w-16 py-0.5 rounded-md text-sm text-center tabular-nums',
                    e.start === next.start
                      ? 'font-bold ring-2 ring-primary bg-primary/10'
                      : isPast(e) ? 'text-dimmed' : 'bg-elevated'
                  ]"
                  :aria-current="e.start === next.start ? 'time' : undefined"
                >{{ formatTime(e.start) }}</span>
              </div>
            </div>
          </section>
        </div>
      </UCard>

      <p class="text-xs text-muted mt-4">
        {{ $t('tools.eclipses.rule') }}
      </p>
    </template>
  </UContainer>
</template>
