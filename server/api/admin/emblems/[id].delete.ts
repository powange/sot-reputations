import { requireAdminOrModerator } from '../../../utils/admin'
import { getReputationDb } from '../../../utils/reputation-db'

/**
 * DELETE /api/admin/emblems/:id
 * Supprime un emblème (accomplissement) et toutes ses données liées : seuils de
 * grades, traductions et progressions des joueurs. Utile pour nettoyer les
 * doublons créés par certains imports.
 *
 * Les FK ne sont pas appliquées (PRAGMA foreign_keys off) : on supprime
 * explicitement les lignes liées avant l'emblème.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const db = getReputationDb()

  const emblem = db.prepare('SELECT id, name FROM emblems WHERE id = ?').get(id) as { id: number, name: string } | undefined
  if (!emblem) {
    throw createError({ statusCode: 404, message: 'Emblème non trouvé' })
  }

  const remove = db.transaction(() => {
    db.prepare('DELETE FROM emblem_grade_thresholds WHERE emblem_id = ?').run(id)
    db.prepare('DELETE FROM emblem_translations WHERE emblem_id = ?').run(id)
    db.prepare('DELETE FROM user_emblems WHERE emblem_id = ?').run(id)
    db.prepare('DELETE FROM emblems WHERE id = ?').run(id)
  })

  remove()

  return { success: true, message: `Emblème "${emblem.name}" supprimé` }
})
