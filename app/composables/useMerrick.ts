import type { PSM as TesseractPSM } from 'tesseract.js'

// Libellés, OCR et listes récentes des quêtes de Merrick (/tools/fishing/merrick).

// Présentation commune au guide de pêche et aux quêtes
export const FISH_BAIT_ICONS: Record<FishBait, string> = {
  none: 'i-lucide-circle-slash',
  earthworms: 'i-lucide-worm',
  grubs: 'i-lucide-bug',
  leeches: 'i-lucide-droplet'
}

// Couleurs des appâts, reprises du jeu : vers de terre rose-brun, larves crème, sangsues bleu nuit.
// soft = badge / bouton inactif, solid = bouton actif, icon = pictogramme seul.
export const FISH_BAIT_CLASSES: Record<FishBait, { soft: string, solid: string, icon: string }> = {
  none: { soft: '', solid: '', icon: 'text-muted' },
  earthworms: {
    soft: 'bg-[#f6e0da] text-[#93432f] ring-[#e3ada0] hover:bg-[#f0d0c7] dark:bg-[#4a2620] dark:text-[#f2b8a9] dark:ring-[#7a4033] dark:hover:bg-[#5a2e26]',
    solid: 'bg-[#b45f4b] text-white hover:bg-[#9f5040] dark:bg-[#c8735e] dark:hover:bg-[#b45f4b]',
    icon: 'text-[#b45f4b] dark:text-[#e3937f]'
  },
  grubs: {
    soft: 'bg-[#f6f0dc] text-[#7a6528] ring-[#e1d3a3] hover:bg-[#efe6c8] dark:bg-[#3d3520] dark:text-[#eadcab] dark:ring-[#6b5d33] dark:hover:bg-[#4a4027]',
    solid: 'bg-[#cdb878] text-[#3a2f10] hover:bg-[#bfa962] dark:bg-[#d8c78f] dark:hover:bg-[#cdb878]',
    icon: 'text-[#b39b4f] dark:text-[#e0cd8e]'
  },
  leeches: {
    soft: 'bg-[#dfe3f0] text-[#2c3557] ring-[#b0b8d3] hover:bg-[#d0d6ea] dark:bg-[#232a45] dark:text-[#b9c3e8] dark:ring-[#46507a] dark:hover:bg-[#2c3456]',
    solid: 'bg-[#2f3a64] text-white hover:bg-[#252e52] dark:bg-[#4b5a94] dark:hover:bg-[#3e4c80]',
    icon: 'text-[#2f3a64] dark:text-[#9fadde]'
  }
}

export const FISH_KIND_COLORS: Record<FishVariantKind, 'neutral' | 'info' | 'warning'> = {
  common: 'neutral',
  night: 'info',
  rare: 'warning'
}

// Image d'un poisson ou d'une viande (public/img/fish, d'après SotFR). Sans variété
// précise, on montre la première variété commune de l'espèce.
export function merrickItemImage(i: Pick<MerrickIngredient, 'type' | 'key' | 'variant'>): string {
  if (i.type === 'meat') return `/img/fish/meat-${i.key}.webp`
  const variant = i.variant ?? FISH_SPECIES.find(s => s.key === i.key)?.variants[0]?.key
  return `/img/fish/${i.key}-${variant}.webp`
}

// Espèce et variété (si précisée) d'un ingrédient poisson, pour afficher rareté / lieu / appât
export function merrickFishDetails(i: Pick<MerrickIngredient, 'type' | 'key' | 'variant'>) {
  if (i.type !== 'fish') return null
  const species = FISH_SPECIES.find(s => s.key === i.key)
  if (!species) return null
  return { species, variant: species.variants.find(v => v.key === i.variant) ?? null }
}

