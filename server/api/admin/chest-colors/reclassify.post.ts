import { requireAdminOrModerator } from '../../../utils/admin'
import { reclassifyChestColors } from '../../../utils/reputation-db'
import { classifyDominantColors } from '../../../utils/chest-colors'

/**
 * POST /api/admin/chest-colors/reclassify
 * Recalcule les couleurs nommées de tous les items depuis les RGB dominants déjà
 * stockés (sans re-télécharger les images). À utiliser après une modif de la palette.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const reclassified = reclassifyChestColors(classifyDominantColors)
  return { success: true, reclassified }
})
