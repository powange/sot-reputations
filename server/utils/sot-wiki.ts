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
export const USER_AGENT = 'sot-reputations (https://achievements-sot.powange.com)'

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
// Qualités d'un trophée (plaque, tableau) : un objet par qualité dans le jeu, une seule
// page sur le wiki. Prix, grade de commendation et classe de jalon propres à chacune.
export type TrophyTier = 'admired' | 'prized' | 'treasured' | 'cherished'
export interface WikiTrophyTier { gold: number, grade: number | null, milestone: string | null, milestoneClass: number | null }
// description (EN) et image (original de la page) servent à créer les items absents
// du catalogue (brouillons « source wiki ») ; null si la page n'en a pas. tiers : pages
// de trophées uniquement (cf. trophyTiers).
export interface WikiItem { title: string, cost: WikiCost | null, prereqs: WikiPrereqs | null, description: string | null, image: string | null, tiers?: Partial<Record<TrophyTier, WikiTrophyTier>> | null }

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

// Factions d'événement mondial : le prérequis est exprimé via `faction = <nom anglais>`
// + `allegiance = <niveau>` (au lieu d'un champ `*-level`). Nom normalisé -> clé courte.
const ALLEGIANCE_FACTION_TO_KEY: Record<string, string> = {
  'servants of the flame': 'flame',
  'guardians of fortune': 'guardians'
}

interface CategoryMembersResponse {
  query?: { categorymembers?: Array<{ title: string }> }
  continue?: { cmcontinue?: string }
}
interface RevisionsResponse {
  query?: { pages?: Record<string, { title: string, revisions?: Array<{ slots?: { main?: { '*'?: string } } }>, original?: { source?: string } }> }
}

/**
 * Cause lisible d'un échec d'appel au wiki (code HTTP de wiki.gg, délai dépassé, réseau),
 * pour la renvoyer à l'admin au lieu d'un message générique.
 */
export function describeWikiError(err: unknown): string {
  if (err instanceof WikiApiError) return err.message
  const e = err as { statusCode?: number, status?: number, response?: { status?: number }, name?: string, message?: string, cause?: { code?: string } }
  const status = e?.statusCode ?? e?.status ?? e?.response?.status
  if (status) return status === 429 ? 'HTTP 429 : le wiki limite les requêtes, réessayez dans un moment' : `HTTP ${status} du wiki`
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError' || /timeout|aborted/i.test(e?.message ?? '')) return 'délai dépassé'
  return e?.cause?.code || e?.message || 'erreur inconnue'
}

// Erreur renvoyée par l'API MediaWiki DANS une réponse HTTP 200 ({ error: { code, info } }).
class WikiApiError extends Error {
  constructor(public code: string, info: string) {
    super(`API du wiki : ${code}${info ? ` (${info})` : ''}`)
  }
}
// Codes d'erreur MediaWiki temporaires : on réessaie.
const TRANSIENT_WIKI_CODES = new Set(['ratelimited', 'maxlag', 'readonly', 'internal_api_error_DBQueryError', 'internal_api_error_DBConnectionError'])

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function wikiApi<T>(params: Record<string, string>): Promise<T> {
  const url = `${WIKI_API}?${new URLSearchParams({ ...params, format: 'json' }).toString()}`
  for (let attempt = 0; ; attempt++) {
    // wiki.gg limite les rafales (429) : nouvelles tentatives espacées sur les erreurs
    // temporaires et les délais dépassés (récupération de nombreuses sous-catégories).
    const data = await $fetch<unknown>(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 20000,
      retry: 3,
      retryDelay: 2000,
      retryStatusCodes: [408, 425, 429, 500, 502, 503, 504]
    })
    // Réponse non-JSON (page HTML de protection, etc.) ou erreur MediaWiki en HTTP 200 :
    // à signaler, sinon elle passerait pour « aucune page » et rien ne serait rapproché.
    if (!data || typeof data !== 'object') throw new WikiApiError('reponse_invalide', 'réponse non JSON')
    const error = (data as { error?: { code?: string, info?: string } }).error
    if (!error) return data as T
    const code = error.code ?? 'inconnu'
    if (!TRANSIENT_WIKI_CODES.has(code) || attempt >= 3) throw new WikiApiError(code, error.info ?? '')
    await sleep(2000 * (attempt + 1))
  }
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

// Qualités des trophées (plaques, tableaux) : un objet par qualité dans le jeu
// (« Admired Raven Islehopper Plaque »…), une seule page sans qualité sur le wiki.
const QUALITY_PREFIX_RE = /^(admired|cherished|treasured|prized) /

