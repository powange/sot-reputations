import { deleteUserReputationData } from '../utils/reputation-db'
import { requireNotImpersonating } from '../utils/admin'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  // Pas de suppression des données pendant une impersonation.
  await requireNotImpersonating(event)

  deleteUserReputationData(user.id)

  return {
    success: true,
    message: 'Donnees de reputation supprimees'
  }
})
