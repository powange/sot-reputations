import { getChestCatalogForUser } from '../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userId = (session?.user as { id?: number } | undefined)?.id

  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié'
    })
  }

  // Locale demandée par le client (FR par défaut) pour résoudre les noms d'items.
  const localeRaw = String(getQuery(event).locale || 'fr')
  const locale = ['fr', 'en', 'es'].includes(localeRaw) ? localeRaw : 'fr'

  return getChestCatalogForUser(userId, locale)
})
