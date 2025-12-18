import { requireAdmin } from '../../../../utils/admin'
import { setUserAdmin, setUserModerator, getReputationDb } from '../../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  // Seuls les admins peuvent changer les droits
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const body = await readBody<{ role: 'admin' | 'moderator' | 'user' }>(event)
  if (!body.role || !['admin', 'moderator', 'user'].includes(body.role)) {
    throw createError({ statusCode: 400, message: 'Role invalide' })
  }

  const db = getReputationDb()

  // Verifier que l'utilisateur existe
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as { id: number; username: string } | undefined
  if (!user) {
    throw createError({ statusCode: 404, message: 'Utilisateur non trouve' })
  }

  // Mettre a jour les droits
  switch (body.role) {
    case 'admin':
      setUserAdmin(id, true)
      setUserModerator(id, false)
      break
    case 'moderator':
      setUserAdmin(id, false)
      setUserModerator(id, true)
      break
    case 'user':
      setUserAdmin(id, false)
      setUserModerator(id, false)
      break
  }

  return { success: true, message: `${user.username} est maintenant ${body.role}` }
})
