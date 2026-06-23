import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestItemImageById, saveChestItemColors, getChestColorSignature, chestScopeKey } from '../../../utils/reputation-db'
import { classifyDominantColors } from '../../../utils/chest-colors'
import { extractDominantColors } from '../../../utils/chest-colors-extract'

/**
 * POST /api/admin/chest-colors/analyze-item  { id }
 * Ré-analyse un item précis (re-télécharge l'image, ré-extrait les RGB dominants, les
 * re-classe), même s'il était déjà analysé. Renvoie les nouvelles couleurs.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ id?: number | string }>(event)
  const id = Number(body?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'id invalide' })
  }

  const item = getChestItemImageById(id)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Item introuvable ou sans image' })
  }

  const res = await fetch(item.image, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `Téléchargement image : HTTP ${res.status}` })
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const sig = getChestColorSignature(chestScopeKey(item.category, item.subcategory))
  const dominant = await extractDominantColors(buf, 4, sig ? new Set(sig.bins) : undefined)
  const colors = classifyDominantColors(dominant)
  saveChestItemColors(id, dominant, colors)

  return { id, dominant, colors }
})
