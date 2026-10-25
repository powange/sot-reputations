import { requireAdminOrModerator } from '../../../utils/admin'
import { setWikiChestItemsPublished } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-wiki-items/publish  { ids: number[], published: boolean }
 * Publie (rend visibles dans le coffre public et l'API) ou dépublie des items « source wiki ».
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ ids?: unknown, published?: unknown }>(event)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is number => Number.isInteger(id)) : []
  if (typeof body?.published !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'published (booléen) requis' })
  }

  return { updated: setWikiChestItemsPublished(ids, body.published) }
})
