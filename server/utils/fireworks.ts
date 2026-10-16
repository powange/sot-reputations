import {
  DEFAULT_FIREWORKS_ANCHOR,
  DEFAULT_FIREWORKS_DURATION_MINUTES,
  isValidFireworksAnchor,
  isValidFireworksDuration,
  type FireworksAnchor
} from '#shared/utils/fireworks'
import { deleteSetting, getSetting, setSetting } from './settings-db'

const ANCHOR_KEY = 'fireworks_anchor'
const DURATION_KEY = 'fireworks_duration_minutes'

export interface FireworksAnchorState {
  anchor: FireworksAnchor
  // true si un admin a redéfini l'ancrage (planning décalé par le jeu)
  custom: boolean
  updatedAt: string | null
  // Durée d'un feu d'artifice, en minutes (réglable dans l'admin)
  durationMinutes: number
}

export function getFireworksAnchor(): FireworksAnchorState {
  const stored = getSetting<FireworksAnchor>(ANCHOR_KEY)
  const duration = getSetting<number>(DURATION_KEY)
  const durationMinutes = duration && isValidFireworksDuration(duration.value) ? duration.value : DEFAULT_FIREWORKS_DURATION_MINUTES
  if (stored && isValidFireworksAnchor(stored.value)) {
    return { anchor: stored.value, custom: true, updatedAt: stored.updatedAt, durationMinutes }
  }
  return { anchor: DEFAULT_FIREWORKS_ANCHOR, custom: false, updatedAt: null, durationMinutes }
}

export function setFireworksAnchor(anchor: FireworksAnchor): void {
  setSetting(ANCHOR_KEY, { at: anchor.at, outpost: anchor.outpost })
}

export function resetFireworksAnchor(): void {
  deleteSetting(ANCHOR_KEY)
}

export function setFireworksDuration(minutes: number): void {
  setSetting(DURATION_KEY, minutes)
}
