import { getPendingInvitesForUser } from '../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const invites = getPendingInvitesForUser(user.id)

  return invites
})
