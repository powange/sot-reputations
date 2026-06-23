import { requireAdminOrModerator } from '../../../utils/admin'
import { setChestItemColorsManual } from '../../../utils/reputation-db'
import { CHEST_COLOR_PALETTE } from '../../../utils/chest-colors'

const VALID = new Set(CHEST_COLOR_PALETTE.map(c => c.name))

/**
 * POST /api/admin/chest-colors/set-colors  { id, colors }
 * Fixe à la main les couleurs nommées d'un item (ordre = dominance, la 1re = principale)
 * et le marque `colors_manual` pour le protéger des ré-analyses en masse. Les couleurs
 * doivent appartenir à la palette ; les doublons sont retirés en conservant l'ordre.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ id?: number | string, colors?: unknown }>(event)
  const id = Number(body?.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'id invalide' })
  }
  if (!Array.isArray(body?.colors)) {
    throw createError({ statusCode: 400, statusMessage: 'colors doit être un tableau' })
  }

  const seen = new Set<string>()
  const colors: string[] = []
  for (const c of body.colors) {
    if (typeof c !== 'string' || !VALID.has(c) || seen.has(c)) continue
    seen.add(c)
    colors.push(c)
  }

  const ok = setChestItemColorsManual(id, colors)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Item introuvable' })
  }
  return { id, colors, manual: true }
})
