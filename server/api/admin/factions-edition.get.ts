import { requireAdminOrModerator } from '../../utils/admin'
import { getReputationDb, getAllFactions, getAllFactionTranslations } from '../../utils/reputation-db'

/**
 * GET /api/admin/factions-edition
 * Liste toutes les factions avec leurs traductions EN/ES et le nombre de
 * campagnes liées (pour savoir si la faction est supprimable).
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const db = getReputationDb()
  const factions = getAllFactions()
  const translationsByFaction = getAllFactionTranslations()

  const campaignCounts = db.prepare(`
    SELECT faction_id as factionId, COUNT(*) as count
    FROM campaigns
    GROUP BY faction_id
  `).all() as Array<{ factionId: number, count: number }>

  const countByFaction = new Map(campaignCounts.map(c => [c.factionId, c.count]))

  return factions.map(f => ({
    ...f,
    campaignCount: countByFaction.get(f.id) || 0,
    translations: translationsByFaction[f.id] || {}
  }))
})
