import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestScopeItemsForCost, type ChestItemCost } from '../../../utils/reputation-db'
import { fetchWikiItemCostsMulti, normalizeName, type WikiCost, type WikiItem, type WikiPrereqs } from '../../../utils/sot-wiki'

/**
 * POST /api/admin/chest-costs/fetch  { category, subcategory, wikiCategory? }
 * Récupère les coûts du wiki pour une sous-catégorie et les rapproche des items du
 * catalogue par nom EN. Ne modifie RIEN : renvoie un aperçu (matchés avec coût, sans
 * coût sur le wiki, non matchés, et pages wiki sans item correspondant).
 *
 * `wikiCategory` permet de surcharger le nom de la Category: du wiki quand il diffère
 * de la sous-catégorie (par défaut = subcategory).
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
  const wikiCategory = (typeof body?.wikiCategory === 'string' && body.wikiCategory.trim())
    ? body.wikiCategory.trim()
    : (subcategory ?? '')
  // Une sous-catégorie peut viser plusieurs Category: du wiki, séparées par « | ».
  const wikiCategories = wikiCategory.split('|').map(c => c.trim()).filter(Boolean)
  if (!wikiCategories.length) {
    throw createError({ statusCode: 400, statusMessage: 'wikiCategory requise (sous-catégorie absente)' })
  }

  const items = getChestScopeItemsForCost(category, subcategory)

  let wiki: WikiItem[]
  try {
    wiki = await fetchWikiItemCostsMulti(wikiCategories)
  } catch {
    throw createError({ statusCode: 502, statusMessage: `Échec de récupération du wiki pour « ${wikiCategory} »` })
  }

  const wikiByName = new Map(wiki.map(w => [normalizeName(w.title), w]))
  const usedTitles = new Set<string>()

  const matched: Array<{ id: number, name: string, enName: string | null, wikiTitle: string, cost: WikiCost, currentCost: ChestItemCost | null, prereqs: WikiPrereqs | null }> = []
  const noCost: Array<{ id: number, name: string, enName: string | null, wikiTitle: string, prereqs: WikiPrereqs | null }> = []
  const unmatched: Array<{ id: number, name: string, enName: string | null }> = []

  for (const it of items) {
    const w = wikiByName.get(normalizeName(it.enName || it.name))
    if (!w) {
      unmatched.push({ id: it.id, name: it.name, enName: it.enName })
      continue
    }
    usedTitles.add(normalizeName(w.title))
    if (!w.cost) {
      noCost.push({ id: it.id, name: it.name, enName: it.enName, wikiTitle: w.title, prereqs: w.prereqs })
      continue
    }
    matched.push({ id: it.id, name: it.name, enName: it.enName, wikiTitle: w.title, cost: w.cost, currentCost: it.cost, prereqs: w.prereqs })
  }

  const wikiOnly = wiki
    .filter(w => !usedTitles.has(normalizeName(w.title)))
    .map(w => ({ title: w.title, cost: w.cost }))

  return {
    category,
    subcategory,
    wikiCategory,
    matched,
    noCost,
    unmatched,
    wikiOnly,
    counts: {
      items: items.length,
      wiki: wiki.length,
      matched: matched.length,
      noCost: noCost.length,
      unmatched: unmatched.length,
      wikiOnly: wikiOnly.length
    }
  }
})
