import bcrypt from 'bcrypt'
import { getReputationDb } from '../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { username, password } = body

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: 'Username et password sont requis'
    })
  }

  const db = getReputationDb()

  // Vérifier si l'utilisateur existe
  const existingUser = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as { id: number, password_hash: string } | undefined

  if (!existingUser) {
    throw createError({
      statusCode: 404,
      message: 'Utilisateur non trouvé'
    })
  }

  // Vérifier le mot de passe
  const passwordMatch = await bcrypt.compare(password, existingUser.password_hash)
  if (!passwordMatch) {
    throw createError({
      statusCode: 401,
      message: 'Mot de passe incorrect'
    })
  }

  // Supprimer les données de l'utilisateur
  const deleteTransaction = db.transaction(() => {
    // Supprimer les user_emblems
    db.prepare('DELETE FROM user_emblems WHERE user_id = ?').run(existingUser.id)
    // Supprimer l'utilisateur
    db.prepare('DELETE FROM users WHERE id = ?').run(existingUser.id)
  })

  deleteTransaction()

  return {
    success: true,
    message: 'Compte et données supprimés avec succès'
  }
})
