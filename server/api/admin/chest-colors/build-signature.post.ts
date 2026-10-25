import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestItemsForScope, saveChestColorSignature, saveChestItemColors, chestScopeKey } from '../../../utils/reputation-db'
import { classifyDominantColors } from '../../../utils/chest-colors'
import { decodeRaw, presentBins, extractFromRaw } from '../../../utils/chest-colors-extract'
import { fetchChestImage } from '../../../utils/chest-image-fetch'
import { mapLimit } from '../../../utils/map-limit'
import { isWikiImage } from '#shared/utils/wiki-image'

// Une couleur doit être présente sur au moins cette fraction d'une image pour compter.
const PRESENT_FRACTION = 0.01
// Bac présent dans au moins cette fraction des images du scope = couleur « décor ».
const SIGNATURE_THRESHOLD = 0.85
// Téléchargements simultanés (borne la pression réseau / sockets). Images du wiki :
// beaucoup moins, wiki.gg répondant 429 aux rafales.
const CONCURRENCY = 12
const WIKI_CONCURRENCY = 2

/**
 * POST /api/admin/chest-colors/build-signature  { category, subcategory }
 * Construit la signature couleur « décor » d'un scope : télécharge une fois toutes ses
 * images, repère les couleurs présentes sur ~tous les items (ex. coque sous les figures
 * de proue), les enregistre comme bacs à exclure, puis ré-extrait les couleurs des items
 * NON édités à la main du scope (les images sont déjà en cache mémoire).
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ category?: unknown, subcategory?: unknown }>(event)
  const category = typeof body?.category === 'string' ? body.category.trim() : ''
  const subcategory = typeof body?.subcategory === 'string' ? body.subcategory : null
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'category requise' })
  }

  const items = getChestItemsForScope(category, subcategory)
  if (items.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Aucun item avec image pour ce scope' })
  }

  // Télécharge + décode une fois (cache mémoire : ~37 Ko/image à 96×96).
  const load = async (item: typeof items[number]) => {
    try {
      const { data, channels } = await decodeRaw(await fetchChestImage(item.image, 20000))
      return { id: item.id, manual: item.manual, data, channels, bins: presentBins(data, channels, PRESENT_FRACTION) }
    } catch {
      return null
    }
  }
  const decoded = (await Promise.all([
    mapLimit(items.filter(it => !isWikiImage(it.image)), CONCURRENCY, load),
    mapLimit(items.filter(it => isWikiImage(it.image)), WIKI_CONCURRENCY, load)
  ])).flat()
  const ok = decoded.filter((d): d is NonNullable<typeof d> => d !== null)
  if (ok.length === 0) {
    throw createError({ statusCode: 502, statusMessage: 'Aucune image téléchargeable pour ce scope' })
  }

  // Fréquence inter-images de chaque bac -> signature (présents dans ~tous les items).
  const freq = new Map<number, number>()
  for (const d of ok) for (const b of d.bins) freq.set(b, (freq.get(b) || 0) + 1)
  const sigBins = [...freq.entries()].filter(([, c]) => c / ok.length >= SIGNATURE_THRESHOLD).map(([k]) => k)
  saveChestColorSignature(chestScopeKey(category, subcategory), sigBins, ok.length)

  // Ré-extrait les couleurs des items non-manuels avec la nouvelle signature.
  const excludeBins = new Set(sigBins)
  let reanalyzed = 0
  let manualSkipped = 0
  for (const d of ok) {
    if (d.manual) {
      manualSkipped++
      continue
    }
    try {
      const dominant = extractFromRaw(d.data, d.channels, 4, excludeBins)
      saveChestItemColors(d.id, dominant, classifyDominantColors(dominant))
      reanalyzed++
    } catch (err) {
      console.error('[chest-colors] ré-analyse signature item', d.id, err instanceof Error ? err.message : err)
    }
  }

  return {
    category,
    subcategory,
    total: items.length,
    sampleCount: ok.length,
    failed: items.length - ok.length,
    binCount: sigBins.length,
    reanalyzed,
    manualSkipped
  }
})
