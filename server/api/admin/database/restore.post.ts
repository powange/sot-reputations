import { writeFile, copyFile } from 'fs/promises'
import { requireAdmin } from '../../../utils/admin'
import { DB_PATH, closeReputationDb, getReputationDb } from '../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'Aucun fichier fourni' })
  }

  const file = formData.find(f => f.name === 'database')
  if (!file || !file.data) {
    throw createError({ statusCode: 400, message: 'Fichier database manquant' })
  }

  // Vérifier que c'est un fichier SQLite (magic bytes: "SQLite format 3")
  const header = file.data.slice(0, 16).toString('utf8')
  if (!header.startsWith('SQLite format 3')) {
    throw createError({ statusCode: 400, message: 'Le fichier n\'est pas une base de donnees SQLite valide' })
  }

  // Créer une sauvegarde avant restauration
  const backupPath = `${DB_PATH}.backup-${Date.now()}`
  try {
    await copyFile(DB_PATH, backupPath)
  } catch {
    // Ignorer si le fichier n'existe pas encore
  }

  // Fermer la connexion actuelle
  closeReputationDb()

  // Écrire le nouveau fichier
  try {
    await writeFile(DB_PATH, file.data)
  } catch (err) {
    // En cas d'erreur, essayer de restaurer la sauvegarde
    try {
      await copyFile(backupPath, DB_PATH)
    } catch {
      // Ignorer
    }
    throw createError({ statusCode: 500, message: 'Erreur lors de l\'ecriture du fichier' })
  }

  // Réouvrir la connexion pour vérifier l'intégrité
  try {
    const db = getReputationDb()
    // Vérifier que la base est valide avec une requête simple
    db.prepare('SELECT COUNT(*) FROM users').get()
  } catch {
    // Restaurer la sauvegarde si la base est corrompue
    try {
      closeReputationDb()
      await copyFile(backupPath, DB_PATH)
      getReputationDb()
    } catch {
      // Ignorer
    }
    throw createError({ statusCode: 400, message: 'La base de donnees restauree est invalide ou corrompue' })
  }

  return { success: true, message: 'Base de donnees restauree avec succes' }
})