export function useMerrickLabels() {
  const { t, locale } = useI18n()

  function fishName(key: string, variant: string | null): string {
    const species = t(`tools.fishing.species.${key}.one`)
    if (!variant) return species
    let v = t(`tools.fishing.variants.${key}.${variant}`)
    // En français la variété suit le nom : « Queue éclaboussante rubis »
    if (locale.value === 'fr') v = v.charAt(0).toLowerCase() + v.slice(1)
    return t('tools.fishing.merrick.fishVariantName', { species, variant: v })
  }

  function itemLabel(i: Pick<MerrickIngredient, 'type' | 'key' | 'variant'>): string {
    return i.type === 'meat' ? t(`tools.fishing.merrick.meats.${i.key}`) : fishName(i.key, i.variant)
  }

  // Options du sélecteur d'ingrédient, groupées par espèce puis viandes
  const itemOptions = computed(() => [
    ...FISH_SPECIES.map(species => [
      { type: 'label' as const, label: t(`tools.fishing.species.${species.key}.name`) },
      {
        label: `${fishName(species.key, null)} (${t('tools.fishing.merrick.anyVariant')})`,
        value: `fish:${species.key}`,
        avatar: { src: merrickItemImage({ type: 'fish', key: species.key, variant: null }), alt: '' }
      },
      ...species.variants.map(v => ({
        label: v.kind === 'common' ? fishName(species.key, v.key) : `${fishName(species.key, v.key)} · ${t(`tools.fishing.species.kind.${v.kind}`)}`,
        value: `fish:${species.key}:${v.key}`,
        avatar: { src: merrickItemImage({ type: 'fish', key: species.key, variant: v.key }), alt: '' }
      }))
    ]),
    [
      { type: 'label' as const, label: t('tools.fishing.merrick.meatGroup') },
      ...MERRICK_MEATS.map(m => ({
        label: t(`tools.fishing.merrick.meats.${m}`),
        value: `meat:${m}`,
        avatar: { src: merrickItemImage({ type: 'meat', key: m, variant: null }), alt: '' }
      }))
    ]
  ])

  return { itemLabel, itemOptions }
}

export type MerrickOcrLanguage = 'fra' | 'eng' | 'spa'

// Lecture d'une capture du menu, entièrement dans le navigateur (tesseract.js chargé à la demande).
export async function recognizeMerrickMenu(
  file: File,
  lang: MerrickOcrLanguage,
  onProgress: (progress: number | null) => void,
  // Lecture n sur total (plusieurs lectures fusionnées)
  onPass: (pass: number, total: number) => void = () => {}
): Promise<MerrickDish[]> {
  const [{ createWorker, PSM }, fr, en, es] = await Promise.all([
    import('tesseract.js'),
    // ?raw : @nuxtjs/i18n compile les imports de locales en fonctions de message
    import('~~/i18n/locales/fr.json?raw'),
    import('~~/i18n/locales/en.json?raw'),
    import('~~/i18n/locales/es.json?raw')
  ])
  const vocab = buildMerrickVocabulary([fr, en, es].map(m => JSON.parse(m.default)), [true, false, false])

  const worker = await createWorker(lang, 1, {
    logger: (m: { status: string, progress: number }) => {
      if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100))
    }
  })
  try {
    // Selon le cadrage, chaque mode de découpage de Tesseract rate des lignes différentes :
    // on cumule les lectures (colonne de tailles variables, bloc uniforme, puis automatique
    // et noir et blanc en secours) et on les fusionne ligne par ligne, jusqu'à obtenir un
    // menu complet (3 plats de 2 ingrédients).
    const gray = await preprocessImage(file)
    const attempts: Array<{ psm: TesseractPSM, image: () => HTMLCanvasElement }> = [
      { psm: PSM.SINGLE_COLUMN, image: () => gray },
      { psm: PSM.SINGLE_BLOCK, image: () => gray },
      { psm: PSM.AUTO, image: () => gray },
      { psm: PSM.SINGLE_BLOCK, image: () => binarize(gray) }
    ]
    const passes: OcrLine[][] = []
    let best: MerrickDish[] = []
    for (const [index, attempt] of attempts.entries()) {
      onPass(index + 1, attempts.length)
      onProgress(0)
      // Laisse le navigateur afficher la progression entre deux lectures
      await new Promise(resolve => setTimeout(resolve))
      await worker.setParameters({ tessedit_pageseg_mode: attempt.psm })
      // Sortie TSV (lignes + positions) plutôt que l'arbre complet mots/caractères,
      // bien plus lourd en mémoire sur mobile. Une lecture bloquée (téléphone à court de
      // mémoire…) ne doit pas figer l'import : on garde alors le meilleur résultat obtenu.
      const result = await withTimeout(worker.recognize(attempt.image(), {}, { tsv: true, text: false }), PASS_TIMEOUT_MS)
      if (!result) break
      passes.push(linesFromTsv(result.data.tsv ?? ''))
      const merged = parseMerrickMenu(mergeOcrPasses(passes, vocab), vocab)
      if (countIngredients(merged) >= countIngredients(best)) best = merged
      // Deux lectures au minimum : une seule peut paraître complète en ayant mal rangé les plats
      if (index >= 1 && isCompleteMenu(best)) break
    }
    return best
  } finally {
    await worker.terminate()
  }
}

const countIngredients = (dishes: MerrickDish[]) => dishes.reduce((n, d) => n + d.ingredients.length, 0)

