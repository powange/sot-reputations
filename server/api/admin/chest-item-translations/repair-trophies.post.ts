import { requireAdminOrModerator } from '../../../utils/admin'
import { repairTrophyEnNames } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-item-translations/repair-trophies  { apply }
 * Rétablit la qualité (Admired / Prized / Treasured / Cherished) dans le nom EN des
 * trophées qui l'ont perdue. apply = false : aperçu sans écriture.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const body = await readBody<{ apply?: unknown }>(event)
  return repairTrophyEnNames(body?.apply === true)
})
