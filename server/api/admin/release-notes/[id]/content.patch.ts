import { requireAdmin } from '../../../../utils/admin'
import { getReleaseNoteById, updateReleaseNoteContent, updateReleaseNoteDisplayVersion } from '../../../../utils/release-notes-db'

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

  const body = await readBody<{ content?: string, display_version?: string }>(event)

  if (body.display_version !== undefined) {
    updateReleaseNoteDisplayVersion(id, body.display_version)
  }

  if (body.content && typeof body.content === 'string') {
    updateReleaseNoteContent(id, body.content)
  }

  if (!body.content && body.display_version === undefined) {
    throw createError({ statusCode: 400, message: 'Contenu ou version d\'affichage requis' })
  }

  return { success: true }
})
