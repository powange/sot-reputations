import { requireAdminOrModerator } from '../../../utils/admin'
import { createWikiChestDrafts, getChestScopeItemsForCost } from '../../../utils/reputation-db'
import { fetchWikiItemsByTitles, normalizeName, type WikiItem } from '../../../utils/sot-wiki'

/**
 * POST /api/admin/chest-costs/create-drafts  { category, subcategory, titles: string[] }
 * Crée, dans le périmètre donné, des items « source wiki » NON publiés pour des pages
 * du wiki sans item au catalogue (cf. `wikiOnly` de l'aperçu). Les données (description,
 * image, coût, prérequis) sont relues sur le wiki côté serveur, pas reprises du client.
 * Les titres déjà présents dans le périmètre (par nom EN) sont ignorés.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<{ category?: unknown, subcategory?: unknown, titles?: unknown }>(event)
  const category = typeof body?.category === 'string' ? body.category.trim() : ''
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'category requise' })
  }
  const subcategory = body?.subcategory == null || body.subcategory === ''
    ? null
    : String(body.subcategory)
  const titles = Array.isArray(body?.titles)
    ? [...new Set(body.titles.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean))]
    : []
  if (!titles.length) {
    throw createError({ statusCode: 400, statusMessage: 'titles requis' })
  }
  if (titles.length > 1000) {
    throw createError({ statusCode: 400, statusMessage: 'Trop de titres (1000 max.)' })
  }

  // Déjà au catalogue dans ce périmètre (item officiel ou brouillon) : on ne recrée pas.
  const existing = new Set(getChestScopeItemsForCost(category, subcategory).map(it => normalizeName(it.enName || it.name)))
  const wanted = titles.filter(t => !existing.has(normalizeName(t)))

  let wiki: WikiItem[] = []
  if (wanted.length) {
    try {
      wiki = await fetchWikiItemsByTitles(wanted)
    } catch {
      throw createError({ statusCode: 502, statusMessage: 'Échec de récupération du wiki' })
    }
  }

  const created = createWikiChestDrafts(category, subcategory, wiki
    .filter(w => !existing.has(normalizeName(w.title)))
    .map(w => ({ title: w.title, description: w.description, image: w.image, cost: w.cost, prereqs: w.prereqs })))

  return { created, skipped: titles.length - created }
})
