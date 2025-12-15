import { getGroupByUid, isGroupModerator, deleteGroupInvite } from '../../../utils/reputation-db'

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

  // Seul un chef ou modérateur peut supprimer le lien d'invitation
  if (!isGroupModerator(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Seul un chef ou moderateur peut supprimer le lien d\'invitation'
    })
  }

  deleteGroupInvite(group.id)

  return {
    success: true,
    message: 'Lien d\'invitation supprime'
  }
})
