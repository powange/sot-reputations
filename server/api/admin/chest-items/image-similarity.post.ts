import { requireAdminOrModerator } from '../../../utils/admin'
import { compareChestImages } from '../../../utils/chest-image-similarity'
import { getReputationDb } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-items/image-similarity  { aId, bId }
 * Score de correspondance (0-100 %) entre les images de deux objets, pour la fusion.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const body = await readBody<{ aId?: unknown, bId?: unknown }>(event)
  const get = getReputationDb().prepare('SELECT image FROM chest_items WHERE id = ?')
  const a = get.get(Number(body?.aId)) as { image: string | null } | undefined
  const b = get.get(Number(body?.bId)) as { image: string | null } | undefined
  if (!a?.image || !b?.image) throw createError({ statusCode: 404, statusMessage: 'Image manquante' })
  try {
    return await compareChestImages(a.image, b.image)
  } catch (err) {
    throw createError({ statusCode: 502, statusMessage: `Image inaccessible (${err instanceof Error ? err.message : 'erreur'})` })
  }
})
