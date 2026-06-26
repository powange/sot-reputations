import { requireAdmin } from '../../utils/admin'
import { mergeDuplicateChestItemGroups } from '../../utils/reputation-db'

/**
 * POST /api/admin/chest-duplicates
 * Fusionne les doublons résiduels du catalogue : garde la ligne la plus ancienne,
 * réaiguille possession + traductions, supprime les doublons. Destructif.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return mergeDuplicateChestItemGroups()
})
