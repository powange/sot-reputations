// Planning des feux d'artifice des avant-postes (/tools/fireworks). Tout est calculé en UTC
// à partir d'un ancrage (un show connu : instant + avant-poste) : aucun horaire local en dur,
// les changements d'heure été/hiver sont donc gérés par la conversion d'affichage.
//
// Si le jeu décale le planning (redémarrage des serveurs, mise à jour), un admin redéfinit
// l'ancrage dans /admin/fireworks ; DEFAULT_FIREWORKS_ANCHOR n'est que la valeur par défaut.

// Ordre cyclique des avant-postes (l'index 0 est Port Merrick)
export const FIREWORKS_OUTPOSTS = [
  { key: 'portMerrick', name: 'Port Merrick' },
  { key: 'plunder', name: 'Plunder Outpost' },
  { key: 'ancientSpire', name: 'Ancient Spire Outpost' },
  { key: 'daggerTooth', name: 'Dagger Tooth Outpost' },
  { key: 'galleonsGrave', name: 'Galleon\'s Grave Outpost' },
  { key: 'sanctuary', name: 'Sanctuary Outpost' }
] as const

// Un show toutes les 24 min : chaque avant-poste revient toutes les 2 h 24 (144 min).
// 1440 = 10 × 144, le cycle se répète donc à l'identique chaque jour UTC (60 shows / jour).
export const FIREWORKS_INTERVAL_MINUTES = 24
export const FIREWORKS_INTERVAL_MS = FIREWORKS_INTERVAL_MINUTES * 60_000

// Durée d'un feu d'artifice (le reste du créneau de 24 min, il n'y a pas de feu).
// Valeur par défaut : modifiable dans /admin/fireworks.
export const DEFAULT_FIREWORKS_DURATION_MINUTES = 4
export const FIREWORKS_DURATION_LIMITS = { min: 1, max: FIREWORKS_INTERVAL_MINUTES }

export function isValidFireworksDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
    && value >= FIREWORKS_DURATION_LIMITS.min && value <= FIREWORKS_DURATION_LIMITS.max
}

// Le feu de ce show est-il encore en train d'être tiré à cet instant ?
export function isFireworksShowActive(show: FireworksShow, time: number, durationMinutes = DEFAULT_FIREWORKS_DURATION_MINUTES): boolean {
  return time >= show.start && time < show.start + durationMinutes * 60_000
}

export interface FireworksAnchor {
  // Instant (ms depuis l'epoch, UTC) d'un show connu
  at: number
  // Index dans FIREWORKS_OUTPOSTS de l'avant-poste de ce show
  outpost: number
}

// Ancrage par défaut : un show à 00:20 UTC à Sanctuary. Le jour importe peu (cycle quotidien).
export const DEFAULT_FIREWORKS_ANCHOR: FireworksAnchor = { at: Date.UTC(2026, 0, 1, 0, 20), outpost: 5 }

export interface FireworksShow {
  // Numéro du créneau relatif à l'ancrage (peut être négatif)
  slot: number
  // Index de l'avant-poste dans FIREWORKS_OUTPOSTS
  outpost: number
  // Début du show (ms UTC)
  start: number
}

// Modulo toujours positif
const mod = (n: number, m: number) => ((n % m) + m) % m

export function fireworksShowForSlot(slot: number, anchor: FireworksAnchor = DEFAULT_FIREWORKS_ANCHOR): FireworksShow {
  return {
    slot,
    outpost: mod(anchor.outpost + slot, FIREWORKS_OUTPOSTS.length),
    start: anchor.at + slot * FIREWORKS_INTERVAL_MS
  }
}

// Show en cours à l'instant donné : le dernier commencé
export function fireworksShowAt(time: number, anchor: FireworksAnchor = DEFAULT_FIREWORKS_ANCHOR): FireworksShow {
  return fireworksShowForSlot(Math.floor((time - anchor.at) / FIREWORKS_INTERVAL_MS), anchor)
}

// Les `count` shows qui suivent le show en cours
export function upcomingFireworksShows(time: number, count: number, anchor: FireworksAnchor = DEFAULT_FIREWORKS_ANCHOR): FireworksShow[] {
  const current = fireworksShowAt(time, anchor).slot
  return Array.from({ length: count }, (_, i) => fireworksShowForSlot(current + 1 + i, anchor))
}

// Tous les shows qui commencent dans [from, to)
export function fireworksShowsBetween(from: number, to: number, anchor: FireworksAnchor = DEFAULT_FIREWORKS_ANCHOR): FireworksShow[] {
  const first = Math.ceil((from - anchor.at) / FIREWORKS_INTERVAL_MS)
  const shows: FireworksShow[] = []
  for (let slot = first; ; slot++) {
    const show = fireworksShowForSlot(slot, anchor)
    if (show.start >= to) break
    shows.push(show)
  }
  return shows
}

export function isValidFireworksAnchor(value: unknown): value is FireworksAnchor {
  const a = value as FireworksAnchor
  return !!a && Number.isFinite(a.at) && Number.isInteger(a.outpost)
    && a.outpost >= 0 && a.outpost < FIREWORKS_OUTPOSTS.length
}
