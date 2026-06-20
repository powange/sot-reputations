import { randomBytes, createHash } from 'crypto'
import type { H3Event } from 'h3'
import { getHeader, createError } from 'h3'
import { getReputationDb } from './reputation-db'

const TOKEN_PREFIX = 'sotr_'
const TOKEN_BYTES = 32

export interface ApiTokenInfo {
  id: number
  name: string
  tokenPrefix: string
  createdBy: number | null
  createdByUsername: string | null
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Liste de colonnes partagée par toutes les lectures de jetons (jamais token_hash).
// Le `WHERE` / `ORDER BY` est ajouté par chaque appelant.
const TOKEN_SELECT = `
  SELECT
    t.id,
    t.name,
    t.token_prefix as tokenPrefix,
    t.created_by as createdBy,
    u.username as createdByUsername,
    t.created_at as createdAt,
    t.last_used_at as lastUsedAt,
    t.revoked_at as revokedAt
  FROM api_tokens t
  LEFT JOIN users u ON u.id = t.created_by
`

/**
 * Crée un nouveau jeton d'API. Le jeton en clair n'est retourné qu'ici (à la
 * création) ; seul son hash est stocké en base.
 */
export function createApiToken(name: string, createdBy: number | null): { token: string, info: ApiTokenInfo } {
  const db = getReputationDb()
  const token = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(token)
  const tokenPrefix = token.slice(0, TOKEN_PREFIX.length + 6)

  const result = db.prepare(`
    INSERT INTO api_tokens (name, token_hash, token_prefix, created_by)
    VALUES (?, ?, ?, ?)
  `).run(name, tokenHash, tokenPrefix, createdBy)

  const info = getApiTokenById(Number(result.lastInsertRowid))!
  return { token, info }
}

export function getApiTokenById(id: number): ApiTokenInfo | null {
  const db = getReputationDb()
  const row = db.prepare(`${TOKEN_SELECT} WHERE t.id = ?`).get(id) as ApiTokenInfo | undefined
  return row ?? null
}

export function listApiTokens(): ApiTokenInfo[] {
  const db = getReputationDb()
  return db.prepare(`
    ${TOKEN_SELECT}
    ORDER BY t.revoked_at IS NOT NULL, t.created_at DESC
  `).all() as ApiTokenInfo[]
}

/** Révoque (désactive) un jeton sans le supprimer, pour conserver l'historique. */
export function revokeApiToken(id: number): boolean {
  const db = getReputationDb()
  const result = db.prepare(`
    UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = ? AND revoked_at IS NULL
  `).run(id)
  return result.changes > 0
}

/** Supprime définitivement un jeton. */
export function deleteApiToken(id: number): boolean {
  const db = getReputationDb()
  const result = db.prepare('DELETE FROM api_tokens WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * Valide un jeton en clair : renvoie le jeton actif correspondant (non révoqué)
 * et met à jour sa date de dernière utilisation, sinon null.
 */
export function validateApiToken(token: string): ApiTokenInfo | null {
  if (!token) return null
  const db = getReputationDb()
  // Le jeton stocké est un hash SHA-256 d'un secret aléatoire à haute entropie :
  // une recherche indexée directe est sûre et efficace (cf. idx_api_tokens_hash).
  const tokenHash = hashToken(token)

  const info = db.prepare(`${TOKEN_SELECT} WHERE t.token_hash = ? AND t.revoked_at IS NULL`)
    .get(tokenHash) as ApiTokenInfo | undefined

  if (!info) return null

  // Mise à jour best-effort de la dernière utilisation : ne doit jamais faire
  // échouer l'authentification si la base est momentanément verrouillée en
  // écriture (import/backup concurrent → SQLITE_BUSY).
  try {
    db.prepare('UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(info.id)
  } catch {
    // ignore : la validation du jeton reste valide même si l'horodatage échoue
  }

  return info
}

/**
 * Exige un jeton d'API valide dans l'en-tête `Authorization: Bearer <token>`.
 * Lève une erreur 401 sinon. À utiliser dans les endpoints réservés aux agents.
 */
export function requireApiToken(event: H3Event): ApiTokenInfo {
  const authHeader = getHeader(event, 'authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()

  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'Jeton d\'API manquant (en-tête Authorization: Bearer <token>)'
    })
  }

  const tokenInfo = validateApiToken(token)
  if (!tokenInfo) {
    throw createError({
      statusCode: 401,
      message: 'Jeton d\'API invalide ou révoqué'
    })
  }

  return tokenInfo
}
