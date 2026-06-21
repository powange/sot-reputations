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

  return getChestCatalogForUser(userId)
})
