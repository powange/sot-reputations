// Aperçu des données wiki du coffre (/admin/chest-costs) : types de la réponse de
// /api/admin/chest-costs/fetch et comparaison avec la base (n'appliquer que ce qui change).

export interface ChestCostScope { category: string, subcategory: string | null, count: number, withCost: number, wikiCategory: string | null }
export interface ChestCost { gold?: number, doubloons?: number, ancientCoins?: number }
export interface ChestPrereqs { commendations?: Array<{ name: string, grade: number | null }>, factionLevels?: Record<string, number>, legendary?: boolean, requires?: string }
// image = image du catalogue ; wikiImage = image de la page wiki rapprochée (repli).
export interface ChestCostMatched { id: number, name: string, enName: string | null, image: string | null, wikiImage: string | null, wikiTitle: string, cost: ChestCost, currentCost: ChestCost | null, prereqs: ChestPrereqs | null, currentPrereqs: ChestPrereqs | null }
export interface ChestCostNoCost { id: number, name: string, enName: string | null, image: string | null, wikiImage: string | null, wikiTitle: string, prereqs: ChestPrereqs | null, currentPrereqs: ChestPrereqs | null }
// wikiName = surcharge du nom cherché sur le wiki (null : on cherche le nom anglais).
export interface ChestCostUnmatched { id: number, name: string, enName: string | null, wikiName: string | null, image: string | null }
// variantOf = nom de base d'une page de variante « Nom (Précision) » (nom de l'objet dans le jeu).
export interface ChestCostWikiOnly { title: string, cost: ChestCost | null, image: string | null, variantOf: string | null }
export interface ChestCostFetchResult {
  category: string
  subcategory: string | null
  wikiCategory: string
  matched: ChestCostMatched[]
  noCost: ChestCostNoCost[]
  unmatched: ChestCostUnmatched[]
  wikiOnly: ChestCostWikiOnly[]
  counts: { items: number, wiki: number, matched: number, noCost: number, unmatched: number, wikiOnly: number }
}

// Sections de l'aperçu, affichables au choix.
export type ChestCostSection = 'matched' | 'noCost' | 'unmatched' | 'wikiOnly'

/** Clé stable d'une sous-catégorie (catégorie + sous-catégorie). */
export function chestCostScopeKey(s: { category: string, subcategory: string | null }): string {
  return `${s.category}\u0000${s.subcategory ?? ''}`
}

export function formatChestCost(cost: ChestCost | null): string {
  if (!cost) return '—'
  const parts: string[] = []
  if (cost.gold != null) parts.push(`${cost.gold.toLocaleString('fr-FR')} or`)
  if (cost.doubloons != null) parts.push(`${cost.doubloons.toLocaleString('fr-FR')} doublons`)
  if (cost.ancientCoins != null) parts.push(`${cost.ancientCoins.toLocaleString('fr-FR')} pièces anciennes`)
  return parts.length ? parts.join(' · ') : '—'
}

// JSON à clés triées : l'ordre des clés ne doit pas faire croire à un changement.
function stableJson(v: unknown): string {
  return JSON.stringify(v ?? null, (_k, val) => val && typeof val === 'object' && !Array.isArray(val)
    ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
    : val)
}

export function sameChestCost(a: ChestCost | null, b: ChestCost | null): boolean {
  return stableJson(a) === stableJson(b)
}

// Prérequis à écrire : seulement si le wiki en donne (on n'envoie jamais null, qui
// effacerait l'existant) ET qu'ils diffèrent de ceux en base.
export function chestPrereqsChanged(x: { prereqs: ChestPrereqs | null, currentPrereqs: ChestPrereqs | null }): boolean {
  return !!x.prereqs && stableJson(x.prereqs) !== stableJson(x.currentPrereqs)
}

// Ligne à appliquer : coût OU prérequis différents de la base.
export function chestMatchedChanged(m: ChestCostMatched): boolean {
  return !sameChestCost(m.cost, m.currentCost) || chestPrereqsChanged(m)
}
