import { getChestCatalogPublic } from '../utils/reputation-db'

/**
 * GET /api/chest
 * Catalogue public du coffre (sans données utilisateur). Données de catalogue,
 * pas d'auth requise. `locale` (fr/en/es) résout les noms d'items.
 */
export default defineEventHandler((event) => {
  const localeRaw = String(getQuery(event).locale || 'fr')
  const locale = ['fr', 'en', 'es'].includes(localeRaw) ? localeRaw : 'fr'
  return getChestCatalogPublic(locale)
})
