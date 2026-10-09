import { getMerrickQuest, sanitizeMerrickDishes, updateMerrickQuest } from '../../../utils/merrick-db'
import { broadcastToGroup } from '../../../utils/sse'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const body = await readBody<{ dishes?: unknown }>(event)
  const dishes = sanitizeMerrickDishes(body?.dishes)
  if (!updateMerrickQuest(token, dishes)) {
    throw createError({ statusCode: 404, message: 'Liste introuvable' })
  }
  const quest = getMerrickQuest(token)!
  broadcastToGroup(`merrick:${token}`, 'quest', quest)
  return quest
})
