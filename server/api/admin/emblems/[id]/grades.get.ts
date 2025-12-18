import { requireAdmin } from '../../../../utils/admin'
import { getEmblemGradeThresholds } from '../../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const thresholds = getEmblemGradeThresholds(id)

  return thresholds.map(t => ({
    grade: t.grade,
    threshold: t.threshold
  }))
})
