import { requireAdminOrModerator } from '../../utils/admin'
import { getChestTaxonomy, getChestTaxonomyTranslations } from '../../utils/reputation-db'

/**
 * GET /api/admin/chest-taxonomy
 * Catégories et sous-catégories du coffre avec leurs traductions FR/EN/ES,
 * pour l'éditeur d'administration.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const taxonomy = getChestTaxonomy()
  const trans = getChestTaxonomyTranslations()

  return {
    categories: taxonomy.map(c => ({
      category: c.category,
      translations: trans.categories[c.category] || {},
      subcategories: c.subcategories.map(sub => ({
        subcategory: sub,
        translations: trans.subcategories[c.category]?.[sub] || {}
      }))
    }))
  }
})
