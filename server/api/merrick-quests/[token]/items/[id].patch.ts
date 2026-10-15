import { updateMerrickItem } from '../../../../utils/merrick-db'
import { broadcastToGroup } from '../../../../utils/sse'

// Taille trophée d'un poisson et minuteur de cuisson partagé avec tout l'équipage.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ trophy?: unknown, cooking?: unknown }>(event)
  const trophy = typeof body?.trophy === 'boolean' ? body.trophy : undefined
  const cooking = body?.cooking === 'start' || body?.cooking === 'stop' ? body.cooking : undefined
  if (!Number.isInteger(id) || (trophy === undefined && cooking === undefined)) {
    throw createError({ statusCode: 400, message: 'Requête invalide' })
  }
  const item = updateMerrickItem(token, id, { trophy, cooking })
  if (item === 'not-found') {
    throw createError({ statusCode: 404, message: 'Ingrédient introuvable' })
  }
  if (item === 'invalid') {
    throw createError({ statusCode: 400, message: 'Action impossible pour cet ingrédient' })
  }
  const payload = { ...item, serverTime: Date.now() }
  broadcastToGroup(`merrick:${token}`, 'item', payload)
  return payload
})
