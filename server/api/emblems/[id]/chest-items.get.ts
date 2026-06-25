import { getChestItemsForEmblem } from '../../../utils/reputation-db'

/**
 * GET /api/emblems/:id/chest-items
 * Vue inverse : objets du coffre dont cet emblème (commendation) est un prérequis.
 * Données de catalogue (non spécifiques à un utilisateur) -> pas d'auth requise.
 */
export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'id invalide' })
  }
  return { items: getChestItemsForEmblem(id) }
})
