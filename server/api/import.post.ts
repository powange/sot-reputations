import bcrypt from 'bcrypt'
import { getReputationDb, importReputationData } from '../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { username, password, jsonData } = body

  if (!username || !password || !jsonData) {
    throw createError({
      statusCode: 400,
      message: 'Username, password et jsonData sont requis'
    })
  }

  // Valider que jsonData est un objet valide
  if (typeof jsonData !== 'object' || jsonData === null) {
    throw createError({
      statusCode: 400,
      message: 'jsonData doit être un objet JSON valide'
    })
  }

  const db = getReputationDb()

  // Vérifier si l'utilisateur existe
  const existingUser = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as { id: number, password_hash: string } | undefined

  let userId: number

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

    // Mettre à jour updated_at
    db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId)
  } else {
    // Nouvel utilisateur : créer le compte
    const passwordHash = await bcrypt.hash(password, 10)
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash)
    userId = Number(result.lastInsertRowid)
  }

  // Importer les données de réputation
  try {
    importReputationData(userId, jsonData)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    // Erreur de validation (langue) = 400, autres erreurs = 500
    const isValidationError = message.includes('français') || message.includes('francais')
    throw createError({
      statusCode: isValidationError ? 400 : 500,
      message
    })
  }

  return {
    success: true,
    message: existingUser ? 'Données mises à jour avec succès' : 'Compte créé et données importées avec succès',
    userId
  }
})
