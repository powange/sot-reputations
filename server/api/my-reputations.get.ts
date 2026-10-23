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
  const userId = session?.user?.id ?? null
  // DIAGNOSTIC TEMPORAIRE (page /reputations bloquée en prod pour un compte connecté) :
  // durée du calcul, taille et erreur éventuelle, visibles dans les logs du conteneur
  const t0 = performance.now()
  try {
    const data = getReputationData(userId)
    const computeMs = Math.round(performance.now() - t0)
    const json = JSON.stringify(data)
    const bytes = Buffer.byteLength(json)
    console.log(`[my-reputations] user=${userId ?? 'public'} calcul=${computeMs}ms json=${Math.round(performance.now() - t0) - computeMs}ms taille=${Math.round(bytes / 1024)}Ko`)
    setResponseHeader(event, 'Content-Type', 'application/json')
    setResponseHeader(event, 'Server-Timing', `calc;dur=${computeMs}`)
    return json
  } catch (err) {
    console.error(`[my-reputations] user=${userId ?? 'public'} ÉCHEC après ${Math.round(performance.now() - t0)}ms :`, err)
    throw err
  }
})
