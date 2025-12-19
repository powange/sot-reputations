import { requireAdminOrModerator } from '../../../../utils/admin'
import { getReputationDb } from '../../../../utils/reputation-db'

interface TranslationInput {
  locale: string
  name?: string | null
  description?: string | null
}

export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const emblemId = getRouterParam(event, 'id')
  if (!emblemId) {
    throw createError({ statusCode: 400, message: 'ID emblème requis' })
  }

  const body = await readBody<{ translations: TranslationInput[] }>(event)
  if (!body?.translations || !Array.isArray(body.translations)) {
    throw createError({ statusCode: 400, message: 'Traductions requises' })
  }

  const db = getReputationDb()

  // Vérifier que l'emblème existe
  const emblem = db.prepare('SELECT id FROM emblems WHERE id = ?').get(emblemId)
  if (!emblem) {
    throw createError({ statusCode: 404, message: 'Emblème non trouvé' })
  }

  // Mettre à jour les traductions
  const upsertStmt = db.prepare(`
    INSERT INTO emblem_translations (emblem_id, locale, name, description)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(emblem_id, locale) DO UPDATE SET
      name = excluded.name,
      description = excluded.description
  `)

  const deleteStmt = db.prepare(`
    DELETE FROM emblem_translations
    WHERE emblem_id = ? AND locale = ?
  `)

  for (const t of body.translations) {
    if (!t.locale || !['en', 'es'].includes(t.locale)) {
      continue
    }

    // Si les deux champs sont vides, supprimer la traduction
    if (!t.name && !t.description) {
      deleteStmt.run(emblemId, t.locale)
    } else {
      upsertStmt.run(emblemId, t.locale, t.name || null, t.description || null)
    }
  }

  return { success: true }
})
