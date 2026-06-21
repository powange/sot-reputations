import { requireAdminOrModerator } from '../../../utils/admin'
import { getReputationDb } from '../../../utils/reputation-db'

/**
 * DELETE /api/admin/factions-edition/:id
 * Supprime une faction et ses traductions. Bloqué (409) si la faction possède
 * des campagnes (donc potentiellement des emblèmes / progressions liées) : on
 * ne supprime que des factions vides.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const db = getReputationDb()

  const faction = db.prepare('SELECT id FROM factions WHERE id = ?').get(id)
  if (!faction) {
    throw createError({ statusCode: 404, message: 'Faction non trouvée' })
  }

  const campaignCount = (db.prepare(
    'SELECT COUNT(*) as count FROM campaigns WHERE faction_id = ?'
  ).get(id) as { count: number }).count

  if (campaignCount > 0) {
    throw createError({
      statusCode: 409,
      message: 'Impossible de supprimer : cette faction possède des campagnes/accomplissements'
    })
  }

  // Les FK ne sont pas appliquées (PRAGMA foreign_keys off) : on supprime
  // explicitement les traductions avant la faction.
  const remove = db.transaction(() => {
    db.prepare('DELETE FROM faction_translations WHERE faction_id = ?').run(id)
    db.prepare('DELETE FROM factions WHERE id = ?').run(id)
  })

  remove()

  return { success: true }
})
