import { requireAdminOrModerator } from '../../../utils/admin'
import { setChestCostWikiMap } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-costs/wiki-map  { category, subcategory, wikiCategory }
 * Mémorise le nom de Category: du wiki à utiliser pour un scope (sous-catégorie).
 * wikiCategory vide = efface l'override (retour au nom de la sous-catégorie).
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ category?: unknown, subcategory?: unknown, wikiCategory?: unknown }>(event)
  const category = typeof body?.category === 'string' ? body.category.trim() : ''
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'category requise' })
  }
  const subcategory = body?.subcategory == null || body.subcategory === ''
    ? null
    : String(body.subcategory)
  const wikiCategory = typeof body?.wikiCategory === 'string' ? body.wikiCategory.trim() : ''

  setChestCostWikiMap(category, subcategory, wikiCategory)
  return { ok: true, saved: wikiCategory || null }
})
