import { requireAdminOrModerator } from '../../../utils/admin'
import { setChestItemCost, type ChestItemCost } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-costs/apply  { items: [{ id, cost }] }
 * Écrit les coûts retenus (depuis l'aperçu) sur les items. `cost = null` efface.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ items?: Array<{ id?: unknown, cost?: ChestItemCost | null }> }>(event)
  const items = Array.isArray(body?.items) ? body.items : []

  let updated = 0
  for (const it of items) {
    if (typeof it?.id !== 'number') continue
    const cost = it.cost && typeof it.cost === 'object' ? it.cost : null
    if (setChestItemCost(it.id, cost)) updated++
  }

  return { updated }
})
