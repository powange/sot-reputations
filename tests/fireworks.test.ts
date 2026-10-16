import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FIREWORKS_ANCHOR,
  FIREWORKS_INTERVAL_MS,
  FIREWORKS_OUTPOSTS,
  fireworksShowAt,
  fireworksShowsBetween,
  upcomingFireworksShows
} from '../shared/utils/fireworks'

// Instant UTC un jour quelconque (le cycle est identique chaque jour UTC)
const utc = (h: number, m: number, day = 16) => Date.UTC(2026, 9, day, h, m)
const outpostAt = (time: number) => FIREWORKS_OUTPOSTS[fireworksShowAt(time).outpost]!.name

describe('fireworksShowAt', () => {
  it('suit les horaires de référence', () => {
    expect(outpostAt(utc(0, 20))).toBe('Sanctuary Outpost')
    expect(outpostAt(utc(0, 44))).toBe('Port Merrick')
    expect(outpostAt(utc(1, 8))).toBe('Plunder Outpost')
    expect(outpostAt(utc(13, 32))).toBe('Ancient Spire Outpost')
    expect(outpostAt(utc(23, 56))).toBe('Galleon\'s Grave Outpost')
  })

  it('renvoie le dernier show commencé et son heure de début', () => {
    const show = fireworksShowAt(utc(0, 50))
    expect(FIREWORKS_OUTPOSTS[show.outpost]!.name).toBe('Port Merrick')
    expect(show.start).toBe(utc(0, 44))
  })

  it('passe minuit : le show de 23:56 dure jusqu’à 00:20, puis Sanctuary', () => {
    expect(outpostAt(utc(0, 0, 17))).toBe('Galleon\'s Grave Outpost')
    expect(fireworksShowAt(utc(0, 10, 17)).start).toBe(utc(23, 56, 16))
    expect(outpostAt(utc(0, 20, 17))).toBe('Sanctuary Outpost')
  })

  it('applique la formule du planning pour chaque minute de la journée', () => {
    for (let m = 0; m < 1440; m++) {
      const slot = Math.floor((m - 20) / 24)
      const expected = (((slot + 5) % 6) + 6) % 6
      expect(fireworksShowAt(utc(Math.floor(m / 60), m % 60)).outpost).toBe(expected)
    }
  })
})

describe('planning', () => {
  it('fait revenir chaque avant-poste toutes les 144 minutes', () => {
    const a = fireworksShowAt(utc(13, 32))
    const b = fireworksShowAt(utc(13, 32) + 144 * 60_000)
    expect(b.outpost).toBe(a.outpost)
  })

  it('compte 60 shows par jour UTC, 10 par avant-poste', () => {
    const shows = fireworksShowsBetween(utc(0, 0), utc(0, 0, 17))
    expect(shows).toHaveLength(60)
    for (let i = 0; i < FIREWORKS_OUTPOSTS.length; i++) {
      expect(shows.filter(s => s.outpost === i)).toHaveLength(10)
    }
  })

  it('liste les prochains shows dans l’ordre cyclique', () => {
    const next = upcomingFireworksShows(utc(0, 30), 3)
    expect(next.map(s => FIREWORKS_OUTPOSTS[s.outpost]!.name)).toEqual(['Port Merrick', 'Plunder Outpost', 'Ancient Spire Outpost'])
    expect(next[0]!.start).toBe(utc(0, 44))
    expect(next[1]!.start - next[0]!.start).toBe(FIREWORKS_INTERVAL_MS)
  })

  it('suit un ancrage redéfini par un admin (planning décalé)', () => {
    // Après une mise à jour : Dagger Tooth tire à 10:05 UTC
    const anchor = { at: utc(10, 5), outpost: 3 }
    expect(FIREWORKS_OUTPOSTS[fireworksShowAt(utc(10, 5), anchor).outpost]!.name).toBe('Dagger Tooth Outpost')
    expect(FIREWORKS_OUTPOSTS[fireworksShowAt(utc(10, 29), anchor).outpost]!.name).toBe('Galleon\'s Grave Outpost')
    // Et en remontant avant l'ancrage
    expect(FIREWORKS_OUTPOSTS[fireworksShowAt(utc(9, 50), anchor).outpost]!.name).toBe('Ancient Spire Outpost')
    expect(DEFAULT_FIREWORKS_ANCHOR.outpost).toBe(5)
  })
})

describe('fuseaux horaires', async () => {
  const { dayKeyIn, timeZoneOffsetLabel, listTimeZones, isValidTimeZone } = await import('../app/utils/timezones')

  it('donne le décalage avec l’heure d’été', () => {
    expect(timeZoneOffsetLabel('Europe/Paris', Date.UTC(2026, 6, 1))).toBe('UTC+2')
    expect(timeZoneOffsetLabel('Europe/Paris', Date.UTC(2026, 0, 1))).toBe('UTC+1')
    expect(timeZoneOffsetLabel('UTC', Date.UTC(2026, 0, 1))).toBe('UTC')
  })

  it('range un show dans le bon jour local', () => {
    // 23:56 UTC le 16 = 01:56 le 17 à Paris (été)
    expect(dayKeyIn('UTC', utc(23, 56))).toBe('2026-10-16')
    expect(dayKeyIn('Europe/Paris', utc(23, 56))).toBe('2026-10-17')
  })

  it('liste les fuseaux avec UTC en tête', () => {
    const zones = listTimeZones()
    expect(zones[0]).toBe('UTC')
    expect(zones).toContain('Europe/Paris')
    expect(isValidTimeZone('Europe/Paris')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
  })
})
