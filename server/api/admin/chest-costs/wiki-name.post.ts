import { requireAdminOrModerator } from '../../../utils/admin'
import { setChestItemWikiName } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-costs/wiki-name  { id, name }
 * Pose le nom wiki d'un item non rapproché (titre de sa page sur le wiki), pour qu'il
 * soit rapproché au prochain aperçu. Le nom anglais officiel n'est pas modifié, sauf s'il
 * est absent (il prend alors cette valeur).
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
  if (!setChestItemWikiName(id, name)) {
    throw createError({ statusCode: 404, statusMessage: 'Item introuvable' })
  }
  return { success: true }
})
