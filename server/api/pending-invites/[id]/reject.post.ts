import { getPendingInvite, deletePendingInvite } from '../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const idParam = getRouterParam(event, 'id')
  if (!idParam) {
    throw createError({
      statusCode: 400,
      message: 'ID de l\'invitation requis'
    })
  }

  const inviteId = parseInt(idParam, 10)
  if (isNaN(inviteId)) {
    throw createError({
      statusCode: 400,
      message: 'ID de l\'invitation invalide'
    })
  }

  const invite = getPendingInvite(inviteId)
  if (!invite) {
    throw createError({
      statusCode: 404,
      message: 'Invitation non trouvee'
    })
  }

  // Vérifier que l'utilisateur est bien le destinataire de l'invitation
  if (invite.userId !== user.id) {
    throw createError({
      statusCode: 403,
      message: 'Cette invitation ne vous est pas destinee'
    })
  }

  deletePendingInvite(inviteId)

  return {
    success: true,
    message: 'Invitation refusee'
  }
})
