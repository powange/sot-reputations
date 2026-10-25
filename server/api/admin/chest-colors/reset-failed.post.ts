import { requireAdminOrModerator } from '../../../utils/admin'
import { resetFailedChestItemColors, getChestColorStatus } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-colors/reset-failed
 * Remet en file les items analysés sans couleur (échec de téléchargement, ex. 429 du
 * wiki). L'UI enchaîne ensuite sur la boucle d'analyse habituelle.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const reset = resetFailedChestItemColors()
  const status = getChestColorStatus()
  return { success: true, reset, ...status, remaining: status.total - status.analyzed }
})
