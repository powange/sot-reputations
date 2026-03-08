import { requireAdmin } from '../../../utils/admin'
import { getGroupByUid, deleteGroup } from '../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const uid = getRouterParam(event, 'uid')
  if (!uid) {
    throw createError({ statusCode: 400, message: 'UID invalide' })
  }

  const group = getGroupByUid(uid)
  if (!group) {
    throw createError({ statusCode: 404, message: 'Groupe non trouvé' })
  }

  deleteGroup(group.id)

  return { success: true, message: `Groupe "${group.name}" supprimé` }
})
