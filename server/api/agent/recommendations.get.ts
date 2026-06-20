import { requireApiToken } from '../../utils/api-token'
import { getReputationDb, getAllGradeThresholdsForEmblems } from '../../utils/reputation-db'

interface RecommendationRow {
  id: number
  nameFr: string
  descriptionFr: string | null
  image: string | null
  maxGrade: number
  factionKey: string
  factionName: string
  campaignKey: string
  campaignName: string
}

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie l'intégralité des recommandations (emblèmes validés) :
 * nom FR, description FR, image, grade max, contexte faction/campagne et seuils de grades.
 * N'inclut aucune donnée de progression utilisateur.
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const db = getReputationDb()

  const rows = db.prepare(`
    SELECT
      e.id,
      e.name AS nameFr,
      e.description AS descriptionFr,
      e.image,
      e.max_grade AS maxGrade,
      f.key AS factionKey,
      f.name AS factionName,
      c.key AS campaignKey,
      c.name AS campaignName
    FROM emblems e
    JOIN campaigns c ON e.campaign_id = c.id
    JOIN factions f ON c.faction_id = f.id
    WHERE e.validated = 1
    ORDER BY f.name, c.sort_order, c.id, e.sort_order, e.id
  `).all() as RecommendationRow[]

  const thresholdsByEmblem = getAllGradeThresholdsForEmblems(rows.map(r => r.id))

  const recommendations = rows.map(row => ({
    nameFr: row.nameFr,
    descriptionFr: row.descriptionFr,
    image: row.image,
    maxGrade: row.maxGrade,
    faction: {
      key: row.factionKey,
      name: row.factionName
    },
    campaign: {
      key: row.campaignKey,
      name: row.campaignName
    },
    gradeThresholds: thresholdsByEmblem[row.id] ?? []
  }))

  return {
    count: recommendations.length,
    recommendations
  }
})
