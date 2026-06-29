import { getReputationData } from '../utils/reputation-db'

/**
 * GET /api/my-reputations
 * Réputations de l'utilisateur connecté (avec progression). Si non connecté, renvoie
 * le catalogue public (user: null) plutôt qu'une 401 : la page /reputations sert les
 * deux modes via cet endpoint et décide « public » selon la présence de `user` —
 * fiable en SSR (le serveur lit la session), sans dépendre du timing client.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  return getReputationData(session?.user?.id ?? null)
})
