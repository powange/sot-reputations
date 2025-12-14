import { getGroupsByUserId } from '../../utils/reputation-db'

export default defineEventHandler((event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const groups = getGroupsByUserId(user.id)

  return { groups }
})
