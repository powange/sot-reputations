import { createGroup } from '../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const body = await readBody(event)
  const { name } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Nom du groupe requis'
    })
  }

  const group = createGroup(name.trim(), user.id)

  return { success: true, group }
})
