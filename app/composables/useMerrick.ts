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

// Une lecture de l'image : largeur de travail, découpage Tesseract et libellés affichés
// (tools.fishing.merrick.ocrSteps.<step> / ocrLayouts.<layout>)
export interface OcrAttempt {
  width: number
  psm: TesseractPSM
  step: 'enlarged' | 'reduced' | 'reducedMore'
  layout: 'block' | 'column'
}

// Lecture d'une capture du menu, entièrement dans le navigateur (tesseract.js chargé à la demande).
export async function recognizeMerrickMenu(
  file: File,
  lang: MerrickOcrLanguage,
  onProgress: (progress: number | null) => void,
  // Lecture n sur total (plusieurs lectures fusionnées) et ce qu'elle fait
  onPass: (pass: number, total: number, attempt: OcrAttempt) => void = () => {}
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
    // on cumule les lectures (colonne de tailles variables, bloc uniforme, puis les mêmes
    // en noir et blanc en secours) et on les fusionne ligne par ligne, jusqu'à obtenir un
    // menu complet (3 plats de 2 ingrédients).
    // from-image : applique l'orientation EXIF des photos prises en portrait
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    // Le texte ne se lit bien qu'à une certaine taille, et les photos d'écran ont du moiré.
    // Mesuré sur de vraies captures et photos d'écran OLED : une capture (petite image) se
    // lit mieux agrandie (~2200 px de large), une photo mieux réduite (1100-1300 px : la
    // réduction lisse le moiré). Les lectures à plusieurs échelles sont fusionnées.
    // Pas de découpage automatique (PSM 3) : le plus lent et le moins fiable.
    const isPhoto = bitmap.width >= 1600
    const attempts: OcrAttempt[] = isPhoto
      ? [
          { width: 1300, psm: PSM.SINGLE_BLOCK, step: 'reduced', layout: 'block' },
          { width: 1100, psm: PSM.SINGLE_BLOCK, step: 'reducedMore', layout: 'block' },
          // Grande capture plein écran (pas une photo) : le petit texte veut de l'agrandissement
          { width: 2200, psm: PSM.SINGLE_BLOCK, step: 'enlarged', layout: 'block' },
          { width: 1300, psm: PSM.SINGLE_COLUMN, step: 'reduced', layout: 'column' },
          { width: 1100, psm: PSM.SINGLE_COLUMN, step: 'reducedMore', layout: 'column' }
        ]
      : [
          { width: 2200, psm: PSM.SINGLE_BLOCK, step: 'enlarged', layout: 'block' },
          { width: 2200, psm: PSM.SINGLE_COLUMN, step: 'enlarged', layout: 'column' },
          { width: 1300, psm: PSM.SINGLE_BLOCK, step: 'reduced', layout: 'block' },
          { width: 1300, psm: PSM.SINGLE_COLUMN, step: 'reduced', layout: 'column' }
        ]
    const prepared = new Map<number, Prepared>()
    const passes: OcrLine[][] = []
    let best: MerrickDish[] = []
    try {
      for (const [index, attempt] of attempts.entries()) {
        onPass(index + 1, attempts.length, attempt)
        onProgress(0)
        // Laisse le navigateur afficher la progression entre deux lectures
        await new Promise(resolve => setTimeout(resolve))
        await worker.setParameters({ tessedit_pageseg_mode: attempt.psm })
        let image = prepared.get(attempt.width)
        if (!image) prepared.set(attempt.width, image = preprocessImage(bitmap, attempt.width))
        // Sortie TSV (lignes + positions) plutôt que l'arbre complet mots/caractères,
        // bien plus lourd en mémoire sur mobile. Une lecture bloquée (téléphone à court de
        // mémoire…) ne doit pas figer l'import : on garde alors le meilleur résultat obtenu.
        const result = await withTimeout(worker.recognize(image.canvas, {}, { tsv: true, text: false }), PASS_TIMEOUT_MS)
        if (!result) break
        // Positions ramenées à l'image d'origine pour fusionner les lectures à différentes échelles
        const scale = image.scale
        passes.push(linesFromTsv(result.data.tsv ?? '').map(l => ({ text: l.text, y0: l.y0 / scale, y1: l.y1 / scale })))
        const merged = parseMerrickMenu(mergeOcrPasses(passes, vocab), vocab)
        if (countIngredients(merged) >= countIngredients(best)) best = merged
        // Deux lectures au minimum : une seule peut paraître complète en ayant mal rangé les plats
        if (index >= 1 && isCompleteMenu(best)) break
      }
    } finally {
      bitmap.close()
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

interface Prepared {
  canvas: HTMLCanvasElement
  // Pour ramener les lignes lues aux coordonnées de l'image d'origine
  scale: number
}

// Met l'image à la largeur demandée, en niveaux de gris, contraste étiré : les captures
// in-game sont souvent sombres (parchemin à l'ombre) et le texte fin.
function preprocessImage(bitmap: ImageBitmap, width: number): Prepared {
  const scale = width / bitmap.width
  // Réduction par paliers (au plus ÷2 à chaque fois) avec lissage de qualité : le
  // redimensionnement par défaut du canvas « saute » des pixels et garde le moiré des
  // photos d'écran, que la réduction doit justement effacer
  let source: CanvasImageSource = bitmap
  let sw = bitmap.width
  let sh = bitmap.height
  while (sw / 2 > width) {
    const step = document.createElement('canvas')
    step.width = Math.round(sw / 2)
    step.height = Math.round(sh / 2)
    const sctx = step.getContext('2d')!
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(source, 0, 0, step.width, step.height)
    source = step
    sw = step.width
    sh = step.height
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

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
  return { canvas, scale }
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
