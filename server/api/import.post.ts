import bcrypt from 'bcrypt'
import { getReputationDb, importReputationData } from '../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, jsonData } = body

  // Vérifier si l'utilisateur est connecté via session
  const sessionUser = event.context.user

  if (!jsonData) {
    throw createError({
      statusCode: 400,
      message: 'jsonData est requis'
    })
  }

  // Valider que jsonData est un objet valide
  if (typeof jsonData !== 'object' || jsonData === null) {
    throw createError({
      statusCode: 400,
      message: 'jsonData doit etre un objet JSON valide'
    })
  }

  const db = getReputationDb()
  let userId: number
  let isNewUser = false

  if (sessionUser) {
    // Utilisateur connecté via session : pas besoin de mot de passe
    userId = sessionUser.id
    db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId)
  } else {
    // Pas de session : username et password requis
    if (!username || !password) {
      throw createError({
        statusCode: 400,
        message: 'Username et password sont requis'
      })
    }

    // Vérifier si l'utilisateur existe
    const existingUser = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as { id: number, password_hash: string } | undefined

    if (existingUser) {
      // Utilisateur existe : vérifier le mot de passe
      const passwordMatch = await bcrypt.compare(password, existingUser.password_hash)
      if (!passwordMatch) {
        throw createError({
          statusCode: 401,
          message: 'Mot de passe incorrect'
        })
      }
      userId = existingUser.id
      db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId)
    } else {
      // Nouvel utilisateur : créer le compte
      const passwordHash = await bcrypt.hash(password, 10)
      const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash)
      userId = Number(result.lastInsertRowid)
      isNewUser = true
    }
  }

  // Importer les données de réputation
  try {
    importReputationData(userId, jsonData)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const isValidationError = message.includes('français') || message.includes('francais')
    throw createError({
      statusCode: isValidationError ? 400 : 500,
      message
    })
  }

  return {
    success: true,
    message: isNewUser ? 'Compte cree et donnees importees avec succes' : 'Donnees mises a jour avec succes',
    userId
  }
})
