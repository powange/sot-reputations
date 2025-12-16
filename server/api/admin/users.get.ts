import { requireAdmin } from '../../utils/admin'
import { getReputationDb } from '../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = getReputationDb()

  // Récupérer tous les utilisateurs
  const users = db.prepare(`
    SELECT
      id,
      username,
      is_admin as isAdmin,
      microsoft_id as microsoftId,
      created_at as createdAt,
      last_import_at as lastImportAt
    FROM users
    ORDER BY username
  `).all() as Array<{
    id: number
    username: string
    isAdmin: number
    microsoftId: string | null
    createdAt: string
    lastImportAt: string | null
  }>

  // Récupérer les groupes de chaque utilisateur
  const userGroups = db.prepare(`
    SELECT
      gm.user_id as userId,
      g.uid,
      g.name,
      gm.role
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    ORDER BY g.name
  `).all() as Array<{
    userId: number
    uid: string
    name: string
    role: string
  }>

  // Associer les groupes aux utilisateurs
  const groupsByUser = new Map<number, Array<{ uid: string; name: string; role: string }>>()
  for (const group of userGroups) {
    if (!groupsByUser.has(group.userId)) {
      groupsByUser.set(group.userId, [])
    }
    groupsByUser.get(group.userId)!.push({
      uid: group.uid,
      name: group.name,
      role: group.role
    })
  }

  return users.map(user => ({
    ...user,
    isAdmin: user.isAdmin === 1,
    groups: groupsByUser.get(user.id) || []
  }))
})
