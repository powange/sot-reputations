import { requireApiToken } from '../../../utils/api-token'
import { getPublishedReleaseNote } from '../../../utils/release-notes-db'
import { sendReleaseNote } from '../../../utils/release-notes-agent'

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie le contenu d'une version (numéro interne ou affiché, ex. `3.9.1`).
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const version = getRouterParam(event, 'version', { decode: true })?.trim() || ''
  const note = version ? getPublishedReleaseNote(version) : undefined
  if (!note) {
    throw createError({ statusCode: 404, message: `Version « ${version} » introuvable ou sans contenu` })
  }

  return sendReleaseNote(event, note)
})
