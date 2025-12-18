import { requireAdminOrModerator } from '../../utils/admin'
import { getReputationDb } from '../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const db = getReputationDb()

  // Récupérer toutes les factions
  const factions = db.prepare(`
    SELECT id, key, name, motto
    FROM factions
    ORDER BY name
  `).all() as Array<{
    id: number
    key: string
    name: string
    motto: string | null
  }>

  // Récupérer toutes les campagnes
  const campaigns = db.prepare(`
    SELECT id, faction_id as factionId, key, name, description, sort_order as sortOrder
    FROM campaigns
    ORDER BY sort_order, name
  `).all() as Array<{
    id: number
    factionId: number
    key: string
    name: string
    description: string | null
    sortOrder: number
  }>

  // Récupérer tous les emblèmes
  const emblems = db.prepare(`
    SELECT id, campaign_id as campaignId, key, name, description, image, max_grade as maxGrade, sort_order as sortOrder
    FROM emblems
    ORDER BY sort_order, name
  `).all() as Array<{
    id: number
    campaignId: number
    key: string
    name: string
    description: string | null
    image: string | null
    maxGrade: number
    sortOrder: number
  }>

  // Compter les progressions par emblème
  const emblemCounts = db.prepare(`
    SELECT emblem_id as emblemId, COUNT(*) as count
    FROM user_emblems
    GROUP BY emblem_id
  `).all() as Array<{ emblemId: number; count: number }>

  const countsByEmblem = new Map(emblemCounts.map(e => [e.emblemId, e.count]))

  // Organiser les emblèmes par campagne
  const emblemsByCampaign = new Map<number, Array<typeof emblems[0] & { userCount: number }>>()
  for (const emblem of emblems) {
    if (!emblemsByCampaign.has(emblem.campaignId)) {
      emblemsByCampaign.set(emblem.campaignId, [])
    }
    emblemsByCampaign.get(emblem.campaignId)!.push({
      ...emblem,
      userCount: countsByEmblem.get(emblem.id) || 0
    })
  }

  // Organiser les campagnes par faction
  const campaignsByFaction = new Map<number, Array<typeof campaigns[0] & { emblems: Array<typeof emblems[0] & { userCount: number }> }>>()
  for (const campaign of campaigns) {
    if (!campaignsByFaction.has(campaign.factionId)) {
      campaignsByFaction.set(campaign.factionId, [])
    }
    campaignsByFaction.get(campaign.factionId)!.push({
      ...campaign,
      emblems: emblemsByCampaign.get(campaign.id) || []
    })
  }

  // Construire la réponse finale
  return factions.map(faction => ({
    ...faction,
    campaigns: campaignsByFaction.get(faction.id) || []
  }))
})
