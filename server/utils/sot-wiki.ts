/**
 * Client minimal de l'API MediaWiki du wiki Sea of Thieves (wiki.gg).
 * Récupère le coût d'achat des items cosmétiques depuis l'infobox {{variant}} de
 * chaque page d'une catégorie (ex. Category:Banjo).
 *
 * L'infobox {{variant}} expose : cost (or), cost-d (doubloons), cost-a (pièces
 * anciennes). Les items non achetables (défaut, événement, récompense) n'ont aucun
 * de ces champs -> cost = null.
 */

const WIKI_API = 'https://seaofthieves.wiki.gg/api.php'
const USER_AGENT = 'sot-reputations (https://achievements-sot.powange.com)'

export interface WikiCost { gold?: number, doubloons?: number, ancientCoins?: number }
export interface WikiItem { title: string, cost: WikiCost | null }

interface CategoryMembersResponse {
  query?: { categorymembers?: Array<{ title: string }> }
  continue?: { cmcontinue?: string }
}
interface RevisionsResponse {
  query?: { pages?: Record<string, { title: string, revisions?: Array<{ slots?: { main?: { '*'?: string } } }> }> }
}

async function wikiApi<T>(params: Record<string, string>): Promise<T> {
  const url = `${WIKI_API}?${new URLSearchParams({ ...params, format: 'json' }).toString()}`
  return await $fetch(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 20000 }) as T
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Normalise un nom pour le rapprochement « nom EN <-> titre wiki » :
 * accents retirés, apostrophes typographiques unifiées, espaces compactés, minuscules.
 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[‘’'`]/g, '\'') // unifie les apostrophes (typographiques -> droite)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Extrait le coût de l'infobox {{variant}} d'un wikitext (null si non achetable). */
function parseVariantCost(wikitext: string): WikiCost | null {
  const m = wikitext.match(/\{\{variant([\s\S]*?)\}\}/i)
  if (!m) return null
  const body = m[1] ?? ''
  // Lit un champ « | <name> = <int> » (s'arrête au prochain | / } / fin de ligne).
  // Le `=` juste après le nom évite que `cost` capte `cost-d` / `cost-a`.
  const field = (name: string): number | undefined => {
    const fm = body.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^|}\\n]+)`, 'i'))
    if (!fm || fm[1] == null) return undefined
    const n = Number.parseInt(fm[1].replace(/[^0-9]/g, ''), 10)
    return Number.isFinite(n) ? n : undefined
  }
  const cost: WikiCost = {}
  const gold = field('cost')
  const doubloons = field('cost-d')
  const ancientCoins = field('cost-a')
  if (gold != null) cost.gold = gold
  if (doubloons != null) cost.doubloons = doubloons
  if (ancientCoins != null) cost.ancientCoins = ancientCoins
  return Object.keys(cost).length > 0 ? cost : null
}

/**
 * Récupère tous les items d'une catégorie wiki avec leur coût.
 * Écarte la page « racine » du type (ex. la page « Banjo » elle-même).
 */
export async function fetchWikiItemCosts(wikiCategory: string): Promise<WikiItem[]> {
  // 1) Membres de la catégorie (titres des pages d'items), paginé.
  const titles: string[] = []
  let cmcontinue: string | undefined
  do {
    const params: Record<string, string> = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${wikiCategory}`,
      cmlimit: '500',
      cmtype: 'page'
    }
    if (cmcontinue) params.cmcontinue = cmcontinue
    const d = await wikiApi<CategoryMembersResponse>(params)
    for (const c of d.query?.categorymembers ?? []) titles.push(c.title)
    cmcontinue = d.continue?.cmcontinue
  } while (cmcontinue)

  const rootKey = normalizeName(wikiCategory)
  const itemTitles = titles.filter(t => normalizeName(t) !== rootKey)

  // 2) Wikitext par lots de 50 -> coût de l'infobox.
  const out: WikiItem[] = []
  for (const batch of chunk(itemTitles, 50)) {
    const d = await wikiApi<RevisionsResponse>({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: batch.join('|')
    })
    for (const p of Object.values(d.query?.pages ?? {})) {
      const wt = p.revisions?.[0]?.slots?.main?.['*'] ?? ''
      out.push({ title: p.title, cost: parseVariantCost(wt) })
    }
  }
  return out
}

/**
 * Récupère et fusionne les items de PLUSIEURS catégories wiki (une sous-catégorie du
 * catalogue peut correspondre à plusieurs Category: du wiki). Dédoublonnage par titre ;
 * en cas de doublon, on conserve une entrée qui porte un coût si l'une l'a.
 */
export async function fetchWikiItemCostsMulti(categories: string[]): Promise<WikiItem[]> {
  const byTitle = new Map<string, WikiItem>()
  for (const cat of categories) {
    const items = await fetchWikiItemCosts(cat)
    for (const it of items) {
      const key = normalizeName(it.title)
      const existing = byTitle.get(key)
      if (!existing || (!existing.cost && it.cost)) byTitle.set(key, it)
    }
  }
  return [...byTitle.values()]
}
