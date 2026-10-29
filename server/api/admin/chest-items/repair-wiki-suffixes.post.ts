import { requireAdminOrModerator } from '../../../utils/admin'
import { repairWikiTypeSuffixes } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-items/repair-wiki-suffixes  { apply }
 * Items wiki des attitudes, coiffures et maquillages : retire du nom EN le suffixe de type du
 * wiki (« Emote », « Hair », « Makeup ») et garde le titre de la page comme nom wiki.gg.
 * apply = false : aperçu sans écriture.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const body = await readBody<{ apply?: unknown }>(event)
  return repairWikiTypeSuffixes(body?.apply === true)
})
