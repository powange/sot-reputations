import { requireAdmin } from '../../utils/admin'
import { refreshEmblemImagesToPrefix } from '../../utils/reputation-db'

/**
 * POST /api/admin/emblem-images  { targetPrefix, apply? }
 * Réécrit les URLs d'images d'emblèmes vers `targetPrefix` (domaine + version courants).
 * apply absent/false = aperçu (rien écrit). Réservé admin.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ targetPrefix?: unknown, apply?: unknown }>(event)
  const targetPrefix = typeof body?.targetPrefix === 'string' ? body.targetPrefix.trim() : ''
  if (!/^https?:\/\//i.test(targetPrefix)) {
    throw createError({ statusCode: 400, statusMessage: 'targetPrefix invalide (URL http(s) attendue)' })
  }
  const apply = body?.apply === true
  return refreshEmblemImagesToPrefix(targetPrefix, !apply)
})
