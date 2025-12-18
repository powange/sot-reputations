import { requireAdmin } from '../../../../utils/admin'
import { getReputationDb } from '../../../../utils/reputation-db'

interface GradeThreshold {
  grade: number
  threshold: number | null
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const body = await readBody<{ grades: GradeThreshold[] }>(event)
  if (!body.grades || !Array.isArray(body.grades)) {
    throw createError({ statusCode: 400, message: 'Donnees invalides' })
  }

  const db = getReputationDb()

  // Verifier que l'embleme existe
  const emblem = db.prepare('SELECT id FROM emblems WHERE id = ?').get(id)
  if (!emblem) {
    throw createError({ statusCode: 404, message: 'Embleme non trouve' })
  }

  // Supprimer les anciens seuils et inserer les nouveaux dans une transaction
  const deleteStmt = db.prepare('DELETE FROM emblem_grade_thresholds WHERE emblem_id = ?')
  const insertStmt = db.prepare(`
    INSERT INTO emblem_grade_thresholds (emblem_id, grade, threshold)
    VALUES (?, ?, ?)
  `)

  db.transaction(() => {
    deleteStmt.run(id)
    for (const { grade, threshold } of body.grades) {
      if (grade > 0 && threshold && threshold > 0) {
        insertStmt.run(id, grade, threshold)
      }
    }
  })()

  return { success: true }
})
