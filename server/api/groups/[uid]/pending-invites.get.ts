import { getGroupByUid, isGroupModerator, getPendingInvitesForGroup } from '../../../utils/reputation-db'

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

  const group = getGroupByUid(uid)
  if (!group) {
    throw createError({
      statusCode: 404,
      message: 'Groupe non trouve'
    })
  }

  // Seul un chef ou modérateur peut voir les invitations en attente
  if (!isGroupModerator(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Acces refuse'
    })
  }

  const invites = getPendingInvitesForGroup(group.id)

  return { invites }
})
