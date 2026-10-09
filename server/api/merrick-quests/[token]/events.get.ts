import { getMerrickQuest } from '../../../utils/merrick-db'
import { createSSEStream } from '../../../utils/sse'

// Flux temps réel d'une liste : 'item' (case cochée) et 'quest' (liste modifiée).
export default defineEventHandler((event) => {
  const token = getRouterParam(event, 'token') ?? ''
  if (!getMerrickQuest(token)) {
    throw createError({ statusCode: 404, message: 'Liste introuvable' })
  }

  const connection = createSSEStream(event, `merrick:${token}`)

  const heartbeatInterval = setInterval(() => {
    connection.send('heartbeat', { timestamp: Date.now() })
  }, 30000)

  event.node.req.on('close', () => {
    clearInterval(heartbeatInterval)
  })

  event._handled = true
})
