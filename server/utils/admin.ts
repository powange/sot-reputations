import type { H3Event } from 'h3'
import { isUserAdmin, isUserAdminOrModerator } from './reputation-db'

export async function requireAdmin(event: H3Event): Promise<{ id: number, username: string }> {
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

/**
 * Bloque une action destructive si la session est une impersonation admin : un admin
 * en « se connecter en tant que » ne doit pas supprimer par mégarde le compte ou les
 * données de l'utilisateur impersonné (et se retrouver déconnecté au passage).
 */
export async function requireNotImpersonating(event: H3Event): Promise<void> {
  const session = await getUserSession(event)
  if (session?.user?.impersonatedBy) {
    throw createError({ statusCode: 403, statusMessage: 'Action désactivée pendant une impersonation' })
  }
}

export async function requireAdminOrModerator(event: H3Event): Promise<{ id: number, username: string }> {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié'
    })
  }

  if (!isUserAdminOrModerator(session.user.id)) {
    throw createError({
      statusCode: 403,
      message: 'Accès réservé aux administrateurs et modérateurs'
    })
  }

  return session.user
}
