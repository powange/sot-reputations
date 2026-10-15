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
  onProgress: (progress: number | null) => void
): Promise<MerrickDish[]> {
  const [{ createWorker }, fr, en, es] = await Promise.all([
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
    // 1re lecture : niveaux de gris contrastés. Si le menu semble incomplet (un menu de
    // Merrick a 3 plats de 2 ingrédients), 2e lecture en noir et blanc pur, qui efface
    // mieux l'emblème en fond du parchemin ; on garde la plus complète.
    const gray = await preprocessImage(file)
    const first = parseMerrickMenu((await worker.recognize(gray)).data.text.split('\n'), vocab)
    if (isCompleteMenu(first)) return first
    const second = parseMerrickMenu((await worker.recognize(binarize(gray))).data.text.split('\n'), vocab)
    if (countIngredients(second) <= countIngredients(first)) return first
    // Le noir et blanc perd souvent les « (CUIT) / (CRU) » gris clair : on reprend ceux de la 1re lecture
    const firstStates = new Map(first.flatMap(d => d.ingredients).map(i => [merrickItemId(i), i.state]))
    for (const ing of second.flatMap(d => d.ingredients)) ing.state = firstStates.get(merrickItemId(ing)) ?? ing.state
    return second
  } finally {
    await worker.terminate()
  }
}

const countIngredients = (dishes: MerrickDish[]) => dishes.reduce((n, d) => n + d.ingredients.length, 0)

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
// sont souvent sombres (parchemin à l'ombre) et le texte fin. Les petites captures sont
// agrandies ; les photos de téléphone (souvent ~4000 px) réduites pour garder l'OCR rapide.
async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  // from-image : applique l'orientation EXIF des photos prises en portrait
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(Math.max(1, 1500 / bitmap.width), 2000 / bitmap.width)
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
