import { getGroupByUid, isGroupAdmin, isGroupMember, getUserByUsername, addGroupMember } from '../../../utils/reputation-db'

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
  const { username } = body

  if (!username || typeof username !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Pseudo de l\'utilisateur requis'
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
      message: 'Seul un admin peut inviter des membres'
    })
  }

  // Trouver l'utilisateur à inviter
  const invitedUser = getUserByUsername(username)
  if (!invitedUser) {
    throw createError({
      statusCode: 404,
      message: 'Utilisateur non trouve'
    })
  }

  // Vérifier qu'il n'est pas déjà membre
  if (isGroupMember(group.id, invitedUser.id)) {
    throw createError({
      statusCode: 400,
      message: 'Cet utilisateur est deja membre du groupe'
    })
  }

  addGroupMember(group.id, invitedUser.id, 'member')

  return {
    success: true,
    message: `${username} a ete ajoute au groupe`
  }
})
