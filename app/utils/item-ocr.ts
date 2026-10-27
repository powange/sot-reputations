// Lecture d'une capture d'un objet du jeu (titre + description), entièrement dans le
// navigateur (tesseract.js chargé à la demande). Le titre est écrit plus gros que la
// description : on les sépare par la hauteur typographique des lignes (rowHeight de
// Tesseract, indépendante des lettres présentes ; le cadre d'une ligne sans jambage, comme
// « dorée », est presque aussi bas que celui d'une ligne de description).

export type ItemOcrLang = 'fr' | 'en' | 'es'
const TESSERACT_LANG: Record<ItemOcrLang, string> = { fr: 'fra', en: 'eng', es: 'spa' }

export interface ItemOcrLine { text: string, height: number, confidence: number }

/** Sépare les lignes lues en titre (lignes les plus grandes, en tête) et description. */
export function splitItemOcrLines(lines: ItemOcrLine[]): { name: string, description: string } {
  // Bruit (bords de la capture, icônes) : lignes vides ou très peu sûres.
  const kept = lines.filter(l => l.text.trim().length > 1 && l.confidence >= 40)
  if (!kept.length) return { name: '', description: '' }
  const maxHeight = Math.max(...kept.map(l => l.height))
  // Mesuré : titre ~62 px, description ~47 px (rapport ~0,76).
  const isBig = (l: ItemOcrLine) => l.height >= maxHeight * 0.85
  // Titre = premier bloc de grandes lignes (ce qui le précède est du bruit de cadrage).
  const start = kept.findIndex(isBig)
  let end = kept.findIndex((l, i) => i > start && !isBig(l))
  if (end < 0) end = kept.length
  // Toutes les lignes de même taille : la première est le titre.
  if (end === kept.length && kept.length - start > 1) end = start + 1
  return { name: joinLines(kept.slice(start, end)), description: joinLines(kept.slice(end)) }
}

const joinLines = (lines: ItemOcrLine[]) => lines.map(l => l.text.trim()).join(' ').replace(/\s+/g, ' ').trim()

// Texte du jeu : crème clair, peu saturé. Ne garder que ces pixels (en noir sur blanc) efface
// l'objet dessiné derrière le titre, qui faisait lire « Keècdlas » pour « Coutelas ».
const TEXT_MIN_LIGHTNESS = 160
const TEXT_MAX_SATURATION = 0.3

async function isolateGameText(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = pixels.data
  for (let i = 0; i < d.length; i += 4) {
    const max = Math.max(d[i]!, d[i + 1]!, d[i + 2]!)
    const min = Math.min(d[i]!, d[i + 1]!, d[i + 2]!)
    const isText = (max + min) / 2 >= TEXT_MIN_LIGHTNESS && (max ? (max - min) / max : 0) <= TEXT_MAX_SATURATION
    d[i] = d[i + 1] = d[i + 2] = isText ? 0 : 255
    d[i + 3] = 255
  }
  ctx.putImageData(pixels, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas')), 'image/png'))
}

export async function recognizeItemCapture(image: Blob, lang: ItemOcrLang): Promise<{ name: string, description: string }> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(TESSERACT_LANG[lang])
  const read = async (img: Blob) => {
    const { data } = await worker.recognize(img, {}, { blocks: true })
    return (data.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines)).map(l => ({
      text: l.text,
      height: l.rowAttributes?.rowHeight || l.bbox.y1 - l.bbox.y0,
      confidence: l.confidence
    }))
  }
  // Confiance moyenne des lignes utiles (pondérée par leur longueur).
  const score = (lines: ItemOcrLine[]) => {
    const kept = lines.filter(l => l.text.trim().length > 1)
    const chars = kept.reduce((n, l) => n + l.text.length, 0)
    return chars ? kept.reduce((n, l) => n + l.confidence * l.text.length, 0) / chars : 0
  }
  try {
    // Lecture de l'image nettoyée et de l'image brute (au cas où un texte serait coloré) :
    // la plus sûre l'emporte.
    const cleaned = await read(await isolateGameText(image)).catch(() => [])
    const raw = await read(image)
    return splitItemOcrLines(score(cleaned) >= score(raw) ? cleaned : raw)
  } finally {
    await worker.terminate()
  }
}
