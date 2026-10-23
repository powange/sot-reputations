import { requireApiToken } from '../../../../utils/api-token'
import { getRecommendations, renderRecommendationsMarkdown } from '../../../../utils/recommendations-agent'
import { wantsMarkdown, sendMarkdown } from '../../../../utils/api-markdown'

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Recommandations (emblèmes validés) d'une campagne d'une faction.
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const factionKey = getRouterParam(event, 'faction', { decode: true })?.trim() || ''
  const campaignKey = getRouterParam(event, 'campaign', { decode: true })?.trim() || ''
  const recommendations = factionKey && campaignKey ? getRecommendations(factionKey, campaignKey) : []
  if (!recommendations.length) {
    throw createError({ statusCode: 404, message: `Campagne « ${factionKey}/${campaignKey} » introuvable ou sans emblème validé` })
  }

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderRecommendationsMarkdown(recommendations))
  }

  return {
    faction: recommendations[0]!.faction,
    campaign: recommendations[0]!.campaign,
    count: recommendations.length,
    recommendations
  }
})
