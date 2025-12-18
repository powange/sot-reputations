import { requireAdminOrModerator } from '../../../../utils/admin'
import { getReputationDb } from '../../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const db = getReputationDb()
  const emblem = db.prepare('SELECT id, name FROM emblems WHERE id = ?').get(id) as { id: number; name: string } | undefined
  if (!emblem) {
    throw createError({ statusCode: 404, message: 'Embleme non trouve' })
  }

  db.prepare('UPDATE emblems SET validated = 1 WHERE id = ?').run(id)

  return { success: true, message: `Embleme "${emblem.name}" valide` }
})
