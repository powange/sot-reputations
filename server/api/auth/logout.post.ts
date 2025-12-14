import { getCookie } from 'h3'
import { deleteSession, clearSessionCookie } from '../../utils/session'

export default defineEventHandler((event) => {
  const token = getCookie(event, 'session_token')

  if (token) {
    deleteSession(token)
  }

  clearSessionCookie(event)

  return { success: true }
})
