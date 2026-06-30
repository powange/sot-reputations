import { requireApiToken } from '../../utils/api-token'
import { getReputationDb, getAllGradeThresholdsForEmblems, type GradeThreshold } from '../../utils/reputation-db'
import { wantsMarkdown, sendMarkdown, mdInline, pushMdHeading } from '../../utils/api-markdown'

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

interface Recommendation {
  nameFr: string
  descriptionFr: string | null
  image: string | null
  maxGrade: number
  faction: { key: string, name: string }
  campaign: { key: string, name: string }
  gradeThresholds: GradeThreshold[]
}

/**
 * Rendu Markdown : titres par faction puis campagne, emblèmes en puces avec
 * grade max, description et seuils de grades. Les emblèmes arrivent déjà triés
 * (faction, campagne, ordre), on émet un titre au changement de clé.
 */
function renderRecommendationsMarkdown(recs: Recommendation[]): string {
  const lines: string[] = []
  pushMdHeading(lines, `# Recommandations d'emblèmes (${recs.length})`)
  let factionKey: string | null = null
  let campaignKey: string | null = null
  for (const r of recs) {
    if (r.faction.key !== factionKey) {
      factionKey = r.faction.key
      campaignKey = null
      pushMdHeading(lines, `## ${r.faction.name}`)
    }
    if (r.campaign.key !== campaignKey) {
      campaignKey = r.campaign.key
      pushMdHeading(lines, `### ${r.campaign.name}`)
    }
    const desc = mdInline(r.descriptionFr)
    lines.push(`- **${mdInline(r.nameFr)}** (grade max : ${r.maxGrade})${desc ? ` — ${desc}` : ''}`)
    if (r.gradeThresholds.length) {
      const seuils = r.gradeThresholds.map(t => `${t.grade} → ${t.threshold}`).join(', ')
      lines.push(`  - Seuils : ${seuils}`)
    }
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie l'intégralité des recommandations (emblèmes validés) :
 * nom FR, description FR, image, grade max, contexte faction/campagne et seuils de grades.
 * N'inclut aucune donnée de progression utilisateur.
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
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

  const recommendations: Recommendation[] = rows.map(row => ({
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

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderRecommendationsMarkdown(recommendations))
  }

  return {
    count: recommendations.length,
    recommendations
  }
})
