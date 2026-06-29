import { getChestCatalogForUser, getChestCatalogPublic } from '../utils/reputation-db'

/**
 * GET /api/my-chest
 * Coffre de l'utilisateur connecté (possession + co-membres). Si non connecté, renvoie
 * le catalogue public plutôt qu'une 401 : la page /chest sert les deux modes via cet
 * endpoint et décide « public » selon `authenticated` — fiable en SSR.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as { id?: number } | undefined)?.id ?? null

  // Locale demandée par le client (FR par défaut) pour résoudre les noms d'items.
  const localeRaw = String(getQuery(event).locale || 'fr')
  const locale = ['fr', 'en', 'es'].includes(localeRaw) ? localeRaw : 'fr'

  const items = userId ? getChestCatalogForUser(userId, locale) : getChestCatalogPublic(locale)
  return { authenticated: !!userId, items }
})
