import { requireAdminOrModerator } from '../../utils/admin'
import { setChestItemTranslations } from '../../utils/reputation-db'
import type { ChestItemTranslationInput } from '../../utils/reputation-db'

/**
 * PUT /api/admin/chest-item-translations
 * Enregistre les traductions EN/ES de noms d'items du coffre.
 * Body: { entries: [{ itemKey, translations: [{locale, name}] }] }
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ entries?: ChestItemTranslationInput[] }>(event)
  if (!body?.entries || !Array.isArray(body.entries)) {
    throw createError({ statusCode: 400, message: 'entries requis' })
  }

  setChestItemTranslations(body.entries)

  return { success: true }
})
