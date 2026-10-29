import {
  DEFAULT_ECLIPSE_DURATION_MINUTES,
  ECLIPSE_ANCHOR,
  eclipseAnchorFromObservation,
  isValidEclipseDuration,
  isValidEclipseObservation,
  type EclipseObservation
} from '#shared/utils/eclipses'
import { deleteSetting, getSetting, setSetting } from './settings-db'

const ANCHOR_KEY = 'eclipses_observation'
const DURATION_KEY = 'eclipses_duration_minutes'

export interface EclipseSettings {
  // Début de série (1re éclipse) servant d'ancrage au planning (ms UTC)
  anchor: number
  // Éclipse observée saisie par un admin (null = planning par défaut)
  observation: EclipseObservation | null
  updatedAt: string | null
  // Durée d'une éclipse en minutes (0 = inconnue)
  durationMinutes: number
}

export function getEclipseSettings(): EclipseSettings {
  const stored = getSetting<EclipseObservation>(ANCHOR_KEY)
  const duration = getSetting<number>(DURATION_KEY)
  const durationMinutes = duration && isValidEclipseDuration(duration.value) ? duration.value : DEFAULT_ECLIPSE_DURATION_MINUTES
  if (stored && isValidEclipseObservation(stored.value)) {
    return { anchor: eclipseAnchorFromObservation(stored.value), observation: stored.value, updatedAt: stored.updatedAt, durationMinutes }
  }
  return { anchor: ECLIPSE_ANCHOR, observation: null, updatedAt: null, durationMinutes }
}

export function setEclipseObservation(o: EclipseObservation): void {
  setSetting(ANCHOR_KEY, { at: o.at, order: o.order })
}

export function resetEclipseObservation(): void {
  deleteSetting(ANCHOR_KEY)
}

export function setEclipseDuration(minutes: number): void {
  setSetting(DURATION_KEY, minutes)
}
