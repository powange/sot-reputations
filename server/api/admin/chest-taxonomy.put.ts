import { requireAdminOrModerator } from '../../utils/admin'
import { setChestTaxonomyTranslations } from '../../utils/reputation-db'
import type { ChestTaxonomyTranslationInput } from '../../utils/reputation-db'

/**
 * PUT /api/admin/chest-taxonomy
 * Enregistre les traductions FR/EN/ES de catégories/sous-catégories.
 * Body: { entries: [{ category, subcategory?, translations: [{locale, name}] }] }
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ entries?: ChestTaxonomyTranslationInput[] }>(event)
  if (!body?.entries || !Array.isArray(body.entries)) {
    throw createError({ statusCode: 400, message: 'entries requis' })
  }

  setChestTaxonomyTranslations(body.entries)

  return { success: true }
})
