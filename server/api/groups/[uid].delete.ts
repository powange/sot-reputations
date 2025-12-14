import { getGroupByUid, isGroupAdmin, deleteGroup } from '../../utils/reputation-db'

export default defineEventHandler((event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const uid = getRouterParam(event, 'uid')
  if (!uid) {
    throw createError({
      statusCode: 400,
      message: 'UID du groupe requis'
    })
  }

  const group = getGroupByUid(uid)
  if (!group) {
    throw createError({
      statusCode: 404,
      message: 'Groupe non trouve'
    })
  }

  // Vérifier que l'utilisateur est admin du groupe
  if (!isGroupAdmin(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Seul un admin peut supprimer le groupe'
    })
  }

  deleteGroup(group.id)

  return { success: true }
})
