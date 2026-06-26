import { getEmblemDetailForUser } from '../../../utils/reputation-db'

/**
 * GET /api/emblems/:id/detail
 * Détail d'un emblème (nom/description localisés, image, paliers de grade) + la
 * progression de l'utilisateur connecté (null si non connecté / pas importé).
 * Pas d'auth requise : sans session, on renvoie le détail sans progression.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'id invalide' })
  }
  const session = await getUserSession(event)
  const userId = (session?.user as { id?: number } | undefined)?.id ?? null
  const localeRaw = String(getQuery(event).locale || 'fr')
  const locale = ['fr', 'en', 'es'].includes(localeRaw) ? localeRaw : 'fr'
  const detail = getEmblemDetailForUser(id, userId, locale)
  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: 'Emblème introuvable' })
  }
  return detail
})
