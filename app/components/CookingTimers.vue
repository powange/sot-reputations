<script setup lang="ts">
// Minuteurs de cuisson : un par aliment posé sur le feu. Les heures de départ sont
// gardées dans le navigateur, donc les minuteurs survivent à un rechargement.
const { t } = useI18n()

interface Timer {
  id: number
  food: CookingFood
  startedAt: number
}

type Stage = 'raw' | 'undercooked' | 'cooked' | 'burnt'

const STORAGE_KEY = 'cooking-timers'
const SOUND_KEY = 'cooking-timers-sound'
const MAX_TIMERS = 8

const FOOD_IMAGES: Record<CookingFood, string> = {
  fish: '/img/fish/splashtail-ruby.webp',
  trophy: '/img/fish/ancientscale-sapphire.webp',
  meat: '/img/fish/meat-pork.webp',
  monster: '/img/fish/meat-kraken.webp'
}

const timers = ref<Timer[]>([])
const now = ref(Date.now())
const soundOn = ref(true)
const notifPermission = ref<NotificationPermission | 'unsupported'>('unsupported')
// Étapes déjà signalées par minuteur, pour ne sonner qu'une fois
const alerted = new Map<number, Set<Stage>>()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers.value))
  } catch {
    // Stockage indisponible : les minuteurs restent en mémoire
  }
}

function elapsed(timer: Timer): number {
  return Math.max(0, (now.value - timer.startedAt) / 1000)
}

function stageOf(timer: Timer): Stage {
  const e = elapsed(timer)
  const times = COOKING_TIMES[timer.food]
  if (e >= times.burnt) return 'burnt'
  if (e >= times.cooked) return 'cooked'
  if (e >= times.undercooked) return 'undercooked'
  return 'raw'
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function statusText(timer: Timer): string {
  const e = elapsed(timer)
  const times = COOKING_TIMES[timer.food]
  if (e < times.cooked) return t('tools.fishing.cooking.timers.cookedIn', { time: formatDuration(times.cooked - e) })
  if (e < times.burnt) return t('tools.fishing.cooking.timers.burnsIn', { time: formatDuration(times.burnt - e) })
  return t('tools.fishing.cooking.timers.burntSince', { time: formatDuration(e - times.burnt) })
}

// Segments de la barre, en % de la durée jusqu'à « brûlé »
function segments(food: CookingFood) {
  const { undercooked, cooked, burnt } = COOKING_TIMES[food]
  return {
    raw: (undercooked / burnt) * 100,
    undercooked: ((cooked - undercooked) / burnt) * 100,
    cooked: ((burnt - cooked) / burnt) * 100
  }
}

function progress(timer: Timer): number {
  return Math.min(100, (elapsed(timer) / COOKING_TIMES[timer.food].burnt) * 100)
}

const STAGE_CLASSES: Record<Stage, string> = {
  raw: 'text-muted',
  undercooked: 'text-pink-600 dark:text-pink-400',
  cooked: 'text-success',
  burnt: 'text-error'
}

// --- Son (Web Audio, pas de fichier) ---
let audio: AudioContext | null = null

function unlockAudio() {
  // Les navigateurs n'autorisent le son qu'après un geste de l'utilisateur
  if (!audio && 'AudioContext' in window) audio = new AudioContext()
  if (audio?.state === 'suspended') audio.resume()
}

function beep(frequency: number, count: number, duration = 0.15) {
  if (!soundOn.value || !audio) return
  for (let i = 0; i < count; i++) {
    const start = audio.currentTime + i * (duration + 0.12)
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = frequency
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(start + duration)
  }
}

function notify(timer: Timer, stage: 'cooked' | 'burnt') {
  if (notifPermission.value !== 'granted') return
  const food = t(`tools.fishing.cooking.timers.food.${timer.food}`)
  try {
    new Notification(t(`tools.fishing.cooking.timers.notif.${stage}`, { food }), { icon: FOOD_IMAGES[timer.food], tag: `cooking-${timer.id}-${stage}` })
  } catch {
    // Certains navigateurs mobiles n'acceptent que les notifications via service worker
  }
}

function checkAlerts() {
  for (const timer of timers.value) {
    const stage = stageOf(timer)
    if (stage !== 'cooked' && stage !== 'burnt') continue
    const done = alerted.get(timer.id) ?? new Set<Stage>()
    if (done.has(stage)) continue
    done.add(stage)
    alerted.set(timer.id, done)
    if (stage === 'cooked') beep(880, 3)
    else beep(220, 2, 0.4)
    notify(timer, stage)
  }
}

async function enableNotifications() {
  unlockAudio()
  notifPermission.value = await Notification.requestPermission()
}

// --- Actions ---
function start(food: CookingFood) {
  unlockAudio()
  if (timers.value.length >= MAX_TIMERS) return
  timers.value.push({ id: Date.now() + Math.random(), food, startedAt: Date.now() })
  save()
}

function restart(timer: Timer) {
  unlockAudio()
  timer.startedAt = Date.now()
  alerted.delete(timer.id)
  save()
}

function remove(timer: Timer) {
  timers.value = timers.value.filter(x => x.id !== timer.id)
  alerted.delete(timer.id)
  save()
}

function clearAll() {
  timers.value = []
  alerted.clear()
  save()
}

function toggleSound() {
  unlockAudio()
  soundOn.value = !soundOn.value
  try {
    localStorage.setItem(SOUND_KEY, soundOn.value ? '1' : '0')
  } catch {
    // ignoré
  }
}

let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  try {
    timers.value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    soundOn.value = localStorage.getItem(SOUND_KEY) !== '0'
  } catch {
    timers.value = []
  }
  if ('Notification' in window) notifPermission.value = Notification.permission
  // Les étapes déjà passées avant le rechargement ne doivent pas resonner
  now.value = Date.now()
  for (const timer of timers.value) {
    const stage = stageOf(timer)
    if (stage === 'cooked') alerted.set(timer.id, new Set(['cooked']))
    if (stage === 'burnt') alerted.set(timer.id, new Set(['cooked', 'burnt']))
  }
  interval = setInterval(() => {
    now.value = Date.now()
    checkAlerts()
  }, 250)
})

