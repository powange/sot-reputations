import { describe, expect, it } from 'vitest'
import { ECLIPSE_SERIES_MS, eclipsesBetween, lastEclipse, upcomingEclipses } from '../shared/utils/eclipses'

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
})
