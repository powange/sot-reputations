import { requireAdminOrModerator } from '../../../utils/admin'
import { mergeChestItems } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-items/merge  { keepId, removeId, apply }
 * Fusionne deux objets : keepId reprend ce qui lui manque et les possesseurs de removeId,
 * qui est supprimé. apply = false : aperçu sans écriture.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const body = await readBody<{ keepId?: unknown, removeId?: unknown, apply?: unknown }>(event)
  const keepId = Number(body?.keepId)
  const removeId = Number(body?.removeId)
  if (!Number.isInteger(keepId) || !Number.isInteger(removeId) || keepId === removeId) {
    throw createError({ statusCode: 400, statusMessage: 'Deux objets distincts sont requis' })
  }
  const res = mergeChestItems(keepId, removeId, body?.apply === true)
  if (!res) throw createError({ statusCode: 404, statusMessage: 'Objet introuvable' })
  return res
})
