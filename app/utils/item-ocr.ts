// Lecture d'une capture d'un objet du jeu (titre + description), entièrement dans le
// navigateur (tesseract.js chargé à la demande). Le titre est écrit plus gros que la
// description : on les sépare par la hauteur des lignes.

export type ItemOcrLang = 'fr' | 'en' | 'es'
const TESSERACT_LANG: Record<ItemOcrLang, string> = { fr: 'fra', en: 'eng', es: 'spa' }

export interface ItemOcrLine { text: string, height: number, confidence: number }

/** Sépare les lignes lues en titre (lignes les plus grandes, en tête) et description. */
export function splitItemOcrLines(lines: ItemOcrLine[]): { name: string, description: string } {
  // Bruit (bords de la capture, icônes) : lignes vides ou très peu sûres.
  const kept = lines.filter(l => l.text.trim().length > 1 && l.confidence >= 40)
  if (!kept.length) return { name: '', description: '' }
  const maxHeight = Math.max(...kept.map(l => l.height))
  const isBig = (l: ItemOcrLine) => l.height >= maxHeight * 0.75
  // Titre = premier bloc de grandes lignes (ce qui le précède est du bruit de cadrage).
  const start = kept.findIndex(isBig)
  let end = kept.findIndex((l, i) => i > start && !isBig(l))
  if (end < 0) end = kept.length
  // Toutes les lignes de même taille : la première est le titre.
  if (end === kept.length && kept.length - start > 1) end = start + 1
  return { name: joinLines(kept.slice(start, end)), description: joinLines(kept.slice(end)) }
}

const joinLines = (lines: ItemOcrLine[]) => lines.map(l => l.text.trim()).join(' ').replace(/\s+/g, ' ').trim()

export async function recognizeItemCapture(image: Blob, lang: ItemOcrLang): Promise<{ name: string, description: string }> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(TESSERACT_LANG[lang])
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true })
    const lines = (data.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines)).map(l => ({
      text: l.text,
      height: l.bbox.y1 - l.bbox.y0,
      confidence: l.confidence
    }))
    return splitItemOcrLines(lines)
  } finally {
    await worker.terminate()
  }
}
