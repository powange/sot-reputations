import { requireAdminOrModerator } from '../../../utils/admin'
import { restoreChestTranslations } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-item-translations/restore  { en, es, apply }
 * Restaure les noms / descriptions EN et ES des objets déjà au catalogue depuis un export
 * du bookmarklet (en = chestEn, es = chestEs). apply = false : aperçu sans écriture.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ en?: unknown, es?: unknown, apply?: unknown }>(event)
  if (!body?.en && !body?.es) {
    throw createError({ statusCode: 400, statusMessage: 'Export sans coffre EN ni ES (chestEn / chestEs)' })
  }
  return restoreChestTranslations({ en: body.en, es: body.es }, body.apply === true)
})
