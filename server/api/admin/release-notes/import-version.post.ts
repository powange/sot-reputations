import { requireAdmin } from '../../../utils/admin'
import { getReleaseNoteByVersion, insertReleaseNote, updateReleaseNoteContent } from '../../../utils/release-notes-db'
import { htmlToMarkdown, RELEASE_NOTES_FETCH_HEADERS } from '../../../utils/release-notes-content'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{ version?: string }>(event)
  const version = body.version?.trim()

  if (!version || !/^\d+(\.\d+){1,3}$/.test(version)) {
    throw createError({ statusCode: 400, message: 'Numéro de version invalide (ex: 3.7.1)' })
  }

  // Récupère le contenu depuis la page officielle de la version
  const url = `https://www.seaofthieves.com/release-notes/${version}`
  let html: string
  try {
    html = await $fetch<string>(url, {
      responseType: 'text',
      headers: RELEASE_NOTES_FETCH_HEADERS
    })
  } catch (err: unknown) {
    throw createError({
      statusCode: 502,
      message: `Impossible de récupérer le contenu depuis ${url}: ${err instanceof Error ? err.message : String(err)}`
    })
  }

  const content = htmlToMarkdown(html)
  if (!content || content.length < 50) {
    throw createError({
      statusCode: 422,
      message: `Aucun contenu trouvé pour la version ${version} (la page existe-t-elle ?)`
    })
  }

  // Évite de dupliquer : si la version existe déjà, on complète son contenu
  const existing = getReleaseNoteByVersion(version)
  if (existing) {
    updateReleaseNoteContent(existing.id, content)
    return {
      success: true,
      created: false,
      id: existing.id,
      version,
      contentLength: content.length
    }
  }

  // Nouvelle version : date inconnue (non exposée sur la page) -> date du jour
  const today = new Date().toISOString().split('T')[0]
  const id = insertReleaseNote(version, today, content)

  return {
    success: true,
    created: true,
    id,
    version,
    contentLength: content.length
  }
})