const PASS_TIMEOUT_MS = 60_000

// null si la promesse ne s'est pas résolue à temps
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))])
}

// TSV de Tesseract : une ligne par élément ; niveau 5 = mot, regroupés par ligne de texte
// (bloc, paragraphe, ligne) avec leur boîte verticale
function linesFromTsv(tsv: string): OcrLine[] {
  const lines = new Map<string, OcrLine & { words: string[] }>()
  for (const row of tsv.split('\n')) {
    const cols = row.split('\t')
    if (cols[0] !== '5' || cols.length < 12 || !cols[11]?.trim()) continue
    const key = `${cols[2]}-${cols[3]}-${cols[4]}`
    const top = Number(cols[7])
    const bottom = top + Number(cols[9])
    const line = lines.get(key)
    if (line) {
      line.words.push(cols[11])
      line.y0 = Math.min(line.y0, top)
      line.y1 = Math.max(line.y1, bottom)
    } else {
      lines.set(key, { text: '', words: [cols[11]], y0: top, y1: bottom })
    }
  }
  return [...lines.values()].map(l => ({ text: l.words.join(' '), y0: l.y0, y1: l.y1 }))
}

// Un menu de Merrick compte 3 plats de 2 ingrédients : en dessous, la lecture a sans doute raté des lignes
export function isCompleteMenu(dishes: MerrickDish[]): boolean {
  return dishes.length >= 3 && dishes.every(d => d.ingredients.length >= 2)
}

// Seuil d'Otsu : sépare au mieux encre et parchemin d'après l'histogramme
function binarize(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  const histogram = new Array<number>(256).fill(0)
  for (let i = 0; i < px.length; i += 4) histogram[px[i]!]!++
  const total = px.length / 4
  let sum = 0
  for (let v = 0; v < 256; v++) sum += v * histogram[v]!
  let sumB = 0
  let weightB = 0
  let best = 0
  let threshold = 128
  for (let v = 0; v < 256; v++) {
    weightB += histogram[v]!
    if (!weightB) continue
    const weightF = total - weightB
    if (!weightF) break
    sumB += v * histogram[v]!
    const between = weightB * weightF * (sumB / weightB - (sum - sumB) / weightF) ** 2
    if (between > best) {
      best = between
      threshold = v
    }
  }
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i]! > threshold ? 255 : 0
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

// Met à l'échelle, passe en niveaux de gris et étire le contraste : les captures in-game
// sont souvent sombres (parchemin à l'ombre) et le texte fin. Les captures sont agrandies
// (~2200 px : les petites lignes « 1 POULE » deviennent lisibles) ; les photos de
// téléphone (souvent ~4000 px) réduites pour garder l'OCR rapide.
async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  // from-image : applique l'orientation EXIF des photos prises en portrait
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  // ~2200 px de large, mais 6 Mpx au plus (photo de téléphone en portrait : mémoire limitée)
  const scale = Math.min(Math.max(1, 2200 / bitmap.width), 2600 / bitmap.width, Math.sqrt(6_000_000 / (bitmap.width * bitmap.height)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  const histogram = new Array<number>(256).fill(0)
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!)
    px[i] = g
    histogram[g]!++
  }
  // Bornes aux percentiles 1 % / 99 % pour ignorer les pixels extrêmes isolés
  const total = px.length / 4
  let acc = 0
  let lo = 0
  let hi = 255
  for (let v = 0; v < 256; v++) {
    acc += histogram[v]!
    if (acc <= total * 0.01) lo = v
    if (acc <= total * 0.99) hi = v
  }
  const range = Math.max(1, hi - lo)
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round((px[i]! - lo) * 255 / range)))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

// Listes ouvertes récemment sur cet appareil (simple confort, pas de compte).
interface RecentMerrickQuest {
  token: string
  label: string
  at: number
}

const RECENT_KEY = 'merrick-recent'

export function useMerrickRecent() {
  const recent = ref<RecentMerrickQuest[]>([])

  onMounted(() => {
    try {
      recent.value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    } catch {
      recent.value = []
    }
  })

  function remember(token: string, label: string) {
    const list = [{ token, label, at: Date.now() }, ...recent.value.filter(r => r.token !== token)].slice(0, 10)
    recent.value = list
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list))
    } catch {
      // Stockage indisponible (navigation privée…) : tant pis
    }
  }

  function forget(token: string) {
    recent.value = recent.value.filter(r => r.token !== token)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
    } catch {
      // Stockage indisponible : tant pis
    }
  }

  return { recent, remember, forget }
}
