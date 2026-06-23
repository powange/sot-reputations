import sharp from 'sharp'
import { classifyColor } from './chest-colors'

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// Bac couleur quantifié (4 bits/canal -> clé 12 bits). Sert à la fois à l'exclusion
// par signature et au calcul des signatures, qui doivent utiliser le MÊME découpage.
export function colorBinKey(r: number, g: number, b: number): number {
  return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
}

// Pixels (quasi) noirs purs : fond / ombre de rendu — aucun item n'en a vraiment.
const BLACK_CUTOFF = 12
// Une couleur doit couvrir au moins cette fraction des pixels opaques pour compter.
const MIN_AREA_FRACTION = 0.06
// Les couleurs vives (saturées ET claires) pèsent plus que leur seule surface.
const SATURATION_BOOST = 5
// Côté d'échantillonnage (résolution de travail).
const SAMPLE = 96

/** Décode une image vers du RGBA brut à la résolution de travail (réutilisable). */
export async function decodeRaw(buffer: Buffer): Promise<{ data: Buffer, channels: number }> {
  const { data, info } = await sharp(buffer)
    .resize(SAMPLE, SAMPLE, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, channels: info.channels }
}

function isSkipped(r: number, g: number, b: number, a: number, excludeBins?: Set<number>): boolean {
  if (a < 128) return true // transparent
  if (r <= BLACK_CUTOFF && g <= BLACK_CUTOFF && b <= BLACK_CUTOFF) return true // noir pur
  if (excludeBins && excludeBins.has(colorBinKey(r, g, b))) return true // couleur « décor » (signature)
  return false
}

/**
 * Couleurs dominantes (RGB hex) à partir de RGBA brut. Agrège par couleur nommée
 * (un dégradé se cumule sous un seul nom), classe par dominance pondérée
 * (surface × saturation·clarté), exclut transparent / noir pur / bacs `excludeBins`.
 */
export function extractFromRaw(data: Buffer | Uint8Array, channels: number, count = 4, excludeBins?: Set<number>): string[] {
  const groups = new Map<string, { count: number, r: number, g: number, b: number }>()
  let totalOpaque = 0
  for (let i = 0; i + channels - 1 < data.length; i += channels) {
    const a = channels === 4 ? data[i + 3]! : 255
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!
    if (isSkipped(r, g, b, a, excludeBins)) continue
    totalOpaque++
    const name = classifyColor(r, g, b)
    const grp = groups.get(name)
    if (grp) {
      grp.count++
      grp.r += r
      grp.g += g
      grp.b += b
    } else {
      groups.set(name, { count: 1, r, g, b })
    }
  }

  if (totalOpaque === 0) return []

  const entries = [...groups.values()].map((grp) => {
    const r = Math.round(grp.r / grp.count)
    const g = Math.round(grp.g / grp.count)
    const b = Math.round(grp.b / grp.count)
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const sat = mx === 0 ? 0 : (mx - mn) / mx
    const value = mx / 255
    return { rgb: [r, g, b] as [number, number, number], count: grp.count, weight: grp.count * (1 + SATURATION_BOOST * sat * value) }
  })

  const floor = totalOpaque * MIN_AREA_FRACTION
  let eligible = entries.filter(e => e.count >= floor)
  if (eligible.length === 0) eligible = entries
  eligible.sort((a, b) => b.weight - a.weight)

  return eligible.slice(0, count).map(e => rgbToHex(e.rgb[0], e.rgb[1], e.rgb[2]))
}

/**
 * Extrait les `count` couleurs dominantes (RGB hex) d'une image. `excludeBins` permet
 * d'ignorer les couleurs « décor » d'un scope (ex. la coque sous les figures de proue).
 * (Isolé pour ne charger sharp/libvips que sur la route d'analyse.)
 */
export async function extractDominantColors(buffer: Buffer, count = 4, excludeBins?: Set<number>): Promise<string[]> {
  const { data, channels } = await decodeRaw(buffer)
  return extractFromRaw(data, channels, count, excludeBins)
}

/**
 * Bacs couleur (4 bits) présents sur au moins `minFraction` des pixels opaques d'une
 * image (hors transparent / noir pur). Sert à construire une signature de scope.
 */
export function presentBins(data: Buffer | Uint8Array, channels: number, minFraction = 0.01): number[] {
  const counts = new Map<number, number>()
  let totalOpaque = 0
  for (let i = 0; i + channels - 1 < data.length; i += channels) {
    const a = channels === 4 ? data[i + 3]! : 255
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!
    if (isSkipped(r, g, b, a)) continue
    totalOpaque++
    const key = colorBinKey(r, g, b)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  if (totalOpaque === 0) return []
  const out: number[] = []
  for (const [key, c] of counts) if (c / totalOpaque >= minFraction) out.push(key)
  return out
}
