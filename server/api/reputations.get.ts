import { getReputationData } from '../utils/reputation-db'

/**
 * GET /api/reputations
 * Catalogue public des réputations (factions / campagnes / emblèmes), SANS
 * progression utilisateur. Données de catalogue, pas d'auth requise.
 */
export default defineEventHandler(() => {
  return getReputationData(null)
})
