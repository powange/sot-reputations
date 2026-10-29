import sharp from 'sharp'

// Ressemblance de deux images d'objets du coffre : empreinte 32×32 (objet centré sur fond
// transparent) comparée sur les seuls pixels de l'objet. Même mesure que pour les
// rapprochements avec sotfr : distance < 8 « sûre », < 15 « probable », > 40 sans rapport.

const SIZE = 32
// Noir pur (fonds non détourés) traité comme transparent.
const BLACK_CUTOFF = 12

async function fingerprint(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer()
}

/** Distance moyenne par canal (0 = identiques, 255 = opposées). */
export function fingerprintDistance(a: Buffer, b: Buffer): number {
  const alpha = (p: Buffer, i: number) => (p[i]! <= BLACK_CUTOFF && p[i + 1]! <= BLACK_CUTOFF && p[i + 2]! <= BLACK_CUTOFF) ? 0 : p[i + 3]! / 255
  let d = 0
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    const aa = alpha(a, i)
    const ab = alpha(b, i)
    if (aa < 0.1 && ab < 0.1) continue
    for (let c = 0; c < 3; c++) d += Math.abs(a[i + c]! * aa - b[i + c]! * ab)
    d += Math.abs(aa - ab) * 255
    n += 4
  }
  return n ? d / n : 255
}

/** Score de correspondance (0-100 %) déduit de la distance : 100 = identiques, 0 dès 50. */
export function similarityScore(distance: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - distance * 2)))
}

export async function compareChestImages(urlA: string, urlB: string): Promise<{ distance: number, score: number }> {
  // Import à la demande : garde les fonctions de calcul ci-dessus testables sans Nuxt.
  const { fetchChestImage } = await import('./chest-image-fetch')
  const [a, b] = await Promise.all([fetchChestImage(urlA).then(fingerprint), fetchChestImage(urlB).then(fingerprint)])
  const distance = fingerprintDistance(a, b)
  return { distance: Math.round(distance * 10) / 10, score: similarityScore(distance) }
}
