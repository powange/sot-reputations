import { requireAdmin } from '../../../utils/admin'
import { createApiToken } from '../../../utils/api-token'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const body = await readBody<{ name?: string }>(event)
  const name = body?.name?.trim()

  if (!name) {
    throw createError({ statusCode: 400, message: 'Le nom du jeton est requis' })
  }
  if (name.length > 100) {
    throw createError({ statusCode: 400, message: 'Le nom du jeton est trop long (100 caractères max)' })
  }

  // `token` n'est renvoyé qu'ici, à la création : il n'est jamais re-affichable ensuite.
  const { token, info } = createApiToken(name, admin.id)

  return { token, ...info }
})
