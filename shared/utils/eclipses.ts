// Planning des éclipses (/tools/eclipses). Règle établie par la communauté (aucune donnée
// officielle) : les éclipses arrivent par séries de 4, à +0, +24, +57 et +81 min du début de
// la série, et une nouvelle série commence toutes les 11 h 12 (672 min = 28 jours en jeu,
// une journée en jeu durant 24 min). Tout est calculé en UTC à partir d'une éclipse connue :
// les changements d'heure sont gérés par la conversion d'affichage.
//
// Si le jeu décale le planning, un admin le recale dans /admin/eclipses (éclipse observée) ;
// `anchor` désigne toujours le début (1re éclipse) d'une série.

// Début d'une série connue par défaut (1re éclipse) : 30/12/2024 03:32 UTC.
export const ECLIPSE_ANCHOR = Date.UTC(2024, 11, 30, 3, 32)
// Durée entre deux débuts de série.
export const ECLIPSE_SERIES_MINUTES = 672
export const ECLIPSE_SERIES_MS = ECLIPSE_SERIES_MINUTES * 60_000
// Décalage de chaque éclipse dans sa série (minutes) : écarts de 24, 33, 24 puis 591 min.
export const ECLIPSE_OFFSETS_MINUTES = [0, 24, 57, 81] as const

// Durée d'une éclipse (minutes) : 0 = inconnue (la page n'affiche alors pas d'éclipse « en
// cours »). Au plus 23 min : deux éclipses d'une série sont espacées d'au moins 24 min.
export const DEFAULT_ECLIPSE_DURATION_MINUTES = 0
export const ECLIPSE_DURATION_LIMITS = { min: 0, max: 23 }

export function isValidEclipseDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
    && value >= ECLIPSE_DURATION_LIMITS.min && value <= ECLIPSE_DURATION_LIMITS.max
}

// Éclipse observée (recalage) : son instant et son rang (1 à 4) dans la série.
export interface EclipseObservation { at: number, order: number }

export function isValidEclipseObservation(value: unknown): value is EclipseObservation {
  const o = value as EclipseObservation
  return !!o && Number.isFinite(o.at) && Number.isInteger(o.order) && o.order >= 1 && o.order <= ECLIPSE_OFFSETS_MINUTES.length
}

/** Début de série (ancrage) correspondant à une éclipse observée. */
export function eclipseAnchorFromObservation(o: EclipseObservation): number {
  return o.at - ECLIPSE_OFFSETS_MINUTES[o.order - 1]! * 60_000
}

export interface Eclipse {
  // Numéro de la série relatif à l'ancrage (peut être négatif)
  series: number
  // Rang dans la série : 1 à 4
  order: number
  // Début de l'éclipse (ms UTC)
  start: number
}

export function eclipseSeriesStart(series: number, anchor = ECLIPSE_ANCHOR): number {
  return anchor + series * ECLIPSE_SERIES_MS
}

function seriesEclipses(series: number, anchor: number): Eclipse[] {
  const base = eclipseSeriesStart(series, anchor)
  return ECLIPSE_OFFSETS_MINUTES.map((offset, i) => ({ series, order: i + 1, start: base + offset * 60_000 }))
}

/** Toutes les éclipses qui commencent dans [from, to). */
export function eclipsesBetween(from: number, to: number, anchor = ECLIPSE_ANCHOR): Eclipse[] {
  const out: Eclipse[] = []
  for (let series = Math.floor((from - anchor) / ECLIPSE_SERIES_MS); eclipseSeriesStart(series, anchor) < to; series++) {
    for (const e of seriesEclipses(series, anchor)) {
      if (e.start >= from && e.start < to) out.push(e)
    }
  }
  return out
}

/** Les `count` prochaines éclipses qui commencent après `time` (strictement). */
export function upcomingEclipses(time: number, count: number, anchor = ECLIPSE_ANCHOR): Eclipse[] {
  const out: Eclipse[] = []
  for (let series = Math.floor((time - anchor) / ECLIPSE_SERIES_MS); out.length < count; series++) {
    for (const e of seriesEclipses(series, anchor)) {
      if (e.start > time && out.length < count) out.push(e)
    }
  }
  return out
}

/** Dernière éclipse commencée à `time` (ou à cet instant). */
export function lastEclipse(time: number, anchor = ECLIPSE_ANCHOR): Eclipse {
  const series = Math.floor((time - anchor) / ECLIPSE_SERIES_MS)
  return [...seriesEclipses(series - 1, anchor), ...seriesEclipses(series, anchor)].filter(e => e.start <= time).at(-1)!
}

/** L'éclipse est-elle en cours à cet instant ? (durée connue seulement) */
export function isEclipseActive(e: Eclipse, time: number, durationMinutes: number): boolean {
  return durationMinutes > 0 && time >= e.start && time < e.start + durationMinutes * 60_000
}
