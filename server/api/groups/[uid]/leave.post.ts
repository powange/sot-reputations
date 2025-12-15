import { getGroupByUid, isGroupMember, isGroupChef, removeGroupMember } from '../../../utils/reputation-db'

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

  // Le chef ne peut pas quitter le groupe, il doit d'abord transférer son rôle ou supprimer le groupe
  if (isGroupChef(group.id, user.id)) {
    throw createError({
      statusCode: 400,
      message: 'Le chef de groupe ne peut pas quitter. Transferez le role de chef a un autre membre ou supprimez le groupe.'
    })
  }

  removeGroupMember(group.id, user.id)

  return { success: true }
})
