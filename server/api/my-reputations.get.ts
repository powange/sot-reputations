import { getReputationDb, getAllFactions, getCampaignsByFaction, getUserProgressForEmblem } from '../utils/reputation-db'
import type { UserInfo, FactionInfo, CampaignInfo, EmblemInfo, UserEmblemProgress } from '../utils/reputation-db'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié'
    })
  }

  const userId = session.user.id
  const db = getReputationDb()

  // Récupérer les infos de l'utilisateur
  const user = db.prepare(`
    SELECT id, username, last_import_at as lastImportAt FROM users WHERE id = ?
  `).get(userId) as UserInfo | undefined

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'Utilisateur non trouvé'
    })
  }

  const factions = getAllFactions()

  const result: {
    user: UserInfo
    factions: Array<FactionInfo & {
      campaigns: Array<CampaignInfo & {
        emblems: Array<EmblemInfo & {
          progress: UserEmblemProgress | null
        }>
      }>
    }>
  } = {
    user,
    factions: []
  }

  for (const faction of factions) {
    const campaigns = getCampaignsByFaction(faction.id)
    const factionWithCampaigns: typeof result.factions[0] = {
      ...faction,
      campaigns: []
    }

    for (const campaign of campaigns) {
      const emblems = db.prepare(`
        SELECT
          id, key, name, description, image, max_grade as maxGrade, campaign_id as campaignId
        FROM emblems
        WHERE campaign_id = ?
        ORDER BY sort_order, id
      `).all(campaign.id) as EmblemInfo[]

      const emblemsWithProgress = emblems.map((emblem) => {
        const progress = db.prepare(`
          SELECT
            user_id as userId,
            value,
            threshold,
            grade,
            completed
          FROM user_emblems
          WHERE emblem_id = ? AND user_id = ?
        `).get(emblem.id, userId) as UserEmblemProgress | undefined

        return {
          ...emblem,
          factionKey: faction.key,
          campaignName: campaign.name,
          progress: progress || null
        }
      })

      factionWithCampaigns.campaigns.push({
        ...campaign,
        emblems: emblemsWithProgress
      })
    }

    result.factions.push(factionWithCampaigns)
  }

  return result
})
