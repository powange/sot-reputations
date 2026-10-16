import { deleteSetting, getSetting, setSetting } from './settings-db'

const ANCHOR_KEY = 'fireworks_anchor'

export interface FireworksAnchorState {
  anchor: FireworksAnchor
  // true si un admin a redéfini l'ancrage (planning décalé par le jeu)
  custom: boolean
  updatedAt: string | null
}

export function getFireworksAnchor(): FireworksAnchorState {
  const stored = getSetting<FireworksAnchor>(ANCHOR_KEY)
  if (stored && isValidFireworksAnchor(stored.value)) {
    return { anchor: stored.value, custom: true, updatedAt: stored.updatedAt }
  }
  return { anchor: DEFAULT_FIREWORKS_ANCHOR, custom: false, updatedAt: null }
}

export function setFireworksAnchor(anchor: FireworksAnchor): void {
  setSetting(ANCHOR_KEY, { at: anchor.at, outpost: anchor.outpost })
}

export function resetFireworksAnchor(): void {
  deleteSetting(ANCHOR_KEY)
}
