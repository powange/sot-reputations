import { requireAdminOrModerator } from '../../../../utils/admin'
import { getReputationDb } from '../../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const emblemId = getRouterParam(event, 'id')
  if (!emblemId) {
    throw createError({ statusCode: 400, message: 'ID emblème requis' })
  }

  const db = getReputationDb()

  // Récupérer les traductions existantes
  const translations = db.prepare(`
    SELECT locale, name, description
    FROM emblem_translations
    WHERE emblem_id = ?
  `).all(emblemId) as Array<{ locale: string; name: string | null; description: string | null }>

  // Convertir en objet par locale
  const result: Record<string, { name: string | null; description: string | null }> = {}
  for (const t of translations) {
    result[t.locale] = { name: t.name, description: t.description }
  }

  return result
})
