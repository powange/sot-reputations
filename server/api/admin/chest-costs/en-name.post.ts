import { requireAdminOrModerator } from '../../../utils/admin'
import { setChestItemEnName } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-costs/en-name  { id, name }
 * Pose le nom anglais d'un item non rapproché du wiki (souvent : traduction EN absente),
 * pour qu'il soit rapproché de sa page wiki au prochain aperçu. Description EN intacte.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ id?: unknown, name?: unknown }>(event)
  const id = Number.isInteger(body?.id) ? body.id as number : null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (id == null || !name) {
    throw createError({ statusCode: 400, statusMessage: 'id et name requis' })
  }
  if (name.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Nom trop long' })
  }
  if (!setChestItemEnName(id, name)) {
    throw createError({ statusCode: 404, statusMessage: 'Item introuvable' })
  }
  return { success: true }
})
