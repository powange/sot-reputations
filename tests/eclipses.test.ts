import { describe, expect, it } from 'vitest'
import { ECLIPSE_ANCHOR, ECLIPSE_SERIES_MS, eclipseAnchorFromObservation, eclipsesBetween, isEclipseActive, lastEclipse, upcomingEclipses } from '../shared/utils/eclipses'

const utc = (iso: string) => Date.parse(iso)

describe('éclipses', () => {
  it('suit la série de référence : +0, +24, +57, +81 min, puis 591 min d’attente', () => {
    const list = upcomingEclipses(utc('2024-12-30T03:31:00Z'), 5)
    expect(list.map(e => new Date(e.start).toISOString().slice(11, 16))).toEqual(['03:32', '03:56', '04:29', '04:53', '14:44'])
    expect(list.map(e => e.order)).toEqual([1, 2, 3, 4, 1])
  })

  it('concorde avec l’éclipse observée le 16/01/2026 à 20:32 (heure de Paris)', () => {
    const e = upcomingEclipses(utc('2026-01-16T19:31:00Z'), 1)[0]!
    expect(e.start).toBe(utc('2026-01-16T19:32:00Z'))
    expect(e.order).toBe(1)
  })

  it('une éclipse qui commence maintenant n’est plus « à venir » mais la dernière', () => {
    const t = utc('2024-12-30T03:56:00Z')
    expect(upcomingEclipses(t, 1)[0]!.order).toBe(3)
    expect(lastEclipse(t).order).toBe(2)
  })

  it('compte 4 éclipses par période de 11 h 12, avant l’ancrage aussi', () => {
    const from = utc('2024-01-01T00:00:00Z')
    expect(eclipsesBetween(from, from + 10 * ECLIPSE_SERIES_MS)).toHaveLength(40)
    expect(lastEclipse(utc('2024-12-30T03:31:00Z')).order).toBe(4)
  })

  it('recalage : une 3e éclipse observée à 04:29 UTC donne la même série de référence', () => {
    const anchor = eclipseAnchorFromObservation({ at: utc('2024-12-30T04:29:00Z'), order: 3 })
    expect(anchor).toBe(ECLIPSE_ANCHOR)
    const shifted = eclipseAnchorFromObservation({ at: utc('2024-12-30T04:31:00Z'), order: 3 })
    expect(upcomingEclipses(utc('2024-12-30T03:00:00Z'), 1, shifted)[0]!.start).toBe(utc('2024-12-30T03:34:00Z'))
  })

  it('éclipse en cours seulement si la durée est connue', () => {
    const e = lastEclipse(utc('2024-12-30T03:33:00Z'))
    expect(isEclipseActive(e, utc('2024-12-30T03:33:00Z'), 0)).toBe(false)
    expect(isEclipseActive(e, utc('2024-12-30T03:33:00Z'), 5)).toBe(true)
    expect(isEclipseActive(e, utc('2024-12-30T03:38:00Z'), 5)).toBe(false)
  })
})
