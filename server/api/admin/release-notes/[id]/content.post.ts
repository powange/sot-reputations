import { requireAdmin } from '../../../../utils/admin'
import { getReleaseNoteById, updateReleaseNoteContent } from '../../../../utils/release-notes-db'
import { htmlToMarkdown, RELEASE_NOTES_FETCH_HEADERS } from '../../../../utils/release-notes-content'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const note = getReleaseNoteById(id)
  if (!note) {
    throw createError({ statusCode: 404, message: 'Release note non trouvée' })
  }

  // Fetch le contenu depuis le site SoT
  const url = `https://www.seaofthieves.com/release-notes/${note.display_version || note.version}`
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
      message: 'Le contenu récupéré semble vide ou trop court'
    })
  }

  updateReleaseNoteContent(id, content)

  return {
    success: true,
    contentLength: content.length
  }
})
