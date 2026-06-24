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

/**
 * Prérequis d'obtention d'un item (déduits de l'infobox {{variant}}).
 * - commendations : commendation(s) + grade requis (= emblèmes du site).
 * - factionLevels : niveau de réputation requis par faction (clé courte).
 * - legendary : nécessite le titre Pirate Legend.
 * - requires : autre condition en texte libre (event, Twitch Drops…).
 */
export interface WikiPrereqs {
  commendations?: Array<{ name: string, grade: number | null }>
  factionLevels?: Record<string, number>
  legendary?: boolean
  requires?: string
}
export interface WikiItem { title: string, cost: WikiCost | null, prereqs: WikiPrereqs | null }

// Champ wiki « *-level » -> clé de faction courte.
const FACTION_LEVEL_FIELDS: Record<string, string> = {
  'hoarder-level': 'hoarder',
  'merchant-level': 'merchant',
  'souls-level': 'souls',
  'hunter-level': 'hunter',
  'seadog-level': 'seadog',
  'reaper-level': 'reaper',
  'athena-level': 'athena'
}

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

/**
 * Extrait le corps de l'infobox {{variant ... }} en équilibrant les accolades,
 * pour ne PAS s'arrêter au premier `}}` d'un éventuel template imbriqué.
 */
function extractVariantBody(wikitext: string): string | null {
  const m = wikitext.match(/\{\{\s*variant/i)
  if (!m || m.index == null) return null
  const start = m.index + m[0].length
  let depth = 1
  let i = start
  while (i < wikitext.length && depth > 0) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
      depth++
      i += 2
    } else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--
      i += 2
    } else {
      i++
    }
  }
  // depth === 0 -> i pointe juste après le `}}` fermant : le corps est [start, i-2).
  return depth === 0 ? wikitext.slice(start, i - 2) : wikitext.slice(start)
}

/** Allège un fragment de wikitext (liens, gras, refs, templates) pour l'affichage. */
function cleanWiki(s: string): string {
  return s
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1') // [[A|B]] -> B
    .replace(/\[\[([^\]]+)\]\]/g, '$1') // [[A]] -> A
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1') // [url texte] -> texte
    .replace(/\{\{[^{}]*\}\}/g, '') // templates simples
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse l'infobox {{variant}} d'un wikitext en une passe : coût + prérequis.
 * Lit un champ « | <name> = <valeur> » (s'arrête au prochain | / } / fin de ligne) ;
 * le `=` juste après le nom évite que `cost` capte `cost-d`/`cost-a`.
 */
function parseVariant(wikitext: string): { cost: WikiCost | null, prereqs: WikiPrereqs | null } {
  const body = extractVariantBody(wikitext)
  if (body == null) return { cost: null, prereqs: null }
  const str = (name: string): string | undefined => {
    const fm = body.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^|}\\n]+)`, 'i'))
    return fm?.[1]?.trim() || undefined
  }
  const int = (name: string): number | undefined => {
    const v = str(name)
    if (v == null) return undefined
    const n = Number.parseInt(v.replace(/[^0-9]/g, ''), 10)
    return Number.isFinite(n) ? n : undefined
  }

  // Coût
  const cost: WikiCost = {}
  const gold = int('cost')
  const doubloons = int('cost-d')
  const ancientCoins = int('cost-a')
  if (gold != null) cost.gold = gold
  if (doubloons != null) cost.doubloons = doubloons
  if (ancientCoins != null) cost.ancientCoins = ancientCoins

  // Prérequis
  const prereqs: WikiPrereqs = {}
  const comms: Array<{ name: string, grade: number | null }> = []
  const c1 = str('commendation')
  if (c1) comms.push({ name: cleanWiki(c1), grade: int('comm-grade') ?? null })
  const c2 = str('commendation2')
  if (c2) comms.push({ name: cleanWiki(c2), grade: int('comm-grade2') ?? null })
  if (comms.length) prereqs.commendations = comms
  const fl: Record<string, number> = {}
  for (const [fieldName, key] of Object.entries(FACTION_LEVEL_FIELDS)) {
    const v = int(fieldName)
    if (v != null) fl[key] = v
  }
  if (Object.keys(fl).length) prereqs.factionLevels = fl
  const leg = str('legendary')
  if (leg && /^(yes|true|1)$/i.test(leg)) prereqs.legendary = true
  const req = str('requires')
  if (req) prereqs.requires = cleanWiki(req)

  return {
    cost: Object.keys(cost).length > 0 ? cost : null,
    prereqs: Object.keys(prereqs).length > 0 ? prereqs : null
  }
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
      const { cost, prereqs } = parseVariant(wt)
      out.push({ title: p.title, cost, prereqs })
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
