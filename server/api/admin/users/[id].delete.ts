import { requireAdmin } from '../../../utils/admin'
import { getReputationDb, getChefGroupsWithMembers, deleteUserAccount } from '../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  if (id === admin.id) {
    throw createError({ statusCode: 400, message: 'Impossible de supprimer votre propre compte' })
  }

  const db = getReputationDb()
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as { id: number, username: string } | undefined
  if (!user) {
    throw createError({ statusCode: 404, message: 'Utilisateur non trouvé' })
  }

  // Récupérer les groupes où l'utilisateur est chef avec d'autres membres
  const chefGroups = getChefGroupsWithMembers(id)

  // Pour les groupes avec d'autres membres, transférer au premier modérateur ou membre
  const chefTransfers = chefGroups.map(group => ({
    groupId: group.groupId,
    newChefId: group.members[0].userId
  }))

  deleteUserAccount(id, chefTransfers)

  return { success: true, message: `${user.username} supprimé` }
})
