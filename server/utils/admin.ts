import type { H3Event } from 'h3'
import { isUserAdmin } from './reputation-db'

export async function requireAdmin(event: H3Event): Promise<{ id: number; username: string }> {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié'
    })
  }

  if (!isUserAdmin(session.user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Accès réservé aux administrateurs'
    })
  }

  return session.user
}
