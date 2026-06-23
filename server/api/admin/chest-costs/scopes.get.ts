import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestCostScopes } from '../../../utils/reputation-db'

/**
 * GET /api/admin/chest-costs/scopes
 * Liste les scopes (catégorie / sous-catégorie) avec le total d'items et combien ont
 * déjà un coût (pour le sélecteur de l'admin).
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  return { scopes: getChestCostScopes() }
})
