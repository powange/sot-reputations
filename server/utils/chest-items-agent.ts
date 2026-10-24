import { getReputationDb, getChestTaxonomy, getChestTaxonomyTranslations, type ChestCatalogItem, type ChestItemCost, type ChestItemPrereqs, type ChestTaxonomyTranslations } from './reputation-db'
import { mdInline, pushMdHeading } from './api-markdown'

// Nom FR des factions à partir de la clé courte du wiki (cf. i18n factionNames).
const FACTION_NAMES_FR: Record<string, string> = {
  hoarder: 'Collectionneurs d\'or',
  merchant: 'Alliance des marchands',
  souls: 'Ordre des âmes',
  hunter: 'L\'appel du chasseur',
  seadog: 'Loups de mer',
  reaper: 'Os de la faucheuse',
  athena: 'Fortune d\'Athéna',
  flame: 'Serviteurs de la Flamme',
  guardians: 'Gardiens de la Fortune'
}

/** Libellé d'une catégorie / sous-catégorie en FR et EN (null si non traduit). */
export interface ChestLabel {
  fr: string | null
  en: string | null
}

export interface ChestSubcategorySummary {
  key: string
  label: ChestLabel
  count: number
  url: string
}

export interface ChestCategorySummary {
  key: string
  label: ChestLabel
  count: number
  url: string
  subcategories: ChestSubcategorySummary[]
}

/** Chemin de l'endpoint agent d'une catégorie, ou d'une sous-catégorie de cette catégorie. */
export function chestItemsAgentPath(category: string, subcategory?: string): string {
  const base = `/api/agent/chest-items/${encodeURIComponent(category)}`
  return subcategory ? `${base}/${encodeURIComponent(subcategory)}` : base
}

function categoryLabel(tr: ChestTaxonomyTranslations, category: string): ChestLabel {
  const t = tr.categories[category]
  return { fr: t?.fr ?? null, en: t?.en ?? null }
}

function subcategoryLabel(tr: ChestTaxonomyTranslations, category: string, subcategory: string): ChestLabel {
  const t = tr.subcategories[category]?.[subcategory]
  return { fr: t?.fr ?? null, en: t?.en ?? null }
}

/** Titre Markdown d'une catégorie : « Libellé FR / EN (`Clé`) », la clé seule si non traduite. */
function mdLabel(label: ChestLabel, key: string): string {
  const names = [...new Set([label.fr, label.en].filter((n): n is string => !!n))].map(mdInline)
  return names.length ? `${names.join(' / ')} (\`${key}\`)` : `\`${key}\``
}

/**
 * Sommaire du catalogue : catégories (ordre du jeu) et leurs sous-catégories, avec
 * libellés FR/EN, nombre d'items et chemin de l'endpoint qui les détaille.
 */
export function getChestItemsIndex(): ChestCategorySummary[] {
  const counts = getReputationDb().prepare(`
    SELECT category, subcategory, COUNT(*) AS count FROM chest_items GROUP BY category, subcategory
  `).all() as Array<{ category: string, subcategory: string | null, count: number }>
  const countOf = new Map(counts.map(c => [`${c.category}\u0000${c.subcategory ?? ''}`, c.count]))
  const tr = getChestTaxonomyTranslations()

  return getChestTaxonomy().map(({ category, subcategories }) => {
    const subs = subcategories.map(sub => ({
      key: sub,
      label: subcategoryLabel(tr, category, sub),
      count: countOf.get(`${category}\u0000${sub}`) ?? 0,
      url: chestItemsAgentPath(category, sub)
    }))
    return {
      key: category,
      label: categoryLabel(tr, category),
      count: counts.filter(c => c.category === category).reduce((n, c) => n + c.count, 0),
      url: chestItemsAgentPath(category),
      subcategories: subs
    }
  })
}

/** Coût formaté « 1000 pièces d'or / 50 doublons », ou '' si gratuit/non achetable. */
function formatCost(cost: ChestItemCost | null): string {
  if (!cost) return ''
  const parts: string[] = []
  if (cost.gold != null) parts.push(`${cost.gold} pièces d'or`)
  if (cost.doubloons != null) parts.push(`${cost.doubloons} doublons`)
  if (cost.ancientCoins != null) parts.push(`${cost.ancientCoins} pièces anciennes`)
  return parts.join(' / ')
}

/** Prérequis d'obtention formatés en une ligne, ou '' si aucun. */
function formatPrereqs(prereqs: ChestItemPrereqs | null): string {
  if (!prereqs) return ''
  const parts: string[] = []
  if (prereqs.factionLevels) {
    for (const [key, level] of Object.entries(prereqs.factionLevels)) {
      parts.push(`réputation ${FACTION_NAMES_FR[key] ?? key} niveau ${level}`)
    }
  }
  if (prereqs.commendations) {
    for (const c of prereqs.commendations) {
      parts.push(`commendation « ${mdInline(c.name)} »${c.grade != null ? ` grade ${c.grade}` : ''}`)
    }
  }
  if (prereqs.legendary) parts.push('Pirate Légendaire')
  if (prereqs.requires) parts.push(`requiert ${mdInline(prereqs.requires)}`)
  return parts.join(' ; ')
}

/**
 * Rendu Markdown d'items du coffre : titres par catégorie puis sous-catégorie,
 * items en puces « **Nom FR** / *Nom EN* (`clé`) — description FR », puis
 * sous-puces description EN / image / coût / prérequis quand l'info existe.
 *
 * On regroupe explicitement par catégorie → sous-catégorie (Map = ordre de
 * première apparition). Sans ça, le tri d'origine (par set/thème) entrelace les
 * sous-catégories et produit des titres fragmentés : la même « Wheel » répétée
 * des dizaines de fois → arbre de titres trompeur pour une IA.
 */
export function renderChestItemsMarkdown(items: ChestCatalogItem[]): string {
  const lines: string[] = []
  const tr = getChestTaxonomyTranslations()
  pushMdHeading(lines, `# Catalogue du coffre (${items.length} items)`)

  const byCategory = new Map<string, Map<string, ChestCatalogItem[]>>()
  for (const item of items) {
    let subs = byCategory.get(item.category)
    if (!subs) {
      subs = new Map()
      byCategory.set(item.category, subs)
    }
    const sub = item.subcategory ?? ''
    let bucket = subs.get(sub)
    if (!bucket) {
      bucket = []
      subs.set(sub, bucket)
    }
    bucket.push(item)
  }

  for (const [category, subs] of byCategory) {
    pushMdHeading(lines, `## ${mdLabel(categoryLabel(tr, category), category)}`)
    for (const [sub, bucket] of subs) {
      if (sub) pushMdHeading(lines, `### ${mdLabel(subcategoryLabel(tr, category, sub), sub)}`)
      for (const item of bucket) {
        const desc = mdInline(item.descriptionFr)
        const en = item.nameEn && item.nameEn !== item.nameFr ? ` / *${mdInline(item.nameEn)}*` : ''
        lines.push(`- **${mdInline(item.nameFr)}**${en} (\`${item.key}\`)${desc ? ` — ${desc}` : ''}`)
        const descEn = mdInline(item.descriptionEn)
        if (descEn) lines.push(`  - Description (EN) : ${descEn}`)
        if (item.image) lines.push(`  - Image : ${item.image}`)
        const cost = formatCost(item.cost)
        if (cost) lines.push(`  - Coût : ${cost}`)
        const prereqs = formatPrereqs(item.prerequisites)
        if (prereqs) lines.push(`  - Prérequis : ${prereqs}`)
      }
    }
  }
  lines.push('')
  return lines.join('\n')
}
