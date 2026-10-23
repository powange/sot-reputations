import { getReputationDb, getAllGradeThresholdsForEmblems, type GradeThreshold } from './reputation-db'
import { mdInline, pushMdHeading } from './api-markdown'

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

export interface Recommendation {
  nameFr: string
  descriptionFr: string | null
  image: string | null
  maxGrade: number
  faction: { key: string, name: string }
  campaign: { key: string, name: string }
  gradeThresholds: GradeThreshold[]
}

export interface RecommendationCampaignSummary {
  key: string
  name: string
  count: number
  url: string
}

export interface RecommendationFactionSummary {
  key: string
  name: string
  count: number
  url: string
  campaigns: RecommendationCampaignSummary[]
}

/** Chemin de l'endpoint agent d'une faction, ou d'une campagne de cette faction. */
export function recommendationsAgentPath(factionKey: string, campaignKey?: string): string {
  const base = `/api/agent/recommendations/${encodeURIComponent(factionKey)}`
  return campaignKey ? `${base}/${encodeURIComponent(campaignKey)}` : base
}

/**
 * Sommaire des recommandations (emblèmes validés) : factions et leurs campagnes,
 * avec le nombre d'emblèmes et le chemin de l'endpoint qui les détaille.
 */
export function getRecommendationsIndex(): RecommendationFactionSummary[] {
  const rows = getReputationDb().prepare(`
    SELECT f.key AS factionKey, f.name AS factionName, c.key AS campaignKey, c.name AS campaignName, COUNT(e.id) AS count
    FROM emblems e
    JOIN campaigns c ON e.campaign_id = c.id
    JOIN factions f ON c.faction_id = f.id
    WHERE e.validated = 1
    GROUP BY c.id
    ORDER BY f.name, c.sort_order, c.id
  `).all() as Array<Omit<RecommendationRow, 'id' | 'nameFr' | 'descriptionFr' | 'image' | 'maxGrade'> & { count: number }>

  const factions = new Map<string, RecommendationFactionSummary>()
  for (const r of rows) {
    let faction = factions.get(r.factionKey)
    if (!faction) {
      faction = { key: r.factionKey, name: r.factionName, count: 0, url: recommendationsAgentPath(r.factionKey), campaigns: [] }
      factions.set(r.factionKey, faction)
    }
    faction.count += r.count
    faction.campaigns.push({
      key: r.campaignKey,
      name: r.campaignName,
      count: r.count,
      url: recommendationsAgentPath(r.factionKey, r.campaignKey)
    })
  }
  return [...factions.values()]
}

/**
 * Recommandations (emblèmes validés) d'une faction, éventuellement restreintes à
 * une campagne : nom FR, description FR, image, grade max, contexte et seuils de
 * grades. Clés comparées sans tenir compte de la casse. Aucune donnée utilisateur.
 */
export function getRecommendations(factionKey: string, campaignKey?: string): Recommendation[] {
  const rows = getReputationDb().prepare(`
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
      AND LOWER(f.key) = LOWER(?)
      AND (? IS NULL OR LOWER(c.key) = LOWER(?))
    ORDER BY c.sort_order, c.id, e.sort_order, e.id
  `).all(factionKey, campaignKey ?? null, campaignKey ?? null) as RecommendationRow[]

  const thresholdsByEmblem = getAllGradeThresholdsForEmblems(rows.map(r => r.id))

  return rows.map(row => ({
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
}

/**
 * Rendu Markdown d'une faction : titre « # faction », une section par campagne,
 * emblèmes en puces avec grade max, description et seuils de grades.
 *
 * Regroupement explicite par campagne (Map = ordre de première apparition) pour
 * des titres uniques, même si le tri venait à entrelacer les campagnes (cf.
 * fragmentation observée sur le catalogue du coffre).
 */
export function renderRecommendationsMarkdown(recs: Recommendation[]): string {
  const lines: string[] = []
  const faction = recs[0]!.faction
  pushMdHeading(lines, `# Recommandations d'emblèmes — ${mdInline(faction.name)} (${recs.length})`)

  const byCampaign = new Map<string, { name: string, items: Recommendation[] }>()
  for (const r of recs) {
    let campaign = byCampaign.get(r.campaign.key)
    if (!campaign) {
      campaign = { name: r.campaign.name, items: [] }
      byCampaign.set(r.campaign.key, campaign)
    }
    campaign.items.push(r)
  }

  for (const [, campaign] of byCampaign) {
    pushMdHeading(lines, `## ${mdInline(campaign.name)}`)
    for (const r of campaign.items) {
      const desc = mdInline(r.descriptionFr)
      lines.push(`- **${mdInline(r.nameFr)}** (grade max : ${r.maxGrade})${desc ? ` — ${desc}` : ''}`)
      if (r.image) lines.push(`  - Image : ${r.image}`)
      if (r.gradeThresholds.length) {
        const seuils = r.gradeThresholds.map(t => `${t.grade} → ${t.threshold}`).join(', ')
        lines.push(`  - Seuils : ${seuils}`)
      }
    }
  }
  lines.push('')
  return lines.join('\n')
}
