import sharp from 'sharp'
import { classifyColor } from './chest-colors'

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// Pixels (quasi) noirs purs : fond / ombre de rendu — aucun item n'en a vraiment.
// On les ignore comme s'ils étaient transparents.
const BLACK_CUTOFF = 12
// Une couleur doit couvrir au moins cette fraction des pixels opaques pour compter
// (écarte le bruit, sans exiger 33 % qui éliminerait les accents vifs minoritaires).
const MIN_AREA_FRACTION = 0.06
// Les couleurs vives (saturées ET claires) « pèsent » plus que leur seule surface,
// pour qu'un accent saillant (ex. étoile verte) remonte face à de grandes plages
// neutres (tissu noir, ombres).
const SATURATION_BOOST = 5

/**
 * Extrait les `count` couleurs dominantes (RGB hex) d'une image.
 *
 * On agrège les pixels par **couleur nommée** (via `classifyColor`) plutôt que par
 * bacs RGB fins : ainsi toutes les nuances d'un dégradé (un vert vif décliné en
 * plusieurs teintes) se cumulent sous un seul nom au lieu d'être fragmentées en
 * petits bacs qui passeraient chacun sous le plancher de surface. Chaque groupe est
 * ensuite classé par « dominance pondérée » = surface × (1 + saturation·clarté), si
 * bien qu'une couleur vive minoritaire peut devancer une grande plage terne.
 *
 * Ignore les pixels (quasi) transparents et le noir pur (fond/ombre).
 * (Isolé dans son module pour ne charger sharp/libvips que sur la route d'analyse ;
 * `classifyColor` n'embarque pas sharp.)
 */
export async function extractDominantColors(buffer: Buffer, count = 4): Promise<string[]> {
  const { data, info } = await sharp(buffer)
    .resize(96, 96, { fit: 'inside' }) // échantillon fin : les petits accents survivent au sous-échantillonnage
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const ch = info.channels
  // nom -> { surface, somme RGB } pour en tirer une couleur représentative moyenne.
  const groups = new Map<string, { count: number, r: number, g: number, b: number }>()
  let totalOpaque = 0
  for (let i = 0; i + ch - 1 < data.length; i += ch) {
    const a = ch === 4 ? data[i + 3]! : 255
    if (a < 128) continue
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!
    if (r <= BLACK_CUTOFF && g <= BLACK_CUTOFF && b <= BLACK_CUTOFF) continue // noir pur : ignoré
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
    const sat = mx === 0 ? 0 : (mx - mn) / mx // saturation HSV
    const value = mx / 255 // clarté : un accent vif est saturé ET clair
    return { rgb: [r, g, b] as [number, number, number], count: grp.count, weight: grp.count * (1 + SATURATION_BOOST * sat * value) }
  })

  // Plancher de surface (mais on garde au moins la couleur la plus lourde si tout
  // tombe en dessous, pour ne jamais rendre un item sans couleur).
  const floor = totalOpaque * MIN_AREA_FRACTION
  let eligible = entries.filter(e => e.count >= floor)
  if (eligible.length === 0) eligible = entries
  eligible.sort((a, b) => b.weight - a.weight)

  return eligible.slice(0, count).map(e => rgbToHex(e.rgb[0], e.rgb[1], e.rgb[2]))
}
