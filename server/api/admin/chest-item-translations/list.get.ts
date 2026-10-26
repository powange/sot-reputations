import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestTranslationOverview, type ChestTranslationFilters } from '../../../utils/reputation-db'

const list = (v: unknown) => typeof v === 'string' && v ? v.split(',').map(s => s.trim()).filter(Boolean) : []

/**
 * GET /api/admin/chest-item-translations/list
 * ?status=incomplete|names|descriptions|all &source=official|wiki|all &langs=fr,en,es
 * &categories=A,B &subcategories=C,D &q=… &page=1 &pageSize=50
 * Items du coffre avec traductions et manques, statistiques et facettes (catégories).
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const query = getQuery(event)
  const status = ['incomplete', 'names', 'descriptions', 'all'].includes(String(query.status)) ? String(query.status) as ChestTranslationFilters['status'] : 'incomplete'
  const source = ['official', 'wiki', 'all'].includes(String(query.source)) ? String(query.source) as ChestTranslationFilters['source'] : 'all'
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize) || 50))
  const page = Math.max(1, Number(query.page) || 1)
  return getChestTranslationOverview({
    status,
    source,
    langs: list(query.langs).filter((l): l is 'fr' | 'en' | 'es' => ['fr', 'en', 'es'].includes(l)),
    categories: list(query.categories),
    subcategories: list(query.subcategories),
    q: typeof query.q === 'string' ? query.q : ''
  }, (page - 1) * pageSize, pageSize)
})
