import { requireAdminOrModerator } from '../../../utils/admin'
import { deleteChestItem } from '../../../utils/reputation-db'

/**
 * DELETE /api/admin/chest-items/:id
 * Supprime un objet du catalogue, avec sa possession par les joueurs et ses traductions.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const res = deleteChestItem(id)
  if (!res) throw createError({ statusCode: 404, statusMessage: 'Objet introuvable' })
  return res
})
