import { getGroupByUid, isGroupMember } from '../../../utils/reputation-db'
import { createSSEStream } from '../../../utils/sse'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const uid = getRouterParam(event, 'uid')
  if (!uid) {
    throw createError({
      statusCode: 400,
      message: 'UID du groupe requis'
    })
  }

  const group = getGroupByUid(uid)
  if (!group) {
    throw createError({
      statusCode: 404,
      message: 'Groupe non trouve'
    })
  }

  // Vérifier que l'utilisateur est membre du groupe
  if (!isGroupMember(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Acces refuse'
    })
  }

  // Créer la connexion SSE
  const connection = createSSEStream(event, uid)

  // Garder la connexion ouverte
  // Le client recevra les événements via connection.send()
  // La connexion se fermera quand le client se déconnecte

  // Envoyer un heartbeat toutes les 30 secondes pour garder la connexion active
  const heartbeatInterval = setInterval(() => {
    connection.send('heartbeat', { timestamp: Date.now() })
  }, 30000)

  // Nettoyer l'interval quand la connexion se ferme
  event.node.req.on('close', () => {
    clearInterval(heartbeatInterval)
  })

  // Ne pas fermer la réponse - SSE reste ouvert
  event._handled = true
})
