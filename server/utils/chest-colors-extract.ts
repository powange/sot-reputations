import sharp from 'sharp'

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

const DISTINCT_RGB_DIST = 48 // évite de retenir plusieurs nuances quasi identiques
// Pixels (quasi) noirs purs : fond / ombre de rendu — aucun item n'en a vraiment.
// On les ignore comme s'ils étaient transparents (le halo d'anti-crénelage du noir
// pur autour de l'objet est aussi capté par cette petite tolérance).
const BLACK_CUTOFF = 12
// Une couleur doit couvrir au moins cette fraction des pixels opaques pour compter
// (écarte le bruit, sans exiger 33 % qui éliminerait les accents vifs minoritaires).
const MIN_AREA_FRACTION = 0.05
// Les couleurs vives (saturées ET claires) « pèsent » plus que leur seule surface,
// pour qu'un accent saillant (ex. cristaux cyan) remonte face à de grandes plages
// neutres (métal gris, ombres).
const SATURATION_BOOST = 5

/**
 * Extrait les `count` couleurs dominantes (RGB hex) d'une image.
 * Ignore les pixels (quasi) transparents et le noir pur (fond/ombre). Quantifie en
 * bacs, puis classe par « dominance pondérée » = surface × (1 + saturation·clarté) :
 * une couleur vive minoritaire peut ainsi devancer une grande plage terne. Ne retient
 * que des couleurs assez distinctes et couvrant une surface minimale.
 * (Isolé dans son module pour ne charger sharp/libvips que sur la route d'analyse.)
 */
export async function extractDominantColors(buffer: Buffer, count = 3): Promise<string[]> {
  const { data, info } = await sharp(buffer)
    .resize(96, 96, { fit: 'inside' }) // échantillon plus fin : les petits accents survivent au sous-échantillonnage
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const ch = info.channels
  const buckets = new Map<number, { count: number, r: number, g: number, b: number }>()
  let totalOpaque = 0
  for (let i = 0; i + ch - 1 < data.length; i += ch) {
    const a = ch === 4 ? data[i + 3]! : 255
    if (a < 128) continue
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!
    if (r <= BLACK_CUTOFF && g <= BLACK_CUTOFF && b <= BLACK_CUTOFF) continue // noir pur : ignoré
    totalOpaque++
    const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.count++
      bucket.r += r
      bucket.g += g
      bucket.b += b
    } else {
      buckets.set(key, { count: 1, r, g, b })
    }
  }

  if (totalOpaque === 0) return []

  const entries = [...buckets.values()].map((bk) => {
    const r = Math.round(bk.r / bk.count)
    const g = Math.round(bk.g / bk.count)
    const b = Math.round(bk.b / bk.count)
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const sat = mx === 0 ? 0 : (mx - mn) / mx // saturation HSV
    const value = mx / 255 // clarté : un accent vif est saturé ET clair
    return { rgb: [r, g, b] as [number, number, number], count: bk.count, weight: bk.count * (1 + SATURATION_BOOST * sat * value) }
  })

  // Plancher de surface (mais on garde au moins la couleur la plus lourde si tout
  // tombe en dessous, pour ne jamais rendre un item sans couleur).
  const floor = totalOpaque * MIN_AREA_FRACTION
  let eligible = entries.filter(e => e.count >= floor)
  if (eligible.length === 0) eligible = entries
  eligible.sort((a, b) => b.weight - a.weight)

  const picked: Array<[number, number, number]> = []
  for (const e of eligible) {
    const distinct = picked.every(([pr, pg, pb]) =>
      Math.sqrt((pr - e.rgb[0]) ** 2 + (pg - e.rgb[1]) ** 2 + (pb - e.rgb[2]) ** 2) > DISTINCT_RGB_DIST
    )
    if (distinct) picked.push(e.rgb)
    if (picked.length >= count) break
  }
  return picked.map(([r, g, b]) => rgbToHex(r, g, b))
}
