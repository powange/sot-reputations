import { requireAdmin } from '../../utils/admin'
import { findDuplicateChestItemGroups } from '../../utils/reputation-db'

/**
 * GET /api/admin/chest-duplicates
 * Aperçu des doublons résiduels du catalogue (même nom + catégorie + sous-catégorie,
 * item_key différent). Ne modifie rien.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { groups: findDuplicateChestItemGroups() }
})
