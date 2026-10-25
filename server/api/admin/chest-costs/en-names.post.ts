import { requireAdminOrModerator } from '../../../utils/admin'
import { setChestItemEnName } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-costs/en-names  { items: [{ id, name }] }
 * Pose en lot le nom anglais d'items non rapprochés du wiki (réponse d'une IA collée
 * dans l'aperçu). Description EN intacte. Entrées invalides ignorées.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ items?: unknown }>(event)
  const items = Array.isArray(body?.items) ? body.items as Array<{ id?: unknown, name?: unknown }> : []
  if (items.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Trop d\'items (500 max.)' })
  }

  let updated = 0
  for (const it of items) {
    const name = typeof it?.name === 'string' ? it.name.trim() : ''
    if (!Number.isInteger(it?.id) || !name || name.length > 200) continue
    if (setChestItemEnName(it.id as number, name)) updated++
  }
  return { updated }
})
