import { getGroupByUid, isGroupChef, isGroupMember, getUserById, getMemberRole, setMemberRole, transferChefRole, type GroupRole } from '../../../utils/reputation-db'

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
  const { userId, newRole } = body as { userId: number; newRole: GroupRole }

  if (!userId || typeof userId !== 'number') {
    throw createError({
      statusCode: 400,
      message: 'ID de l\'utilisateur requis'
    })
  }

  if (!newRole || !['chef', 'moderator', 'member'].includes(newRole)) {
    throw createError({
      statusCode: 400,
      message: 'Role invalide'
    })
  }

  const group = getGroupByUid(uid)
  if (!group) {
    throw createError({
      statusCode: 404,
      message: 'Groupe non trouve'
    })
  }

  // Seul le chef peut changer les rôles
  if (!isGroupChef(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Seul le chef de groupe peut modifier les roles'
    })
  }

  // Vérifier que l'utilisateur cible est membre du groupe
  if (!isGroupMember(group.id, userId)) {
    throw createError({
      statusCode: 400,
      message: 'Cet utilisateur n\'est pas membre du groupe'
    })
  }

  // Ne peut pas changer son propre rôle (sauf pour transférer chef)
  if (userId === user.id && newRole !== 'chef') {
    throw createError({
      statusCode: 400,
      message: 'Vous ne pouvez pas changer votre propre role'
    })
  }

  const currentRole = getMemberRole(group.id, userId)
  if (currentRole === newRole) {
    throw createError({
      statusCode: 400,
      message: 'L\'utilisateur a deja ce role'
    })
  }

  const targetUser = getUserById(userId)
  const roleLabels: Record<GroupRole, string> = {
    chef: 'Chef de groupe',
    moderator: 'Moderateur',
    member: 'Membre'
  }

  // Cas spécial : transfert du rôle de chef
  if (newRole === 'chef') {
    transferChefRole(group.id, user.id, userId)
    return {
      success: true,
      message: `${targetUser?.username} est maintenant ${roleLabels[newRole]}. Vous etes maintenant Moderateur.`
    }
  }

  setMemberRole(group.id, userId, newRole)

  return {
    success: true,
    message: `${targetUser?.username} est maintenant ${roleLabels[newRole]}`
  }
})
