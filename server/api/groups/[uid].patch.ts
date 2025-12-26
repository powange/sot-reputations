import { getGroupByUid, isGroupChef, updateGroupName } from '../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifie'
    })
  }

  const uid = getRouterParam(event, 'uid')
  if (!uid) {
    throw createError({
      statusCode: 400,
      message: 'UID du groupe requis'
    })
  }

  const group = getGroupByUid(uid)
  if (!group) {
    throw createError({
      statusCode: 404,
      message: 'Groupe non trouve'
    })
  }

  // Seul le chef peut modifier le groupe
  if (!isGroupChef(group.id, user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Seul le chef de groupe peut modifier le groupe'
    })
  }

  const body = await readBody(event)
  const { name } = body

  if (!name || typeof name !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Nom du groupe requis'
    })
  }

  const trimmedName = name.trim()
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    throw createError({
      statusCode: 400,
      message: 'Le nom du groupe doit contenir entre 2 et 50 caracteres'
    })
  }

  updateGroupName(group.id, trimmedName)

  return { success: true, name: trimmedName }
})
