import { requireAdminOrModerator } from '../../../utils/admin'
import { setChestItemCost, setChestItemPrereqs, type ChestItemCost, type ChestItemPrereqs } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-costs/apply  { items: [{ id, cost?, prereqs? }] }
 * Écrit les données wiki retenues sur les items. On n'écrit un champ que s'il est
 * présent dans l'objet (clé absente = ne pas toucher ; valeur null = effacer).
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ items?: Array<Record<string, unknown>> }>(event)
  const items = Array.isArray(body?.items) ? body.items : []

  let updated = 0
  for (const it of items) {
    if (typeof it?.id !== 'number') continue
    let touched = false
    if ('cost' in it) {
      const cost = it.cost && typeof it.cost === 'object' ? it.cost as ChestItemCost : null
      if (setChestItemCost(it.id, cost)) touched = true
    }
    if ('prereqs' in it) {
      const pr = it.prereqs && typeof it.prereqs === 'object' ? it.prereqs as ChestItemPrereqs : null
      if (setChestItemPrereqs(it.id, pr)) touched = true
    }
    if (touched) updated++
  }

  return { updated }
})
