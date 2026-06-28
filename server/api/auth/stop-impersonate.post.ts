import { getReputationDb, isUserAdmin } from '../../utils/reputation-db'

/**
 * POST /api/auth/stop-impersonate
 * Met fin à une impersonation : restaure la session de l'admin d'origine (mémorisé
 * dans session.user.impersonatedBy). Ne nécessite pas requireAdmin (la session courante
 * est l'utilisateur impersonné), mais re-vérifie que l'admin d'origine est toujours admin.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const imp = session?.user?.impersonatedBy
  if (!imp) {
    throw createError({ statusCode: 400, statusMessage: 'Aucune impersonation en cours' })
  }

  if (!isUserAdmin(imp.id)) {
    // Sécurité : l'admin d'origine n'est plus admin -> on déconnecte plutôt que restaurer.
    await clearUserSession(event)
    throw createError({ statusCode: 403, statusMessage: 'Compte d\'origine non autorisé' })
  }

  const db = getReputationDb()
  const admin = db.prepare('SELECT id, username, microsoft_id FROM users WHERE id = ?').get(imp.id) as { id: number, username: string, microsoft_id: string | null } | undefined
  if (!admin) {
    await clearUserSession(event)
    throw createError({ statusCode: 404, statusMessage: 'Compte d\'origine introuvable' })
  }

  console.warn(`[impersonate] fin -> retour admin #${admin.id} (${admin.username})`)

  // replaceUserSession (et non setUserSession) : defu conserverait impersonatedBy de
  // la session impersonnée -> la bannière resterait affichée et l'admin ne pourrait
  // plus relancer d'impersonation. On remplace donc la session entièrement.
  await replaceUserSession(event, {
    user: {
      id: admin.id,
      username: admin.username,
      microsoftId: admin.microsoft_id || undefined,
      isAdmin: true
    }
  })

  return { success: true, user: { id: admin.id, username: admin.username } }
})
