import { getInviteByCode, isInviteValid, isGroupMember, addGroupMember, useInvite } from '../../utils/reputation-db'

export default defineEventHandler((event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Vous devez etre connecte pour rejoindre un groupe'
    })
  }

  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({
      statusCode: 400,
      message: 'Code d\'invitation requis'
    })
  }

  const invite = getInviteByCode(code)
  if (!invite) {
    throw createError({
      statusCode: 404,
      message: 'Invitation non trouvee'
    })
  }

  if (!isInviteValid(invite)) {
    throw createError({
      statusCode: 410,
      message: 'Cette invitation a expire ou n\'est plus valide'
    })
  }

  // Vérifier si l'utilisateur est déjà membre
  if (isGroupMember(invite.groupId, user.id)) {
    throw createError({
      statusCode: 400,
      message: 'Vous etes deja membre de ce groupe'
    })
  }

  // Ajouter l'utilisateur au groupe
  addGroupMember(invite.groupId, user.id, 'member')

  // Incrémenter le compteur d'utilisation
  useInvite(invite.id)

  return {
    success: true,
    message: `Vous avez rejoint le groupe "${invite.groupName}"`,
    groupUid: invite.groupUid
  }
})
