import { requireAdminOrModerator } from '../../../utils/admin'
import { getReputationDb, updateFaction } from '../../../utils/reputation-db'
import type { FactionTranslationInput } from '../../../utils/reputation-db'

interface UpdateFactionBody {
  name?: string
  motto?: string | null
  translations?: FactionTranslationInput[]
}

/**
 * PUT /api/admin/factions-edition/:id
 * Met à jour le nom/devise FR d'une faction et ses traductions EN/ES.
 * La clé n'est pas modifiable (elle sert de jointure aux imports).
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const body = await readBody<UpdateFactionBody>(event)
  const name = body?.name?.trim()
  const motto = body?.motto?.trim() || null

  if (!name) {
    throw createError({ statusCode: 400, message: 'Le nom de la faction est requis' })
  }
  if (name.length > 200) {
    throw createError({ statusCode: 400, message: 'Nom trop long' })
  }

  const db = getReputationDb()

  const faction = db.prepare('SELECT id FROM factions WHERE id = ?').get(id)
  if (!faction) {
    throw createError({ statusCode: 404, message: 'Faction non trouvée' })
  }

  const translations = Array.isArray(body?.translations) ? body.translations : []

  updateFaction(id, name, motto, translations)

  return { success: true }
})
