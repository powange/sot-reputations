import { deleteCompletedMerrickQuest } from '../../../utils/merrick-db'
import { broadcastToGroup } from '../../../utils/sse'

export default defineEventHandler((event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const result = deleteCompletedMerrickQuest(token)
  if (result === 'not-found') {
    throw createError({ statusCode: 404, message: 'Liste introuvable' })
  }
  if (result === 'incomplete') {
    throw createError({ statusCode: 409, message: 'La liste n\'est pas entièrement livrée' })
  }
  broadcastToGroup(`merrick:${token}`, 'deleted', {})
  return { deleted: true }
})
