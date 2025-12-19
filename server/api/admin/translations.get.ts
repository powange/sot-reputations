import { requireAdminOrModerator } from '../../utils/admin'
import { getReputationDb } from '../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const db = getReputationDb()

  // Récupérer tous les emblèmes validés avec leurs traductions
  const emblems = db.prepare(`
    SELECT
      e.id,
      e.key,
      e.name,
      e.description,
      e.image,
      c.name as campaign_name,
      c.key as campaign_key,
      f.name as faction_name,
      f.key as faction_key
    FROM emblems e
    JOIN campaigns c ON e.campaign_id = c.id
    JOIN factions f ON c.faction_id = f.id
    WHERE e.validated = 1
    ORDER BY f.name, c.sort_order, c.name, e.sort_order, e.name
  `).all() as Array<{
    id: number
    key: string
    name: string
    description: string | null
    image: string | null
    campaign_name: string
    campaign_key: string
    faction_name: string
    faction_key: string
  }>

  // Récupérer toutes les traductions
  const translations = db.prepare(`
    SELECT emblem_id, locale, name, description
    FROM emblem_translations
  `).all() as Array<{
    emblem_id: number
    locale: string
    name: string | null
    description: string | null
  }>

  // Indexer les traductions par emblem_id
  const translationsByEmblem: Record<number, Record<string, { name: string | null; description: string | null }>> = {}
  for (const t of translations) {
    if (!translationsByEmblem[t.emblem_id]) {
      translationsByEmblem[t.emblem_id] = {}
    }
    translationsByEmblem[t.emblem_id][t.locale] = { name: t.name, description: t.description }
  }

  // Ajouter les traductions aux emblèmes
  const result = emblems.map(e => ({
    ...e,
    translations: translationsByEmblem[e.id] || {}
  }))

  return result
})
