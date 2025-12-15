import { getGroupByUid, isGroupModerator, getGroupInvite, createGroupInvite, deleteGroupInvite } from '../../../utils/reputation-db'

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

  // Seul un chef ou modérateur peut créer un lien d'invitation
  if (!isGroupModerator(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Seul un chef ou moderateur peut creer un lien d\'invitation'
    })
  }

  // Supprimer l'ancien lien s'il existe
  const existingInvite = getGroupInvite(group.id)
  if (existingInvite) {
    deleteGroupInvite(group.id)
  }

  // Créer un nouveau lien (sans expiration ni limite d'utilisation par défaut)
  const invite = createGroupInvite(group.id, user.id)

  return {
    success: true,
    invite
  }
})
