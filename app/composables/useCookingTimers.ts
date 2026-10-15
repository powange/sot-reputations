// Minuteurs de cuisson partagés entre le guide de pêche et les quêtes de Merrick.
// Les heures de départ sont gardées dans le navigateur : les minuteurs survivent à un
// rechargement et sont communs à toutes les pages de l'appareil (pas entre joueurs).

export interface CookingTimer {
  id: number
  food: CookingFood
  startedAt: number
  // Nom affiché (ex. « Nageoire d'abondance d'olive ») ; sinon le type d'aliment
  label?: string
  image?: string
  // Rattachement à un élément de la page (ex. merrick:<token>:<id ingrédient>)
  key?: string
}

export type CookingStage = 'raw' | 'undercooked' | 'cooked' | 'burnt'

const STORAGE_KEY = 'cooking-timers'
const SOUND_KEY = 'cooking-timers-sound'
export const MAX_COOKING_TIMERS = 8

export const COOKING_FOOD_IMAGES: Record<CookingFood, string> = {
  fish: '/img/fish/splashtail-ruby.webp',
  trophy: '/img/fish/ancientscale-sapphire.webp',
  meat: '/img/fish/meat-pork.webp',
  monster: '/img/fish/meat-kraken.webp'
}

export const COOKING_STAGE_CLASSES: Record<CookingStage, string> = {
  raw: 'text-muted',
  undercooked: 'text-pink-600 dark:text-pink-400',
  cooked: 'text-success',
  burnt: 'text-error'
}

// Type de cuisson d'un ingrédient de quête à livrer cuit (null s'il est demandé cru)
export function cookingFoodFor(i: Pick<MerrickIngredient, 'type' | 'key' | 'state'>): CookingFood | null {
  if (i.state !== 'cooked') return null
  if (i.type === 'fish') return 'fish'
  return i.key === 'kraken' || i.key === 'megalodon' ? 'monster' : 'meat'
}

// --- État unique côté client (partagé par tous les composants montés) ---
const timers = ref<CookingTimer[]>([])
const now = ref(Date.now())
const soundOn = ref(true)
const notifPermission = ref<NotificationPermission | 'unsupported'>('unsupported')
// Étapes déjà signalées par minuteur, pour ne sonner qu'une fois
const alerted = new Map<number, Set<CookingStage>>()
let audio: AudioContext | null = null
let interval: ReturnType<typeof setInterval> | null = null
let users = 0
let loaded = false

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers.value))
  } catch {
    // Stockage indisponible : les minuteurs restent en mémoire
  }
}

function elapsed(timer: CookingTimer): number {
  return Math.max(0, (now.value - timer.startedAt) / 1000)
}

function stageOf(timer: CookingTimer): CookingStage {
  const e = elapsed(timer)
  const times = COOKING_TIMES[timer.food]
  if (e >= times.burnt) return 'burnt'
  if (e >= times.cooked) return 'cooked'
  if (e >= times.undercooked) return 'undercooked'
  return 'raw'
}

// Avancement jusqu'à « brûlé », en %
function progress(timer: CookingTimer): number {
  return Math.min(100, (elapsed(timer) / COOKING_TIMES[timer.food].burnt) * 100)
}

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

function load() {
  if (loaded) return
  loaded = true
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
}

export function useCookingTimers() {
  const { t } = useI18n()

  function nameOf(timer: CookingTimer): string {
    return timer.label ?? t(`tools.fishing.cooking.timers.food.${timer.food}`)
  }

  function imageOf(timer: CookingTimer): string {
    return timer.image ?? COOKING_FOOD_IMAGES[timer.food]
  }

  function formatDuration(seconds: number): string {
    const s = Math.max(0, Math.ceil(seconds))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  function statusText(timer: CookingTimer): string {
    const e = elapsed(timer)
    const times = COOKING_TIMES[timer.food]
    if (e < times.cooked) return t('tools.fishing.cooking.timers.cookedIn', { time: formatDuration(times.cooked - e) })
    if (e < times.burnt) return t('tools.fishing.cooking.timers.burnsIn', { time: formatDuration(times.burnt - e) })
    return t('tools.fishing.cooking.timers.burntSince', { time: formatDuration(e - times.burnt) })
  }

  function notify(timer: CookingTimer, stage: 'cooked' | 'burnt') {
    if (notifPermission.value !== 'granted') return
    try {
      new Notification(t(`tools.fishing.cooking.timers.notif.${stage}`, { food: nameOf(timer) }), { icon: imageOf(timer), tag: `cooking-${timer.id}-${stage}` })
    } catch {
      // Certains navigateurs mobiles n'acceptent que les notifications via service worker
    }
  }

  function checkAlerts() {
    for (const timer of timers.value) {
      const stage = stageOf(timer)
      if (stage !== 'cooked' && stage !== 'burnt') continue
      const done = alerted.get(timer.id) ?? new Set<CookingStage>()
      if (done.has(stage)) continue
      done.add(stage)
      alerted.set(timer.id, done)
      if (stage === 'cooked') beep(880, 3)
      else beep(220, 2, 0.4)
      notify(timer, stage)
    }
  }

  // Un seul intervalle pour toute la page, quel que soit le nombre de composants
  onMounted(() => {
    load()
    users++
    if (!interval) {
      interval = setInterval(() => {
        now.value = Date.now()
        checkAlerts()
      }, 250)
    }
  })

  onBeforeUnmount(() => {
    users--
    if (users <= 0 && interval) {
      clearInterval(interval)
      interval = null
    }
  })

  function start(food: CookingFood, extra: Pick<CookingTimer, 'label' | 'image' | 'key'> = {}) {
    unlockAudio()
    if (timers.value.length >= MAX_COOKING_TIMERS) return
    now.value = Date.now()
    timers.value.push({ id: Date.now() + Math.random(), food, startedAt: Date.now(), ...extra })
    save()
  }

  function restart(timer: CookingTimer) {
    unlockAudio()
    now.value = Date.now()
    timer.startedAt = Date.now()
    alerted.delete(timer.id)
    save()
  }

  function remove(timer: CookingTimer) {
    timers.value = timers.value.filter(x => x.id !== timer.id)
    alerted.delete(timer.id)
    save()
  }

  function clearAll() {
    timers.value = []
    alerted.clear()
    save()
  }

  function timerFor(key: string): CookingTimer | undefined {
    return timers.value.find(x => x.key === key)
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

  async function enableNotifications() {
    unlockAudio()
    notifPermission.value = await Notification.requestPermission()
  }

  return {
    timers,
    soundOn,
    notifPermission,
    stageOf,
    progress,
    statusText,
    nameOf,
    imageOf,
    start,
    restart,
    remove,
    clearAll,
    timerFor,
    toggleSound,
    enableNotifications
  }
}
