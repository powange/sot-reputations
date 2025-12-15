import { getGroupByUid, isGroupMember, getGroupMembers, getGroupReputationData } from '../../utils/reputation-db'

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
      statusCode: 403,
      message: 'Acces refuse'
    })
  }

  const members = getGroupMembers(group.id)
  const reputationData = getGroupReputationData(group.id)

  // Trouver le rôle de l'utilisateur actuel
  const currentMember = members.find(m => m.userId === user.id)
  const userRole = currentMember?.role || 'member'

  return {
    group,
    members,
    userRole,
    reputationData
  }
})
