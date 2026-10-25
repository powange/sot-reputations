import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestScopeItemsForCost, type ChestItemCost, type ChestItemPrereqs } from '../../../utils/reputation-db'
import { describeWikiError, fetchWikiItemCostsMulti, looseWikiName, normalizeName, pickByDescription, wikiDataForItem, wikiVariantBase, type WikiCost, type WikiItem, type WikiPrereqs } from '../../../utils/sot-wiki'

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
  } catch (err) {
    console.error('[chest-costs] échec wiki', wikiCategory, err)
    throw createError({ statusCode: 502, statusMessage: `Échec de récupération du wiki pour « ${wikiCategory} » (${describeWikiError(err)})` })
  }

  const wikiByName = new Map(wiki.map(w => [normalizeName(w.title), w]))
  const usedTitles = new Set<string>()
  // Pages de variantes « Nom (Précision) » par nom de base : dans le jeu, chaque variante
  // porte le nom sans précision ; on départage par la description anglaise.
  const variantsByBase = new Map<string, WikiItem[]>()
  for (const w of wiki) {
    const base = wikiVariantBase(w.title)
    if (!base) continue
    const key = normalizeName(base)
    variantsByBase.set(key, [...(variantsByBase.get(key) ?? []), w])
  }
  // Dernier recours : noms « souples » (qualité de trophée et guillemets retirés). Plusieurs
  // qualités d'une même plaque partagent ainsi la page unique du wiki.
  const wikiByLoose = new Map<string, WikiItem>()
  for (const w of wiki) {
    const key = looseWikiName(w.title)
    if (!wikiByLoose.has(key)) wikiByLoose.set(key, w)
  }
  // Nom cherché : nom wiki (surcharge) s'il est renseigné, sinon nom anglais, sinon FR.
  const findWikiPage = (it: { name: string, enName: string | null, wikiName: string | null, enDescription: string | null }): WikiItem | undefined => {
    const name = it.wikiName || it.enName || it.name
    const key = normalizeName(name)
    const exact = wikiByName.get(key)
    if (exact) return exact
    const variants = variantsByBase.get(key)
    if (variants) {
      // Une variante déjà prise par un autre item est écartée en priorité.
      const free = variants.filter(v => !usedTitles.has(normalizeName(v.title)))
      return pickByDescription(free.length ? free : variants, it.enDescription)
    }
    return wikiByLoose.get(looseWikiName(name))
  }

  // image = image du catalogue (site officiel, ou wiki pour un brouillon) ; wikiImage =
  // image de la page wiki rapprochée, en repli d'affichage quand l'item n'en a pas.
  // currentCost / currentPrereqs = valeurs en base, pour n'appliquer que ce qui change.
  const matched: Array<{ id: number, name: string, enName: string | null, image: string | null, wikiImage: string | null, wikiTitle: string, cost: WikiCost, currentCost: ChestItemCost | null, prereqs: WikiPrereqs | null, currentPrereqs: ChestItemPrereqs | null }> = []
  const noCost: Array<{ id: number, name: string, enName: string | null, image: string | null, wikiImage: string | null, wikiTitle: string, prereqs: WikiPrereqs | null, currentPrereqs: ChestItemPrereqs | null }> = []
  const unmatched: Array<{ id: number, name: string, enName: string | null, wikiName: string | null, image: string | null }> = []

  for (const it of items) {
    const w = findWikiPage(it)
    if (!w) {
      unmatched.push({ id: it.id, name: it.name, enName: it.enName, wikiName: it.wikiName, image: it.image })
      continue
    }
    usedTitles.add(normalizeName(w.title))
    // Trophée avec qualité : coût et prérequis de cette qualité (sinon ceux de la page).
    const { cost, prereqs } = wikiDataForItem(w, it.enName, it.name)
    if (!cost) {
      noCost.push({ id: it.id, name: it.name, enName: it.enName, image: it.image, wikiImage: w.image, wikiTitle: w.title, prereqs, currentPrereqs: it.prerequisites })
      continue
    }
    matched.push({ id: it.id, name: it.name, enName: it.enName, image: it.image, wikiImage: w.image, wikiTitle: w.title, cost, currentCost: it.cost, prereqs, currentPrereqs: it.prerequisites })
  }

  const wikiOnly = wiki
    .filter(w => !usedTitles.has(normalizeName(w.title)))
    .map(w => ({ title: w.title, cost: w.cost, image: w.image, variantOf: wikiVariantBase(w.title) }))

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
