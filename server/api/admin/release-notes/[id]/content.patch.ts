import { requireAdmin } from '../../../../utils/admin'
import { getReleaseNoteById, updateReleaseNoteContent } from '../../../../utils/release-notes-db'

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

  const body = await readBody<{ content: string }>(event)
  if (!body.content || typeof body.content !== 'string') {
    throw createError({ statusCode: 400, message: 'Contenu requis' })
  }

  updateReleaseNoteContent(id, body.content)

  return { success: true }
})
