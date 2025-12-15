import { getGroupByUid, isGroupModerator, isGroupMember, getUserById, getMemberRole, removeGroupMember } from '../../../utils/reputation-db'

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

  // Vérifier que l'utilisateur courant est chef ou modérateur
  if (!isGroupModerator(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Seul un chef ou moderateur peut retirer des membres'
    })
  }

  // Vérifier que l'utilisateur cible est membre du groupe
  if (!isGroupMember(group.id, userId)) {
    throw createError({
      statusCode: 400,
      message: 'Cet utilisateur n\'est pas membre du groupe'
    })
  }

  // Ne peut pas se retirer soi-même via kick
  if (userId === user.id) {
    throw createError({
      statusCode: 400,
      message: 'Utilisez la fonction "Quitter le groupe" pour vous retirer'
    })
  }

  // Vérifier les permissions selon les rôles
  const currentUserRole = getMemberRole(group.id, user.id)
  const targetUserRole = getMemberRole(group.id, userId)

  // Un modérateur ne peut pas retirer un chef ou un autre modérateur
  if (currentUserRole === 'moderator' && (targetUserRole === 'chef' || targetUserRole === 'moderator')) {
    throw createError({
      statusCode: 403,
      message: 'Un moderateur ne peut retirer que des membres'
    })
  }

  // Le chef ne peut pas être retiré (il doit transférer son rôle ou supprimer le groupe)
  if (targetUserRole === 'chef') {
    throw createError({
      statusCode: 400,
      message: 'Le chef de groupe ne peut pas etre retire'
    })
  }

  const targetUser = getUserById(userId)
  removeGroupMember(group.id, userId)

  return {
    success: true,
    message: `${targetUser?.username} a ete retire du groupe`
  }
})
