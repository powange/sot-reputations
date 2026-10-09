// Libellés, OCR et listes récentes des quêtes de Merrick (/tools/fishing/merrick).

// Présentation commune au guide de pêche et aux quêtes
export const FISH_BAIT_ICONS: Record<FishBait, string> = {
  none: 'i-lucide-circle-slash',
  earthworms: 'i-lucide-worm',
  grubs: 'i-lucide-bug',
  leeches: 'i-lucide-droplet'
}

export const FISH_KIND_COLORS: Record<FishVariantKind, 'neutral' | 'info' | 'warning'> = {
  common: 'neutral',
  night: 'info',
  rare: 'warning'
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
      { label: `${fishName(species.key, null)} (${t('tools.fishing.merrick.anyVariant')})`, value: `fish:${species.key}` },
      ...species.variants.map(v => ({
        label: v.kind === 'common' ? fishName(species.key, v.key) : `${fishName(species.key, v.key)} · ${t(`tools.fishing.species.kind.${v.kind}`)}`,
        value: `fish:${species.key}:${v.key}`
      }))
    ]),
    [
      { type: 'label' as const, label: t('tools.fishing.merrick.meatGroup') },
      ...MERRICK_MEATS.map(m => ({ label: t(`tools.fishing.merrick.meats.${m}`), value: `meat:${m}` }))
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
    const { data } = await worker.recognize(await preprocessImage(file))
    return parseMerrickMenu(data.text.split('\n'), vocab)
  } finally {
    await worker.terminate()
  }
}

// Agrandit, passe en niveaux de gris et étire le contraste : les captures in-game
// sont souvent sombres (parchemin à l'ombre) et le texte fin.
async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.max(1, 1500 / bitmap.width)
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

  return { recent, remember }
}
