import { requireApiToken } from '../../utils/api-token'
import { getChestCatalog } from '../../utils/reputation-db'

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie l'intégralité du catalogue d'items du coffre (non lié à un
 * utilisateur) : uid, catégorie, sous-catégorie, nom FR, description FR, image.
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const chestItems = getChestCatalog()

  return {
    count: chestItems.length,
    chestItems
  }
})
