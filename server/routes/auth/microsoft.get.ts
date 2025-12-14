import { getReputationDb } from '../../utils/reputation-db'

export default defineOAuthMicrosoftEventHandler({
  config: {
    scope: ['openid', 'profile', 'email', 'User.Read']
  },
  async onSuccess(event, { user: microsoftUser }) {
    const db = getReputationDb()

    // Récupérer l'email ou le nom comme identifiant
    const email = microsoftUser.mail || microsoftUser.userPrincipalName
    const displayName = microsoftUser.displayName || email?.split('@')[0] || 'Pirate'

    // Chercher si l'utilisateur existe déjà (par microsoft_id ou email)
    let dbUser = db.prepare(`
      SELECT id, username, microsoft_id FROM users WHERE microsoft_id = ?
    `).get(microsoftUser.id) as { id: number, username: string, microsoft_id: string } | undefined

    if (!dbUser && email) {
      // Chercher par email (pour lier un compte existant)
      dbUser = db.prepare(`
        SELECT id, username, microsoft_id FROM users WHERE username = ?
      `).get(email) as { id: number, username: string, microsoft_id: string } | undefined

      if (dbUser && !dbUser.microsoft_id) {
        // Lier le compte Microsoft à l'utilisateur existant
        db.prepare('UPDATE users SET microsoft_id = ? WHERE id = ?').run(microsoftUser.id, dbUser.id)
      }
    }

    if (!dbUser) {
      // Créer un nouvel utilisateur
      // Utiliser le displayName comme username, avec un suffixe si déjà pris
      let username = displayName
      let suffix = 1
      while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
        username = `${displayName}${suffix}`
        suffix++
      }

      const result = db.prepare(`
        INSERT INTO users (username, password_hash, microsoft_id) VALUES (?, '', ?)
      `).run(username, microsoftUser.id)

      dbUser = {
        id: Number(result.lastInsertRowid),
        username,
        microsoft_id: microsoftUser.id
      }
    }

    // Mettre à jour la date de dernière connexion
    db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(dbUser.id)

    // Créer la session avec nuxt-auth-utils
    await setUserSession(event, {
      user: {
        id: dbUser.id,
        username: dbUser.username,
        microsoftId: microsoftUser.id
      }
    })

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Microsoft OAuth error:', error)
    return sendRedirect(event, '/?error=oauth')
  }
})
