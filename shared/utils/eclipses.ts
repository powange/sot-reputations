// Planning des éclipses (/tools/eclipses). Règle établie par la communauté (aucune donnée
// officielle) : les éclipses arrivent par séries de 4, à +0, +24, +57 et +81 min du début de
// la série, et une nouvelle série commence toutes les 11 h 12 (672 min = 28 jours en jeu,
// une journée en jeu durant 24 min). Tout est calculé en UTC à partir d'une éclipse connue :
// les changements d'heure sont gérés par la conversion d'affichage.

// Début d'une série connue (1re éclipse) : 30/12/2024 03:32 UTC.
export const ECLIPSE_ANCHOR = Date.UTC(2024, 11, 30, 3, 32)
// Durée entre deux débuts de série.
export const ECLIPSE_SERIES_MINUTES = 672
export const ECLIPSE_SERIES_MS = ECLIPSE_SERIES_MINUTES * 60_000
// Décalage de chaque éclipse dans sa série (minutes) : écarts de 24, 33, 24 puis 591 min.
export const ECLIPSE_OFFSETS_MINUTES = [0, 24, 57, 81] as const

export interface Eclipse {
  // Numéro de la série relatif à l'ancrage (peut être négatif)
  series: number
  // Rang dans la série : 1 à 4
  order: number
  // Début de l'éclipse (ms UTC)
  start: number
}

export function eclipseSeriesStart(series: number): number {
  return ECLIPSE_ANCHOR + series * ECLIPSE_SERIES_MS
}

function seriesEclipses(series: number): Eclipse[] {
  const base = eclipseSeriesStart(series)
  return ECLIPSE_OFFSETS_MINUTES.map((offset, i) => ({ series, order: i + 1, start: base + offset * 60_000 }))
}

/** Toutes les éclipses qui commencent dans [from, to). */
export function eclipsesBetween(from: number, to: number): Eclipse[] {
  const out: Eclipse[] = []
  for (let series = Math.floor((from - ECLIPSE_ANCHOR) / ECLIPSE_SERIES_MS); eclipseSeriesStart(series) < to; series++) {
    for (const e of seriesEclipses(series)) {
      if (e.start >= from && e.start < to) out.push(e)
    }
  }
  return out
}

/** Les `count` prochaines éclipses qui commencent après `time` (strictement). */
export function upcomingEclipses(time: number, count: number): Eclipse[] {
  const out: Eclipse[] = []
  for (let series = Math.floor((time - ECLIPSE_ANCHOR) / ECLIPSE_SERIES_MS); out.length < count; series++) {
    for (const e of seriesEclipses(series)) {
      if (e.start > time && out.length < count) out.push(e)
    }
  }
  return out
}

/** Dernière éclipse commencée à `time` (ou à cet instant). */
export function lastEclipse(time: number): Eclipse {
  const series = Math.floor((time - ECLIPSE_ANCHOR) / ECLIPSE_SERIES_MS)
  return [...seriesEclipses(series - 1), ...seriesEclipses(series)].filter(e => e.start <= time).at(-1)!
}
