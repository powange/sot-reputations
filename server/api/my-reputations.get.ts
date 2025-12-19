import { getReputationDb, getAllFactions, getCampaignsByFaction, getUserProgressForEmblem, getAllGradeThresholdsForEmblems } from '../utils/reputation-db'
import type { UserInfo, FactionInfo, CampaignInfo, EmblemInfo, UserEmblemProgress } from '../utils/reputation-db'

interface EmblemTranslation {
  name: string | null
  description: string | null
}

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

  // Récupérer toutes les traductions d'emblèmes
  const allTranslations = db.prepare(`
    SELECT emblem_id, locale, name, description FROM emblem_translations
  `).all() as Array<{ emblem_id: number; locale: string; name: string | null; description: string | null }>

  // Indexer par emblem_id
  const translationsByEmblem: Record<number, Record<string, EmblemTranslation>> = {}
  for (const t of allTranslations) {
    if (!translationsByEmblem[t.emblem_id]) {
      translationsByEmblem[t.emblem_id] = {}
    }
    translationsByEmblem[t.emblem_id][t.locale] = { name: t.name, description: t.description }
  }

  const result: {
    user: UserInfo
    factions: Array<FactionInfo & {
      campaigns: Array<CampaignInfo & {
        emblems: Array<EmblemInfo & {
          progress: UserEmblemProgress | null
          translations: Record<string, EmblemTranslation>
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
      const emblemRows = db.prepare(`
        SELECT
          e.id, e.key, e.name, e.description, e.image, e.max_grade as maxGrade,
          e.campaign_id as campaignId,
          (SELECT threshold FROM emblem_grade_thresholds WHERE emblem_id = e.id ORDER BY grade DESC LIMIT 1) as maxThreshold
        FROM emblems e
        WHERE e.campaign_id = ? AND e.validated = 1
        ORDER BY e.sort_order, e.id
      `).all(campaign.id) as Array<Omit<EmblemInfo, 'gradeThresholds' | 'factionKey' | 'campaignName'>>

      // Récupérer tous les seuils de grades pour les emblèmes de cette campagne
      const emblemIds = emblemRows.map(e => e.id)
      const allGradeThresholds = getAllGradeThresholdsForEmblems(emblemIds)

      const emblemsWithProgress = emblemRows.map((emblem) => {
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
          gradeThresholds: allGradeThresholds[emblem.id] || [],
          progress: progress || null,
          translations: translationsByEmblem[emblem.id] || {}
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
