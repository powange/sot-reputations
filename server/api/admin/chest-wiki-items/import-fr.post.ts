import { requireAdminOrModerator } from '../../../utils/admin'
import { importWikiChestFrNames, type WikiFrNameEntry } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-wiki-items/import-fr  { entries: [{ key, nameFr, descriptionFr? }], apply }
 * Noms (et descriptions) français des items « source wiki » en lot, par clé « wiki:<titre> ».
 * apply = false : aperçu sans écriture.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ entries?: unknown, apply?: unknown }>(event)
  const entries = Array.isArray(body?.entries) ? body.entries as WikiFrNameEntry[] : null
  if (!entries) {
    throw createError({ statusCode: 400, statusMessage: 'entries (tableau) requis' })
  }
  if (entries.length > 10000) {
    throw createError({ statusCode: 400, statusMessage: 'Trop d\'entrées (10 000 max.)' })
  }
  return importWikiChestFrNames(entries, body?.apply === true)
})
