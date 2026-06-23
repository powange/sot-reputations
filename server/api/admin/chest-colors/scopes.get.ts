import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestScopes } from '../../../utils/reputation-db'

/**
 * GET /api/admin/chest-colors/scopes
 * Liste les scopes (catégorie / sous-catégorie) présents et l'état de leur signature
 * couleur « décor » (pour le sélecteur de l'admin).
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  return { scopes: getChestScopes() }
})
