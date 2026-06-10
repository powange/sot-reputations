import { requireAdmin } from '../../../../utils/admin'
import { getReleaseNoteById, updateReleaseNoteContent, updateReleaseNoteDisplayVersion, updateReleaseNoteDate } from '../../../../utils/release-notes-db'

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

  const body = await readBody<{ content?: string, display_version?: string, date?: string }>(event)

  if (body.display_version !== undefined) {
    updateReleaseNoteDisplayVersion(id, body.display_version)
  }

  if (body.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw createError({ statusCode: 400, message: 'Date invalide (format attendu: AAAA-MM-JJ)' })
    }
    updateReleaseNoteDate(id, body.date)
  }

  if (body.content && typeof body.content === 'string') {
    updateReleaseNoteContent(id, body.content)
  }

  if (!body.content && body.display_version === undefined && body.date === undefined) {
    throw createError({ statusCode: 400, message: 'Contenu, version d\'affichage ou date requis' })
  }

  return { success: true }
})
