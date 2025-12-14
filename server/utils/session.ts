import { randomUUID } from 'crypto'
import type { H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie } from 'h3'
import { getReputationDb, type UserInfo } from './reputation-db'

const SESSION_COOKIE_NAME = 'session_token'
const SESSION_DURATION_DAYS = 7

export interface SessionUser {
  id: number
  username: string
}

export function createSession(userId: number): string {
  const db = getReputationDb()
  const token = randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)
  `).run(token, userId, expiresAt.toISOString())

  // Nettoyer les sessions expirées de cet utilisateur
  cleanExpiredSessions()

  return token
}

export function validateSession(token: string): SessionUser | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT s.user_id, u.username
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as { user_id: number, username: string } | undefined

  if (!row) return null

  return {
    id: row.user_id,
    username: row.username
  }
}

export function deleteSession(token: string): void {
  const db = getReputationDb()
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function deleteUserSessions(userId: number): void {
  const db = getReputationDb()
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

export function cleanExpiredSessions(): void {
  const db = getReputationDb()
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run()
}

export function getSessionFromEvent(event: H3Event): SessionUser | null {
  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (!token) return null
  return validateSession(token)
}

export function setSessionCookie(event: H3Event, token: string): void {
  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: '/'
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: '/'
  })
}
