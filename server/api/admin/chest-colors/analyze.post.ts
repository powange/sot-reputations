import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestItemsForColorAnalysis, saveChestItemColors, getChestColorStatus, getAllChestColorSignatures, chestScopeKey } from '../../../utils/reputation-db'
import { classifyDominantColors } from '../../../utils/chest-colors'
import { extractDominantColors } from '../../../utils/chest-colors-extract'
import { fetchChestImage } from '../../../utils/chest-image-fetch'
import { mapLimit } from '../../../utils/map-limit'
import { isWikiImage } from '#shared/utils/wiki-image'

// Lot traité par appel (l'UI rappelle jusqu'à remaining === 0).
const BATCH_SIZE = 30
// Images du wiki : peu de téléchargements simultanés (wiki.gg répond 429 aux rafales).
const WIKI_CONCURRENCY = 2

/**
 * POST /api/admin/chest-colors/analyze
 * Analyse un lot d'items sans couleurs : télécharge l'image, extrait les RGB
 * dominants, les classe en couleurs nommées. Idempotent (ne reprend que les items
 * sans dominant_colors). En cas d'échec, l'item est marqué analysé (couleurs
 * vides) pour ne pas boucler indéfiniment.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const items = getChestItemsForColorAnalysis(BATCH_SIZE)
  // Signatures « décor » par scope (coque de bateau, etc.) à exclure de l'extraction.
  const signatures = getAllChestColorSignatures()

  // Téléchargements en parallèle (CDN officiel) : borne la durée du lot (~ l'image la
  // plus lente) au lieu de la somme, ce qui évite les timeouts de reverse proxy. Images
  // du wiki : par 2, avec nouvelles tentatives sur 429 (cf. fetchChestImage). Chaque item
  // avale entièrement ses erreurs : rien ne rejette (pas de 500 en plein lot).
  const analyze = async (item: typeof items[number]): Promise<'ok' | 'failed'> => {
    try {
      const buf = await fetchChestImage(item.image)
      const excludeBins = signatures.get(chestScopeKey(item.category, item.subcategory))
      const dominant = await extractDominantColors(buf, 4, excludeBins)
      saveChestItemColors(item.id, dominant, classifyDominantColors(dominant))
      return 'ok'
    } catch (err) {
      console.error('[chest-colors] échec analyse item', item.id, err instanceof Error ? err.message : err)
      // Marquer analysé (couleurs vides) pour ne pas reboucler ; si même ça échoue
      // (BDD momentanément indisponible), l'item reste à analyser et sera repris.
      try {
        saveChestItemColors(item.id, [], [])
      } catch { /* repris au prochain lot */ }
      return 'failed'
    }
  }
  const results = (await Promise.all([
    Promise.all(items.filter(it => !isWikiImage(it.image)).map(analyze)),
    mapLimit(items.filter(it => isWikiImage(it.image)), WIKI_CONCURRENCY, analyze)
  ])).flat()

  const processed = results.filter(r => r === 'ok').length
  const failed = results.filter(r => r === 'failed').length

  const status = getChestColorStatus()
  return { processed, failed, ...status, remaining: status.total - status.analyzed }
})
