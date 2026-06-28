import { requireAdmin } from '../../utils/admin'
import { getEmblemImagePrefixes } from '../../utils/reputation-db'

/**
 * GET /api/admin/emblem-images
 * Préfixes d'URL distincts des images d'emblèmes (avec exemple + nombre), pour repérer
 * les versions périmées avant de les réécrire. Ne modifie rien.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { prefixes: getEmblemImagePrefixes() }
})
