import { requireAdminOrModerator } from '../../../utils/admin'
import { searchChestItemsByName } from '../../../utils/reputation-db'

/**
 * GET /api/admin/chest-colors/search?q=...
 * Recherche d'items du coffre par nom (pour cibler une ré-analyse). Renvoie au plus
 * 20 résultats avec leurs couleurs nommées actuelles.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const q = String(getQuery(event).q || '').trim()
  if (q.length < 2) return { items: [] }
  return { items: searchChestItemsByName(q, 20) }
})
