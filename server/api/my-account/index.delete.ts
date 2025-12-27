import { deleteUserAccount, getChefGroupsWithMembers } from '../../utils/reputation-db'

interface DeleteAccountBody {
  chefTransfers?: Array<{ groupId: number; newChefId: number }>
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const body = await readBody<DeleteAccountBody>(event)
  const chefTransfers = body?.chefTransfers || []

  // Vérifier que tous les groupes dont l'utilisateur est chef ont un nouveau chef désigné
  const chefGroups = getChefGroupsWithMembers(user.id)

  for (const group of chefGroups) {
    const transfer = chefTransfers.find(t => t.groupId === group.groupId)
    if (!transfer) {
      throw createError({
        statusCode: 400,
        message: `Vous devez designer un nouveau chef pour le groupe "${group.groupName}"`
      })
    }

    // Vérifier que le nouveau chef est bien membre du groupe
    const isValidMember = group.members.some(m => m.userId === transfer.newChefId)
    if (!isValidMember) {
      throw createError({
        statusCode: 400,
        message: `Le nouveau chef designe pour "${group.groupName}" n'est pas membre du groupe`
      })
    }
  }

  // Supprimer le compte
  deleteUserAccount(user.id, chefTransfers)

  // Effacer la session
  await clearUserSession(event)

  return {
    success: true,
    message: 'Compte supprime avec succes'
  }
})
