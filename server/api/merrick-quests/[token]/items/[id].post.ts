import { stepMerrickItem } from '../../../../utils/merrick-db'
import { broadcastToGroup } from '../../../../utils/sse'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ delta?: number }>(event)
  if (!Number.isInteger(id) || (body?.delta !== 1 && body?.delta !== -1)) {
    throw createError({ statusCode: 400, message: 'Requête invalide' })
  }
  const item = stepMerrickItem(token, id, body.delta)
  if (!item) {
    throw createError({ statusCode: 404, message: 'Ingrédient introuvable' })
  }
  broadcastToGroup(`merrick:${token}`, 'item', item)
  return item
})
