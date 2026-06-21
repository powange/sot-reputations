import { requireAdminOrModerator } from '../../utils/admin'
import { getReputationDb, createFaction } from '../../utils/reputation-db'
import type { FactionTranslationInput } from '../../utils/reputation-db'

interface CreateFactionBody {
  key?: string
  name?: string
  motto?: string | null
  translations?: FactionTranslationInput[]
}

/**
 * POST /api/admin/factions-edition
 * Crée une nouvelle faction (clé + nom/devise FR) avec ses traductions EN/ES.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<CreateFactionBody>(event)
  const key = body?.key?.trim()
  const name = body?.name?.trim()
  const motto = body?.motto?.trim() || null

  if (!key) {
    throw createError({ statusCode: 400, message: 'La clé de la faction est requise' })
  }
  if (!name) {
    throw createError({ statusCode: 400, message: 'Le nom de la faction est requis' })
  }
  if (key.length > 100 || name.length > 200) {
    throw createError({ statusCode: 400, message: 'Clé ou nom trop long' })
  }

  const db = getReputationDb()

  const existing = db.prepare('SELECT id FROM factions WHERE key = ?').get(key)
  if (existing) {
    throw createError({ statusCode: 409, message: 'Une faction avec cette clé existe déjà' })
  }

  const translations = Array.isArray(body?.translations) ? body.translations : []

  const id = createFaction(key, name, motto, translations)

  return { success: true, id }
})
