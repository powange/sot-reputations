import { getGroupByUid, isGroupModerator, isGroupMember, getUserByUsername, createPendingInvite, hasPendingInvite } from '../../../utils/reputation-db'

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

  // Vérifier que l'utilisateur est chef ou modérateur du groupe
  if (!isGroupModerator(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Seul un chef ou moderateur peut inviter des membres'
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

  // Vérifier qu'il n'a pas déjà une invitation en attente
  if (hasPendingInvite(group.id, invitedUser.id)) {
    throw createError({
      statusCode: 400,
      message: 'Une invitation est deja en attente pour cet utilisateur'
    })
  }

  createPendingInvite(group.id, invitedUser.id, user.id)

  return {
    success: true,
    message: `Invitation envoyee a ${username}`
  }
})
