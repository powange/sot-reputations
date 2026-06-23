import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestItemsForColorAnalysis, saveChestItemColors, getChestColorStatus, getAllChestColorSignatures, chestScopeKey } from '../../../utils/reputation-db'
import { classifyDominantColors } from '../../../utils/chest-colors'
import { extractDominantColors } from '../../../utils/chest-colors-extract'

// Lot traité par appel (l'UI rappelle jusqu'à remaining === 0).
const BATCH_SIZE = 30

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

  // Téléchargements en parallèle : borne la durée du lot (~ l'image la plus lente)
  // au lieu de la somme, ce qui évite les timeouts de reverse proxy. Chaque item
  // avale entièrement ses erreurs : Promise.all ne rejette jamais (pas de 500 en
  // plein lot).
  const results = await Promise.all(items.map(async (item): Promise<'ok' | 'failed'> => {
    try {
      const res = await fetch(item.image, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
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
  }))

  const processed = results.filter(r => r === 'ok').length
  const failed = results.filter(r => r === 'failed').length

  const status = getChestColorStatus()
  return { processed, failed, ...status, remaining: status.total - status.analyzed }
})
