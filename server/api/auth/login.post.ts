import bcrypt from 'bcrypt'
import { getReputationDb } from '../../utils/reputation-db'
import { createSession, setSessionCookie } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: 'Pseudo et mot de passe requis'
    })
  }

  const db = getReputationDb()
  const user = db.prepare(`
    SELECT id, username, password_hash FROM users WHERE username = ?
  `).get(username) as { id: number, username: string, password_hash: string } | undefined

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Pseudo ou mot de passe incorrect'
    })
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatch) {
    throw createError({
      statusCode: 401,
      message: 'Pseudo ou mot de passe incorrect'
    })
  }

  // Créer une session
  const token = createSession(user.id)
  setSessionCookie(event, token)

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username
    }
  }
})
