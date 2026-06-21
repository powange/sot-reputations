import { getChestTaxonomyTranslations } from '../utils/reputation-db'

/**
 * GET /api/chest-taxonomy
 * Map des traductions de libellés (catégories + sous-catégories) pour
 * l'affichage côté client. Non sensible (libellés uniquement).
 */
export default defineEventHandler(() => {
  return getChestTaxonomyTranslations()
})
