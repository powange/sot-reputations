import { requireApiToken } from '../../utils/api-token'
import { getReleaseNotesWithContent } from '../../utils/release-notes-db'

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie l'intégralité des notes de version (patch notes) avec leur contenu.
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const notes = getReleaseNotesWithContent()

  return {
    count: notes.length,
    releaseNotes: notes
  }
})
