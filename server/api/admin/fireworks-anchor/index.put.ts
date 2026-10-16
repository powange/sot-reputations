import { isValidFireworksAnchor } from '#shared/utils/fireworks'
import { requireAdmin } from '../../../utils/admin'
import { getFireworksAnchor, setFireworksAnchor } from '../../../utils/fireworks'

// Recale le planning : « tel avant-poste tire à tel instant » (après un décalage du jeu)
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ at?: unknown, outpost?: unknown }>(event)
  const anchor = { at: Number(body?.at), outpost: Number(body?.outpost) }
  if (!isValidFireworksAnchor(anchor)) {
    throw createError({ statusCode: 400, message: 'Avant-poste ou horaire invalide' })
  }
  setFireworksAnchor(anchor)
  return getFireworksAnchor()
})
