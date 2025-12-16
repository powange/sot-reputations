import { deleteUserReputationData } from '../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  deleteUserReputationData(user.id)

  return {
    success: true,
    message: 'Donnees de reputation supprimees'
  }
})
