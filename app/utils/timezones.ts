// Fuseaux horaires sans librairie : tout passe par Intl.DateTimeFormat et son option timeZone.

// Repli si Intl.supportedValuesOf n'existe pas (navigateurs anciens)
const FALLBACK_TIME_ZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Brussels', 'Europe/Zurich', 'Europe/Madrid', 'Europe/Berlin',
  'Europe/Lisbon', 'Europe/Moscow', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Montreal', 'America/Sao_Paulo', 'America/Mexico_City',
  'Africa/Casablanca', 'Africa/Algiers', 'Africa/Dakar', 'Indian/Reunion', 'America/Martinique',
  'America/Guadeloupe', 'Pacific/Tahiti', 'Pacific/Noumea', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Pacific/Auckland'
]

export function listTimeZones(): string[] {
  let zones: string[] = []
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  } catch {
    zones = []
  }
  if (!zones.length) zones = [...FALLBACK_TIME_ZONES].sort()
  // UTC en tête (absent de certaines listes)
  return ['UTC', ...zones.filter(z => z !== 'UTC' && z !== 'Etc/UTC')]
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimeZone(tz) ? tz : 'UTC'
  } catch {
    return 'UTC'
  }
}

// « UTC+2 », « UTC−3:30 », « UTC » : décalage du fuseau à un instant donné (heure d'été comprise)
export function timeZoneOffsetLabel(tz: string, time: number): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(time)
      .find(p => p.type === 'timeZoneName')?.value ?? 'GMT'
    // Selon le moteur, UTC s'écrit « GMT » ou « GMT+0 »
    return part.replace('GMT', 'UTC').replace(/^UTC[+-]0(:00)?$/, 'UTC')
  } catch {
    return ''
  }
}

// Clé de jour calendaire dans le fuseau (« 2026-10-16 »), pour regrouper les shows par jour local
export function dayKeyIn(tz: string, time: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(time)
}