onBeforeUnmount(() => {
  if (interval) clearInterval(interval)
  audio?.close()
})
</script>

<template>
  <UCard>
    <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
      <h3 class="font-semibold text-lg flex items-center gap-2">
        <UIcon
          name="i-lucide-timer"
          class="size-5 text-primary"
        />
        {{ $t('tools.fishing.cooking.timers.title') }}
      </h3>
      <div class="flex flex-wrap gap-1">
        <UButton
          v-if="notifPermission === 'default'"
          icon="i-lucide-bell"
          size="sm"
          variant="ghost"
          color="neutral"
          :label="$t('tools.fishing.cooking.timers.notifications')"
          @click="enableNotifications"
        />
        <UButton
          :icon="soundOn ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
          size="sm"
          variant="ghost"
          color="neutral"
          :aria-label="$t('tools.fishing.cooking.timers.sound')"
          :aria-pressed="soundOn"
          @click="toggleSound"
        />
      </div>
    </div>
    <p class="text-sm text-muted mb-4">
      {{ $t('tools.fishing.cooking.timers.intro') }}
    </p>

    <!-- Lancer un minuteur -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      <UButton
        v-for="food in COOKING_FOODS"
        :key="food"
        color="neutral"
        variant="outline"
        class="flex-col h-auto py-2 gap-1"
        :disabled="timers.length >= MAX_TIMERS"
        @click="start(food)"
      >
        <img
          :src="FOOD_IMAGES[food]"
          alt=""
          width="40"
          height="40"
          class="size-10"
        >
        <span class="font-semibold text-sm">{{ $t(`tools.fishing.cooking.timers.food.${food}`) }}</span>
        <span class="text-xs text-muted">{{ $t(`tools.fishing.cooking.timers.foodHint.${food}`) }}</span>
      </UButton>
    </div>

    <!-- Minuteurs en cours -->
    <ul
      v-if="timers.length"
      class="space-y-3"
    >
      <li
        v-for="timer in timers"
        :key="timer.id"
        class="rounded-lg border border-default p-3"
        :class="{ 'ring-2 ring-success': stageOf(timer) === 'cooked', 'ring-2 ring-error': stageOf(timer) === 'burnt' }"
      >
        <div class="flex items-center gap-3">
          <img
            :src="FOOD_IMAGES[timer.food]"
            alt=""
            width="36"
            height="36"
            class="size-9 shrink-0"
            :class="{ 'brightness-50': stageOf(timer) === 'burnt' }"
          >
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-baseline justify-between gap-x-2">
              <span class="font-semibold">{{ $t(`tools.fishing.cooking.timers.food.${timer.food}`) }}</span>
              <span
                class="text-sm font-semibold"
                :class="STAGE_CLASSES[stageOf(timer)]"
              >
                {{ $t(`tools.fishing.cooking.stage.${stageOf(timer)}`) }}
              </span>
            </div>
            <!-- Barre : cru → pas assez cuit → cuit → brûlé -->
            <div class="relative h-2.5 mt-1.5 rounded-full overflow-hidden flex bg-elevated">
              <div
                class="bg-neutral-300 dark:bg-neutral-600"
                :style="{ width: `${segments(timer.food).raw}%` }"
              />
              <div
                class="bg-pink-300 dark:bg-pink-700"
                :style="{ width: `${segments(timer.food).undercooked}%` }"
              />
              <div
                class="bg-green-400 dark:bg-green-600"
                :style="{ width: `${segments(timer.food).cooked}%` }"
              />
              <div
                class="absolute inset-y-0 left-0 bg-black/35 dark:bg-white/35"
                :style="{ width: `${progress(timer)}%` }"
              />
            </div>
            <p class="text-xs text-muted mt-1 tabular-nums">
              {{ statusText(timer) }}
            </p>
          </div>
          <UButton
            icon="i-lucide-rotate-ccw"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="$t('tools.fishing.cooking.timers.restart')"
            @click="restart(timer)"
          />
          <UButton
            icon="i-lucide-x"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="$t('tools.fishing.cooking.timers.remove')"
            @click="remove(timer)"
          />
        </div>
      </li>
    </ul>
    <p
      v-else
      class="text-sm text-muted text-center py-2"
    >
      {{ $t('tools.fishing.cooking.timers.empty') }}
    </p>

    <div
      v-if="timers.length > 1"
      class="flex justify-end mt-3"
    >
      <UButton
        icon="i-lucide-trash-2"
        size="sm"
        variant="ghost"
        color="neutral"
        :label="$t('tools.fishing.cooking.timers.clear')"
        @click="clearAll"
      />
    </div>
  </UCard>
</template>
