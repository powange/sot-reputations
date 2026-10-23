import { requireApiToken } from '../../../utils/api-token'
import { getLatestReleaseNote } from '../../../utils/release-notes-db'
import { sendReleaseNote } from '../../../utils/release-notes-agent'

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie la dernière version publiée avec son contenu.
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const note = getLatestReleaseNote()
  if (!note) {
    throw createError({ statusCode: 404, message: 'Aucune note de version disponible' })
  }

  return sendReleaseNote(event, note)
})
