import { getGroupByUid, isGroupModerator, getPendingInvite, deletePendingInvite } from '../../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const uid = getRouterParam(event, 'uid')
  const idParam = getRouterParam(event, 'id')

  if (!uid || !idParam) {
    throw createError({
      statusCode: 400,
      message: 'Parametres requis'
    })
  }

  const inviteId = parseInt(idParam, 10)
  if (isNaN(inviteId)) {
    throw createError({
      statusCode: 400,
      message: 'ID invalide'
    })
  }

  const group = getGroupByUid(uid)
  if (!group) {
    throw createError({
      statusCode: 404,
      message: 'Groupe non trouve'
    })
  }

  // Seul un chef ou modérateur peut annuler une invitation
  if (!isGroupModerator(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Acces refuse'
    })
  }

  const invite = getPendingInvite(inviteId)
  if (!invite || invite.groupId !== group.id) {
    throw createError({
      statusCode: 404,
      message: 'Invitation non trouvee'
    })
  }

  deletePendingInvite(inviteId)

  return {
    success: true,
    message: 'Invitation annulee'
  }
})
