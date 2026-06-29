import { requireAdmin } from '../../../utils/admin'
import { applyEmblemHighSeasOnly } from '../../../utils/reputation-db'
import { fetchHighSeasOnlyByName } from '../../../utils/sot-wiki'

/**
 * POST /api/admin/emblems/high-seas-sync  { apply? }
 * Récupère le flag « High Seas only » des commendations depuis le wiki Sea of Thieves
 * et l'applique aux emblèmes (rapprochement par nom EN normalisé).
 * apply absent/false = aperçu (rien écrit). Réservé admin.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ apply?: unknown }>(event).catch(() => ({} as { apply?: unknown }))
  const apply = body?.apply === true
  const { map, perFaction } = await fetchHighSeasOnlyByName()
  const report = applyEmblemHighSeasOnly(map, !apply)
  return { apply, perFaction, ...report }
})
