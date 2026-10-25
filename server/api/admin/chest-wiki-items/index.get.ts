import { requireAdminOrModerator } from '../../../utils/admin'
import { getWikiChestItems } from '../../../utils/reputation-db'

/**
 * GET /api/admin/chest-wiki-items
 * Items du coffre créés depuis le wiki (publiés ou non), pour la page de publication.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  return getWikiChestItems()
})
