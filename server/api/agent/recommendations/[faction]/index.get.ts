import { requireApiToken } from '../../../../utils/api-token'
import { getRecommendations, renderRecommendationsMarkdown } from '../../../../utils/recommendations-agent'
import { wantsMarkdown, sendMarkdown } from '../../../../utils/api-markdown'

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Recommandations (emblèmes validés) d'une faction, toutes campagnes confondues.
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const factionKey = getRouterParam(event, 'faction', { decode: true })?.trim() || ''
  const recommendations = factionKey ? getRecommendations(factionKey) : []
  if (!recommendations.length) {
    throw createError({ statusCode: 404, message: `Faction « ${factionKey} » introuvable ou sans emblème validé` })
  }

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderRecommendationsMarkdown(recommendations))
  }

  return {
    faction: recommendations[0]!.faction,
    count: recommendations.length,
    recommendations
  }
})
