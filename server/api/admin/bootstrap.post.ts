import { getReputationDb, setUserAdmin } from '../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const db = getReputationDb()

  // Vérifier s'il existe déjà un admin
  const existingAdmin = db.prepare('SELECT id FROM users WHERE is_admin = 1 LIMIT 1').get()
  if (existingAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Un administrateur existe deja. Utilisez l\'interface admin pour gerer les administrateurs.'
    })
  }

  const body = await readBody(event)
  const { username } = body

  if (!username || typeof username !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Username requis'
    })
  }

  // Trouver l'utilisateur
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username) as { id: number; username: string } | undefined

  if (!user) {
    throw createError({
      statusCode: 404,
      message: `Utilisateur "${username}" non trouve`
    })
  }

  // Promouvoir en admin
  setUserAdmin(user.id, true)

  return {
    success: true,
    message: `${user.username} est maintenant administrateur`
  }
})
