import { getGroupByUid, isGroupAdmin, isGroupMember, getUserById, promoteToAdmin } from '../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
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

  const body = await readBody(event)
  const { userId } = body

  if (!userId || typeof userId !== 'number') {
    throw createError({
      statusCode: 400,
      message: 'ID de l\'utilisateur requis'
    })
  }

  const group = getGroupByUid(uid)
  if (!group) {
    throw createError({
      statusCode: 404,
      message: 'Groupe non trouve'
    })
  }

  // Vérifier que l'utilisateur courant est admin du groupe
  if (!isGroupAdmin(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Seul un admin peut promouvoir des membres'
    })
  }

  // Vérifier que l'utilisateur à promouvoir est membre du groupe
  if (!isGroupMember(group.id, userId)) {
    throw createError({
      statusCode: 400,
      message: 'Cet utilisateur n\'est pas membre du groupe'
    })
  }

  // Vérifier qu'il n'est pas déjà admin
  if (isGroupAdmin(group.id, userId)) {
    throw createError({
      statusCode: 400,
      message: 'Cet utilisateur est deja admin'
    })
  }

  promoteToAdmin(group.id, userId)

  const promotedUser = getUserById(userId)

  return {
    success: true,
    message: `${promotedUser?.username} est maintenant admin`
  }
})
