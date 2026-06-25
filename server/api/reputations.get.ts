import { getReputationDb, getAllFactions, getAllFactionTranslations, getAllCampaignTranslations, getCampaignsByFaction, getAllGradeThresholdsForEmblems } from '../utils/reputation-db'
import type { FactionInfo, FactionTranslation, CampaignInfo, CampaignTranslation, EmblemInfo } from '../utils/reputation-db'

interface EmblemTranslation {
  name: string | null
  description: string | null
}

/**
 * GET /api/reputations
 * Catalogue public des réputations (factions / campagnes / emblèmes), SANS
 * progression utilisateur. Données de catalogue, pas d'auth requise.
 */
export default defineEventHandler(() => {
  const db = getReputationDb()
  const factions = getAllFactions()
  const factionTranslations = getAllFactionTranslations()
  const campaignTranslations = getAllCampaignTranslations()

  const allTranslations = db.prepare(`
    SELECT emblem_id, locale, name, description FROM emblem_translations
  `).all() as Array<{ emblem_id: number, locale: string, name: string | null, description: string | null }>
  const translationsByEmblem: Record<number, Record<string, EmblemTranslation>> = {}
  for (const t of allTranslations) {
    if (!translationsByEmblem[t.emblem_id]) {
      translationsByEmblem[t.emblem_id] = {}
    }
    translationsByEmblem[t.emblem_id]![t.locale] = { name: t.name, description: t.description }
  }

  const result: {
    user: null
    factions: Array<FactionInfo & {
      translations: Record<string, FactionTranslation>
      campaigns: Array<CampaignInfo & {
        translations: Record<string, CampaignTranslation>
        emblems: Array<EmblemInfo & {
          progress: null
          translations: Record<string, EmblemTranslation>
        }>
      }>
    }>
  } = {
    user: null,
    factions: []
  }

  for (const faction of factions) {
    const campaigns = getCampaignsByFaction(faction.id)
    const factionWithCampaigns: typeof result.factions[0] = {
      ...faction,
      translations: factionTranslations[faction.id] || {},
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

      const emblemIds = emblemRows.map(e => e.id)
      const allGradeThresholds = getAllGradeThresholdsForEmblems(emblemIds)

      const emblems = emblemRows.map(emblem => ({
        ...emblem,
        factionKey: faction.key,
        campaignName: campaign.name,
        gradeThresholds: allGradeThresholds[emblem.id] || [],
        progress: null,
        translations: translationsByEmblem[emblem.id] || {}
      }))

      factionWithCampaigns.campaigns.push({
        ...campaign,
        translations: campaignTranslations[campaign.id] || {},
        emblems
      })
    }

    result.factions.push(factionWithCampaigns)
  }

  return result
})
