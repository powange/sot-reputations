import { requireAdminOrModerator } from '../../../utils/admin'
import { resetChestItemColors, getChestColorStatus } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-colors/reset
 * Remet à zéro les couleurs de tous les items (RGB dominants + noms) pour forcer une
 * ré-extraction complète. À utiliser quand l'algorithme d'extraction a changé : un
 * simple « Re-classer » ne suffit pas, il faut re-télécharger et ré-analyser. L'UI
 * enchaîne ensuite sur la boucle d'analyse habituelle.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const reset = resetChestItemColors()
  const status = getChestColorStatus()
  return { success: true, reset, ...status, remaining: status.total - status.analyzed }
})
