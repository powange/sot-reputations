import { requireApiToken } from '../../../utils/api-token'
import { getRecommendationsIndex, type RecommendationFactionSummary } from '../../../utils/recommendations-agent'
import { wantsMarkdown, sendMarkdown, mdInline, pushMdHeading } from '../../../utils/api-markdown'

/**
 * Rendu Markdown : une section par faction (nombre d'emblèmes, chemin de son
 * endpoint), ses campagnes en puces avec le leur.
 */
function renderIndexMarkdown(factions: RecommendationFactionSummary[]): string {
  const lines: string[] = []
  const total = factions.reduce((n, f) => n + f.count, 0)
  pushMdHeading(lines, `# Recommandations d'emblèmes (${total})`)
  lines.push('Emblèmes d\'une faction : `GET /api/agent/recommendations/<faction>` ; d\'une campagne : `GET /api/agent/recommendations/<faction>/<campagne>`.')
  for (const f of factions) {
    pushMdHeading(lines, `## ${mdInline(f.name)} (${f.count}) — \`${f.url}\``)
    // Faction sans campagne propre (campagne unique « default ») : rien à détailler.
    if (f.campaigns.length > 1) {
      for (const c of f.campaigns) {
        lines.push(`- ${mdInline(c.name)} (${c.count}) : \`${c.url}\``)
      }
    }
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Sommaire des recommandations (emblèmes validés) : factions et campagnes avec leur
 * nombre d'emblèmes, sans les emblèmes (voir `recommendations/[faction]` et
 * `recommendations/[faction]/[campaign]`).
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const factions = getRecommendationsIndex()

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderIndexMarkdown(factions))
  }

  return {
    count: factions.reduce((n, f) => n + f.count, 0),
    factions
  }
})
