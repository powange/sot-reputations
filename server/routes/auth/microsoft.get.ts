import { getQuery, sendRedirect } from 'h3'
import { withQuery } from 'ufo'
import { getReputationDb, isUserAdmin } from '../../utils/reputation-db'

interface XboxUserTokenResponse {
  Token: string
  DisplayClaims: {
    xui: Array<{ uhs: string }>
  }
}

interface XboxXstsResponse {
  Token: string
  DisplayClaims: {
    xui: Array<{ uhs: string; gtg?: string; xid?: string }>
  }
}

async function getXboxGamertag(accessToken: string): Promise<{ gamertag: string; xuid: string } | null> {
  try {
    // Étape 1: Obtenir un Xbox Live User Token
    const userTokenResponse = await $fetch<XboxUserTokenResponse>('https://user.auth.xboxlive.com/user/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-xbl-contract-version': '1'
      },
      body: {
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${accessToken}`
        }
      }
    })

    const userToken = userTokenResponse.Token
    const userHash = userTokenResponse.DisplayClaims.xui[0]?.uhs

    if (!userToken || !userHash) {
      console.error('Xbox: Failed to get user token')
      return null
    }

    // Étape 2: Obtenir un XSTS Token
    const xstsResponse = await $fetch<XboxXstsResponse>('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-xbl-contract-version': '1'
      },
      body: {
        RelyingParty: 'http://xboxlive.com',
        TokenType: 'JWT',
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [userToken]
        }
      }
    })

    // Le gamertag et XUID sont dans la réponse XSTS
    const xui = xstsResponse.DisplayClaims.xui[0]
    if (xui?.gtg && xui?.xid) {
      return { gamertag: xui.gtg, xuid: xui.xid }
    }

    console.error('Xbox: No gamertag in XSTS response')
    return null

  } catch (error) {
    console.error('Xbox API error:', error)
    return null
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)

  const clientId = config.oauth?.microsoft?.clientId
  const clientSecret = config.oauth?.microsoft?.clientSecret

  if (!clientId || !clientSecret) {
    console.error('Missing Microsoft OAuth config')
    return sendRedirect(event, '/?error=oauth')
  }

  const redirectURL = getRequestURL(event).origin + '/auth/microsoft'

  // Étape 1: Rediriger vers Microsoft pour l'auth
  if (!query.code) {
    const authURL = withQuery('https://login.live.com/oauth20_authorize.srf', {
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectURL,
      scope: 'Xboxlive.signin Xboxlive.offline_access'
    })
    return sendRedirect(event, authURL)
  }

  // Étape 2: Échanger le code contre un token
  try {
    const tokenResponse = await $fetch<{
      access_token: string
      refresh_token?: string
      expires_in: number
    }>('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: query.code as string,
        grant_type: 'authorization_code',
        redirect_uri: redirectURL
      }).toString()
    })

    const accessToken = tokenResponse.access_token

    // Étape 3: Récupérer le gamertag Xbox
    const xboxInfo = await getXboxGamertag(accessToken)

    if (!xboxInfo) {
      console.error('Failed to get Xbox gamertag')
      return sendRedirect(event, '/?error=oauth')
    }

    const { gamertag, xuid } = xboxInfo
    console.log('Xbox login successful:', gamertag, xuid)

    // Étape 4: Créer ou mettre à jour l'utilisateur
    const db = getReputationDb()

    let dbUser = db.prepare(`
      SELECT id, username, microsoft_id FROM users WHERE microsoft_id = ?
    `).get(xuid) as { id: number; username: string; microsoft_id: string } | undefined

    if (!dbUser) {
      // Créer un nouvel utilisateur avec le gamertag
      let username = gamertag
      let suffix = 1
      while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
        username = `${gamertag}${suffix}`
        suffix++
      }

      const result = db.prepare(`
        INSERT INTO users (username, password_hash, microsoft_id) VALUES (?, '', ?)
      `).run(username, xuid)

      dbUser = {
        id: Number(result.lastInsertRowid),
        username,
        microsoft_id: xuid
      }
    } else if (dbUser.username !== gamertag) {
      // Mettre à jour le username avec le gamertag si différent
      const existingWithGamertag = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(gamertag, dbUser.id)
      if (!existingWithGamertag) {
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(gamertag, dbUser.id)
        dbUser.username = gamertag
      }
    }

    // Mettre à jour la date de dernière connexion
    db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(dbUser.id)

    // Créer la session
    await setUserSession(event, {
      user: {
        id: dbUser.id,
        username: dbUser.username,
        microsoftId: xuid,
        isAdmin: isUserAdmin(dbUser.id)
      }
    })

    return sendRedirect(event, '/')

  } catch (error) {
    console.error('Microsoft OAuth error:', error)
    return sendRedirect(event, '/?error=oauth')
  }
})
