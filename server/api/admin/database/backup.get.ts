import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { join } from 'path'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const dbPath = join('/app/data', 'reputation.db')

  // Vérifier que le fichier existe
  try {
    await stat(dbPath)
  } catch {
    throw createError({ statusCode: 404, message: 'Base de donnees introuvable' })
  }

  // Nom du fichier avec date
  const date = new Date().toISOString().split('T')[0]
  const filename = `sot-reputations-backup-${date}.db`

  // Headers pour le téléchargement
  setHeader(event, 'Content-Type', 'application/octet-stream')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

  return sendStream(event, createReadStream(dbPath))
})
