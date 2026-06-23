import { requireAdminOrModerator } from '../../utils/admin'
import { searchChestItemTranslations } from '../../utils/reputation-db'

/**
 * GET /api/admin/chest-item-translations?q=...
 * Recherche d'items du coffre par nom FR avec leurs traductions EN/ES, pour
 * l'éditeur de correction. Renvoie au plus 50 résultats.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const q = String(getQuery(event).q || '').trim()
  if (q.length < 2) return { items: [] }
  return { items: searchChestItemTranslations(q, 50) }
})
