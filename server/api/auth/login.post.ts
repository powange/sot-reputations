import bcrypt from 'bcrypt'
import { getReputationDb } from '../../utils/reputation-db'

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
    SELECT id, username, password_hash, microsoft_id FROM users WHERE username = ?
  `).get(username) as { id: number, username: string, password_hash: string, microsoft_id: string | null } | undefined

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Pseudo ou mot de passe incorrect'
    })
  }

  // Si l'utilisateur n'a pas de mot de passe (compte Microsoft uniquement)
  if (!user.password_hash) {
    throw createError({
      statusCode: 401,
      message: 'Ce compte utilise la connexion Xbox. Utilisez le bouton "Connexion Xbox".'
    })
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatch) {
    throw createError({
      statusCode: 401,
      message: 'Pseudo ou mot de passe incorrect'
    })
  }

  // Créer une session avec nuxt-auth-utils
  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      microsoftId: user.microsoft_id || undefined
    }
  })

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username
    }
  }
})
