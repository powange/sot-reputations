import { requireAdmin } from '../../../utils/admin'
import { getApiTokenById, revokeApiToken, deleteApiToken } from '../../../utils/api-token'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const token = getApiTokenById(id)
  if (!token) {
    throw createError({ statusCode: 404, message: 'Jeton non trouvé' })
  }

  // ?hard=true supprime définitivement, sinon on révoque (conserve l'historique)
  const hard = getQuery(event).hard === 'true'

  if (hard) {
    deleteApiToken(id)
    return { success: true, deleted: true }
  }

  if (token.revokedAt) {
    throw createError({ statusCode: 409, message: 'Jeton déjà révoqué' })
  }

  revokeApiToken(id)
  return { success: true, revoked: true }
})
