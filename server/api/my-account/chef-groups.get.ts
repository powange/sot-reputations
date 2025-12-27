import { getChefGroupsWithMembers } from '../../utils/reputation-db'

export default defineEventHandler((event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const chefGroups = getChefGroupsWithMembers(user.id)

  return {
    chefGroups
  }
})
