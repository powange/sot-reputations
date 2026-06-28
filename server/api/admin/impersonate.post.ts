import { requireAdmin } from '../../utils/admin'
import { getReputationDb, isUserAdmin } from '../../utils/reputation-db'

/**
 * POST /api/admin/impersonate  { userId }
 * Démarre une impersonation : la session devient l'utilisateur cible (l'admin perd
 * donc ses droits, requireAdmin se basant sur l'id en session). L'admin d'origine est
 * mémorisé dans la session (impersonatedBy) pour pouvoir revenir.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const session = await getUserSession(event)
  if (session?.user?.impersonatedBy) {
    throw createError({ statusCode: 400, statusMessage: 'Déjà en impersonation — reviens à ton compte d\'abord' })
  }

  const body = await readBody<{ userId?: unknown }>(event)
  const userId = Number(body?.userId)
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'userId invalide' })
  }
  if (userId === admin.id) {
    throw createError({ statusCode: 400, statusMessage: 'Impossible de s\'impersonner soi-même' })
  }

  const db = getReputationDb()
  const target = db.prepare('SELECT id, username, microsoft_id FROM users WHERE id = ?').get(userId) as { id: number, username: string, microsoft_id: string | null } | undefined
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Utilisateur introuvable' })
  }

  console.warn(`[impersonate] admin #${admin.id} (${admin.username}) -> user #${target.id} (${target.username})`)

  // replaceUserSession (et non setUserSession qui deep-merge via defu) : on veut un
  // remplacement net, sinon des champs de l'admin (microsoftId, etc.) fuiteraient.
  await replaceUserSession(event, {
    user: {
      id: target.id,
      username: target.username,
      microsoftId: target.microsoft_id || undefined,
      isAdmin: isUserAdmin(target.id),
      impersonatedBy: { id: admin.id, username: admin.username }
    }
  })

  return { success: true, user: { id: target.id, username: target.username } }
})
