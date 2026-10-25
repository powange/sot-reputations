import { requireAdminOrModerator } from '../../../utils/admin'
import { deleteWikiChestItems } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-wiki-items/delete  { ids: number[] }
 * Supprime des items « source wiki » (ex. item retiré du jeu ou page wiki hors coffre).
 * Un item déjà rattaché à un import (devenu « official ») n'est jamais supprimé ici.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ ids?: unknown }>(event)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is number => Number.isInteger(id)) : []

  return { deleted: deleteWikiChestItems(ids) }
})
