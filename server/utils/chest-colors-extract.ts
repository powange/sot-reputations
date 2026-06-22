import sharp from 'sharp'

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

const DISTINCT_RGB_DIST = 48 // évite de retenir plusieurs nuances quasi identiques

/**
 * Extrait les `count` couleurs dominantes (RGB hex) d'une image, en ignorant les
 * pixels (quasi) transparents. Quantification par bacs + moyenne, puis on retient
 * les couleurs suffisamment distinctes par fréquence décroissante.
 * (Isolé dans son module pour ne charger sharp/libvips que sur la route d'analyse.)
 */
export async function extractDominantColors(buffer: Buffer, count = 3): Promise<string[]> {
  const { data, info } = await sharp(buffer)
    .resize(48, 48, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const ch = info.channels
  const buckets = new Map<number, { count: number, r: number, g: number, b: number }>()
  for (let i = 0; i + ch - 1 < data.length; i += ch) {
    const a = ch === 4 ? data[i + 3]! : 255
    if (a < 128) continue
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!
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

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count)
  const picked: Array<[number, number, number]> = []
  for (const bk of sorted) {
    const avg: [number, number, number] = [
      Math.round(bk.r / bk.count),
      Math.round(bk.g / bk.count),
      Math.round(bk.b / bk.count)
    ]
    const distinct = picked.every(([pr, pg, pb]) =>
      Math.sqrt((pr - avg[0]) ** 2 + (pg - avg[1]) ** 2 + (pb - avg[2]) ** 2) > DISTINCT_RGB_DIST
    )
    if (distinct) picked.push(avg)
    if (picked.length >= count) break
  }
  return picked.map(([r, g, b]) => rgbToHex(r, g, b))
}
