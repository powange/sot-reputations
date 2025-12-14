import { getGroupByUid, isGroupMember, isGroupAdmin, getGroupAdminCount, removeGroupMember } from '../../../utils/reputation-db'

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

  // Vérifier que l'utilisateur est membre du groupe
  if (!isGroupMember(group.id, user.id)) {
    throw createError({
      statusCode: 400,
      message: 'Vous n\'etes pas membre de ce groupe'
    })
  }

  // Si l'utilisateur est admin, vérifier qu'il n'est pas le dernier admin
  if (isGroupAdmin(group.id, user.id)) {
    const adminCount = getGroupAdminCount(group.id)
    if (adminCount <= 1) {
      throw createError({
        statusCode: 400,
        message: 'Vous ne pouvez pas quitter le groupe car vous etes le dernier admin. Promouvez un autre membre ou supprimez le groupe.'
      })
    }
  }

  removeGroupMember(group.id, user.id)

  return { success: true }
})
