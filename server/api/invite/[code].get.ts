import { getInviteByCode, isInviteValid, isGroupMember } from '../../utils/reputation-db'

export default defineEventHandler((event) => {
  const user = event.context.user

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

  // Vérifier si l'utilisateur est déjà membre (si connecté)
  let alreadyMember = false
  if (user) {
    alreadyMember = isGroupMember(invite.groupId, user.id)
  }

  return {
    groupName: invite.groupName,
    groupUid: invite.groupUid,
    alreadyMember,
    isAuthenticated: !!user
  }
})