/**
 * Nom « souple » pour un dernier rapprochement nom du jeu <-> titre wiki : normalisé, sans
 * qualité de trophée en tête ni guillemets (« ‘Below Wonderlit Skies’ » dans le jeu,
 * « Below Wonderlit Skies » sur le wiki), ni suffixe de type que le wiki ajoute aux
 * attitudes, coiffures et maquillages (« Victorious Dragon's Breath Emote », « Short Afro
 * Hair », « Mystic Makeup » ; sans suffixe dans le jeu). Les préfixes, eux, distinguent de
 * vraies variantes (« Damned Dark Warsmith… », « Fallen Sea Dog… ») et sont gardés. Limité à ces écarts connus : retirer n'importe
 * quel premier mot rapprocherait des objets distincts (« Dire Dark Warsmith Costume »).
 */
export function looseWikiName(s: string): string {
  return normalizeName(s)
    .replace(QUALITY_PREFIX_RE, '')
    .replace(/['"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ (emote|hair|makeup)$/, '')
}

/**
 * Page de variante du wiki : « Nom (Précision) » (ex. « Barrel Bombardier Costume
 * (Goggles) »). Dans le jeu, chaque variante est un objet distinct qui porte le nom SANS
 * la précision ; seules leurs descriptions diffèrent. Renvoie le nom de base, ou null si
 * le titre n'a pas de précision finale entre parenthèses.
 */
export function wikiVariantBase(title: string): string | null {
  const m = /^(.+?)\s*\([^()]+\)$/.exec(title.trim())
  return m ? m[1]!.trim() : null
}

/**
 * Parmi des pages candidates, celle dont la description correspond le mieux à `description`
 * (identique après normalisation, sinon plus de mots en commun) ; la première à défaut.
 */
export function pickByDescription<T extends { description: string | null }>(candidates: T[], description: string | null): T | undefined {
  if (candidates.length <= 1 || !description) return candidates[0]
  const target = normalizeName(description)
  const exact = candidates.find(c => c.description && normalizeName(c.description) === target)
  if (exact) return exact
  const words = new Set(target.split(/\W+/).filter(Boolean))
  let best = candidates[0]
  let bestScore = -1
  for (const c of candidates) {
    const score = normalizeName(c.description ?? '').split(/\W+/).filter(w => words.has(w)).length
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

/**
 * Extrait le corps de l'infobox {{variant ... }} en équilibrant les accolades,
 * pour ne PAS s'arrêter au premier `}}` d'un éventuel template imbriqué.
 */
function extractVariantBody(wikitext: string): string | null {
  // `\b` : ne pas matcher {{variants}} / {{variantfoo}} (un autre template).
  const m = wikitext.match(/\{\{\s*variant\b/i)
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
  // Infobox non fermée (accolades déséquilibrées) : on n'extrait rien plutôt que de
  // capturer le reste de la page (qui contiendrait des `|` d'autres templates).
  if (depth !== 0) return null
  // depth === 0 -> i pointe juste après le `}}` fermant : le corps est [start, i-2).
  // On retire les commentaires HTML (leurs chiffres fausseraient les coûts).
  return wikitext.slice(start, i - 2).replace(/<!--[\s\S]*?-->/g, '')
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
 * Découpe le corps d'une infobox en paramètres « name -> value » en respectant
 * l'imbrication : un `|` à l'intérieur d'un {{template|...}} ou d'un [[lien|...]] n'est
 * PAS un séparateur de paramètre (sinon un champ comme `requires` contenant {{a|499}}
 * serait tronqué). Noms en minuscules.
 */
function parseInfoboxFields(body: string): Map<string, string> {
  const params: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2)
    if (two === '{{' || two === '[[') {
      depth++
      cur += two
      i++
    } else if (two === '}}' || two === ']]') {
      if (depth > 0) depth--
      cur += two
      i++
    } else if (body[i] === '|' && depth === 0) {
      params.push(cur)
      cur = ''
    } else {
      cur += body[i]
    }
  }
  params.push(cur)
  const fields = new Map<string, string>()
  for (const p of params) {
    const eq = p.indexOf('=')
    if (eq === -1) continue
    const name = p.slice(0, eq).trim().toLowerCase()
    if (name) fields.set(name, p.slice(eq + 1).trim())
  }
  return fields
}

/**
 * Parse l'infobox {{variant}} d'un wikitext en une passe : coût + prérequis.
 */
function parseVariant(wikitext: string, title = ''): { cost: WikiCost | null, prereqs: WikiPrereqs | null, description: string | null, tiers: Partial<Record<TrophyTier, WikiTrophyTier>> | null } {
  const body = extractVariantBody(wikitext)
  if (body == null) return { cost: null, prereqs: null, description: null, tiers: null }
  const fields = parseInfoboxFields(body)
  const str = (name: string): string | undefined => {
    const v = fields.get(name)
    return v && v.length > 0 ? v : undefined
  }
  const int = (name: string): number | undefined => {
    const v = str(name)
    if (v == null) return undefined
    // Ne prendre que le PREMIER nombre du champ (chiffres + séparateurs de
    // milliers), sans concaténer d'éventuels nombres suivants : "1,000 (sale 500)"
    // -> 1000, et non 1000500. "49 999" (espace = séparateur) -> 49999.
    const m = v.match(/\d[\d.,\u00A0\u202F ]*/)
    if (!m) return undefined
    const n = Number.parseInt(m[0].replace(/[^0-9]/g, ''), 10)
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
  // Allégeance aux factions d'événement (Serviteurs de la Flamme / Gardiens de la
  // Fortune) : `faction = <nom>` + `allegiance = <niveau>`. Même sémantique qu'un
  // niveau de faction (comparé au Level capté à l'import). Les deux champs sont
  // requis : un `faction` seul (vendeur) ne crée pas de prérequis.
  const allegianceFaction = str('faction')
  const allegiance = int('allegiance')
  if (allegianceFaction && allegiance != null) {
    const key = ALLEGIANCE_FACTION_TO_KEY[normalizeName(allegianceFaction)]
    if (key) fl[key] = allegiance
  }
  if (Object.keys(fl).length) prereqs.factionLevels = fl
  const leg = str('legendary')
  if (leg && /^(yes|true|1)$/i.test(leg)) prereqs.legendary = true
  const req = str('requires')
  if (req) prereqs.requires = cleanWiki(req)

  const description = str('description')

  return {
    cost: Object.keys(cost).length > 0 ? cost : null,
    prereqs: Object.keys(prereqs).length > 0 ? prereqs : null,
    description: description ? cleanWiki(description) || null : null,
    tiers: trophyTiers(str, int, title)
  }
}

const TROPHY_TIERS: TrophyTier[] = ['admired', 'prized', 'treasured', 'cherished']
const TROPHY_GOLD = [20000, 45000, 85000, 150000]
const TROPHY_CLASSES = [5, 10, 20, 30]
const TROPHY_GRADES = [1, 3, 4, 5]

/**
 * Qualités d'un trophée (`type = Trophy|Trophies`), selon la règle du modèle {{variant}}
 * du wiki (section « Milestones ») :
 * - avec `milestone` : 4 qualités, prix fixes 20k / 45k / 85k / 150k, classe de jalon
 *   `class1..4` (défaut 5 / 10 / 20 / 30) et, avec une `commendation`, grade
 *   `comm-grade1..4` (défaut 1 / 3 / 4 / 5) ;
 * - sans jalon mais avec commendation : Cherished seul (grade `comm-grade`), sauf
 *   « Sailing with Unbroken Bonds » (grades 1 / 3 / 5 / 7).
 */
function trophyTiers(
  str: (name: string) => string | undefined,
  int: (name: string) => number | undefined,
  title: string
): Partial<Record<TrophyTier, WikiTrophyTier>> | null {
  const type = str('type')?.toLowerCase()
  if (type !== 'trophy' && type !== 'trophies') return null
  const milestone = str('milestone') ? cleanWiki(str('milestone')!) : null
  const commendation = str('commendation') ? cleanWiki(str('commendation')!) : null
  const tiers: Partial<Record<TrophyTier, WikiTrophyTier>> = {}
  if (milestone) {
    TROPHY_TIERS.forEach((tier, i) => {
      tiers[tier] = {
        gold: TROPHY_GOLD[i]!,
        grade: commendation ? (int(`comm-grade${i + 1}`) ?? TROPHY_GRADES[i]!) : null,
        milestone,
        milestoneClass: int(`class${i + 1}`) ?? TROPHY_CLASSES[i]!
      }
    })
  } else if (commendation) {
    if (normalizeName(title) === 'sailing with unbroken bonds') {
      [1, 3, 5, 7].forEach((grade, i) => {
        tiers[TROPHY_TIERS[i]!] = { gold: TROPHY_GOLD[i]!, grade, milestone: null, milestoneClass: null }
      })
    } else {
      tiers.cherished = { gold: 150000, grade: int('comm-grade') ?? null, milestone: null, milestoneClass: null }
    }
  }
  return Object.keys(tiers).length ? tiers : null
}

// Qualité dans le nom FRANÇAIS : les tableaux n'ont pas de qualité dans leur nom anglais
// (« Be Alluring to Get Ahead » ×4) mais en ont une en français (« Superbe « … » »).
// Singulier ou pluriel (« Admirables « Armes d'Athéna » »).
const FR_QUALITY: Array<[RegExp, TrophyTier]> = [
  [/\badmirables?\b/, 'admired'],
  [/\bsuperbes?\b/, 'prized'],
  [/\bmagnifiques?\b/, 'treasured'],
  [/\binestimables?\b/, 'cherished']
]

/** Qualité de trophée d'un objet, d'après son nom anglais (préfixe) ou français. */
export function trophyTierOf(enName: string | null, frName: string | null): TrophyTier | null {
  const en = QUALITY_PREFIX_RE.exec(normalizeName(enName ?? ''))
  if (en) return en[1] as TrophyTier
  const fr = normalizeName(frName ?? '')
  return FR_QUALITY.find(([re]) => re.test(fr))?.[1] ?? null
}

const TIER_LABEL_EN: Record<TrophyTier, string> = { admired: 'Admired', prized: 'Prized', treasured: 'Treasured', cherished: 'Cherished' }

/**
 * Nom anglais d'affichage d'un trophée : si le nom français porte une qualité
 * (« Superbe « Seigneurs des légendes » ») mais pas le nom anglais (« Lord of Legends »,
 * souvent remplacé par le titre de la page wiki), on la rajoute au format du jeu :
 * « Prized 'Lord of Legends' » (apostrophes droites). Sinon, le nom anglais tel quel.
 */
export function withTrophyQualityEn(enName: string, frName: string): string {
  if (QUALITY_PREFIX_RE.test(normalizeName(enName))) return enName
  const tier = trophyTierOf(null, frName)
  if (!tier) return enName
  const quoted = /^['‘"“]/.test(enName.trim()) ? enName.trim() : `'${enName.trim()}'`
  return `${TIER_LABEL_EN[tier]} ${quoted}`
}

/**
 * Coût et prérequis à appliquer à un objet du jeu rapproché d'une page wiki. Trophée
 * avec qualité (« Prized Raven Islehopper Plaque », « Superbe « … » ») : prix et grade de
 * cette qualité, et classe de jalon ajoutée au texte « requires ». Sinon : ceux de la
 * page, tels quels.
 */
export function wikiDataForItem(w: WikiItem, enName: string | null, frName: string | null = null): { cost: WikiCost | null, prereqs: WikiPrereqs | null } {
  const quality = w.tiers ? trophyTierOf(enName, frName) : null
  const tier = quality ? w.tiers?.[quality] : undefined
  if (!tier) return { cost: w.cost, prereqs: w.prereqs }
  const prereqs: WikiPrereqs = { ...(w.prereqs ?? {}) }
  if (prereqs.commendations?.length && tier.grade != null) {
    prereqs.commendations = prereqs.commendations.map((c, i) => i === 0 ? { ...c, grade: tier.grade } : c)
  }
  if (tier.milestone && tier.milestoneClass != null) {
    const milestoneText = `Class ${tier.milestoneClass} in the '${tier.milestone}' Pirate Milestone`
    prereqs.requires = prereqs.requires ? `${prereqs.requires} ; ${milestoneText}` : milestoneText
  }
  return { cost: { gold: tier.gold }, prereqs: Object.keys(prereqs).length ? prereqs : null }
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

  // 2) Wikitext par lots de 50 -> coût + prérequis de l'infobox.
  return fetchWikiItemsByTitles(itemTitles)
}

/**
 * Récupère coût + prérequis pour une liste de titres de pages wiki (lots de 50).
 * Les pages absentes (ou sans infobox {{variant}}) ressortent avec cost/prereqs null.
 * Utilisé pour enrichir ponctuellement quelques items (ex. nouveaux items à l'import),
 * sans parcourir une Category: entière.
 */
export async function fetchWikiItemsByTitles(titles: string[]): Promise<WikiItem[]> {
  const out: WikiItem[] = []
  for (const batch of chunk(titles, 50)) {
    const d = await wikiApi<RevisionsResponse>({
      action: 'query',
      prop: 'revisions|pageimages',
      rvprop: 'content',
      rvslots: 'main',
      piprop: 'original',
      titles: batch.join('|')
    })
    for (const p of Object.values(d.query?.pages ?? {})) {
      const wt = p.revisions?.[0]?.slots?.main?.['*'] ?? ''
      const { cost, prereqs, description, tiers } = parseVariant(wt, p.title)
      out.push({ title: p.title, cost, prereqs, description, image: p.original?.source ?? null, tiers })
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

// ---------------------------------------------------------------------------
// « High Seas only » : commendations jouables uniquement en Haute Mer.
// Sur chaque page de faction, le tableau des commendations marque les lignes
// concernées par un <span title="High Seas only">. On parse le HTML rendu
// (action=parse) plutôt que le wikitext : le marqueur vient de templates
// transclus ({{list comms}} / {{Comm}}) absents du wikitext brut.
// ---------------------------------------------------------------------------

interface ParseTextResponse { parse?: { text?: string } }

// Clé de faction du site -> titre de la page wiki portant le tableau des commendations.
const FACTION_WIKI_PAGE: Record<string, string> = {
  GoldHoarders: 'Gold Hoarders',
  MerchantAlliance: 'Merchant Alliance',
  OrderOfSouls: 'Order of Souls',
  HuntersCall: 'The Hunter\'s Call',
  SeaDogs: 'Sea Dogs',
  ReapersBones: 'Reaper\'s Bones',
  AthenasFortune: 'Athena\'s Fortune'
}

// Décode les entités HTML courantes (le rendu MediaWiki échappe ' & etc.).
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&') // en dernier, pour ne pas ré-décoder
}

/**
 * Extrait, du HTML rendu d'une page de faction, la liste { nom de commendation,
 * High Seas only }. Chaque ligne <tr> du tableau d'emblèmes a une cellule image
 * (<th class="thumb">), une cellule nom (<th id="...">…</th>) et une description ;
 * le marqueur `title="High Seas only"` est présent dans la ligne le cas échéant.
 */
function parseCommendationRestrictions(html: string): Array<{ name: string, highSeasOnly: boolean }> {
  const out: Array<{ name: string, highSeasOnly: boolean }> = []
  const rows = html.split(/<tr\b/i)
  for (const row of rows) {
    const thRe = /<th\b([^>]*)>([\s\S]*?)<\/th>/gi
    let m: RegExpExecArray | null
    let name: string | null = null
    while ((m = thRe.exec(row)) !== null) {
      const attrs = m[1] ?? ''
      if (/class="[^"]*\bthumb\b[^"]*"/i.test(attrs)) continue // cellule image
      if (!/\bid=/i.test(attrs)) continue // la cellule « nom » porte l'ancre id=
      const text = decodeHtmlEntities((m[2] ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
      if (text) {
        name = text
        break
      }
    }
    if (!name) continue
    out.push({ name, highSeasOnly: /title="High Seas only"/i.test(row) })
  }
  return out
}

export interface HighSeasFactionResult {
  factionKey: string
  title: string
  total: number
  highSeas: number
  error?: string
}

/**
 * Récupère le flag « High Seas only » par commendation pour les factions demandées
 * (toutes par défaut). Renvoie une map `nom normalisé -> highSeasOnly` (pour le
 * rapprochement avec les emblèmes) + un récapitulatif par faction.
 */
export async function fetchHighSeasOnlyByName(factionKeys?: string[]): Promise<{
  map: Map<string, boolean>
  perFaction: HighSeasFactionResult[]
}> {
  const keys = factionKeys && factionKeys.length
    ? factionKeys.filter(k => k in FACTION_WIKI_PAGE)
    : Object.keys(FACTION_WIKI_PAGE)
  const map = new Map<string, boolean>()
  const perFaction: HighSeasFactionResult[] = []
  for (const key of keys) {
    const title = FACTION_WIKI_PAGE[key]!
    try {
      const res = await wikiApi<ParseTextResponse>({
        action: 'parse', page: title, prop: 'text', formatversion: '2', redirects: '1'
      })
      const html = res?.parse?.text
      if (!html) {
        perFaction.push({ factionKey: key, title, total: 0, highSeas: 0, error: 'page vide' })
        continue
      }
      const rows = parseCommendationRestrictions(html)
      let hs = 0
      for (const r of rows) {
        const k = normalizeName(r.name)
        // Flag intrinsèque à la commendation : si vue High Seas only quelque part, on garde true.
        map.set(k, (map.get(k) ?? false) || r.highSeasOnly)
        if (r.highSeasOnly) hs++
      }
      perFaction.push({ factionKey: key, title, total: rows.length, highSeas: hs })
    } catch (e) {
      perFaction.push({ factionKey: key, title, total: 0, highSeas: 0, error: (e as Error)?.message?.slice(0, 200) || 'erreur' })
    }
  }
  return { map, perFaction }
}
