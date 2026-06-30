import { requireApiToken } from '../../utils/api-token'
import { getChestCatalog, type ChestCatalogItem, type ChestItemCost, type ChestItemPrereqs } from '../../utils/reputation-db'
import { wantsMarkdown, sendMarkdown, mdInline, pushMdHeading } from '../../utils/api-markdown'

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
 * Rendu Markdown du catalogue : titres par catégorie puis sous-catégorie, items
 * en puces « **Nom** (`clé`) — description », puis sous-puces image / coût /
 * prérequis quand l'info existe.
 *
 * On regroupe explicitement par catégorie → sous-catégorie (Map = ordre de
 * première apparition). Sans ça, le tri d'origine (par set/thème) entrelace les
 * sous-catégories et produit des titres fragmentés : la même « Wheel » répétée
 * des dizaines de fois → arbre de titres trompeur pour une IA.
 */
function renderChestItemsMarkdown(items: ChestCatalogItem[]): string {
  const lines: string[] = []
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
    pushMdHeading(lines, `## ${mdInline(category)}`)
    for (const [sub, bucket] of subs) {
      if (sub) pushMdHeading(lines, `### ${mdInline(sub)}`)
      for (const item of bucket) {
        const desc = mdInline(item.description)
        lines.push(`- **${mdInline(item.name)}** (\`${item.key}\`)${desc ? ` — ${desc}` : ''}`)
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

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie l'intégralité du catalogue d'items du coffre (non lié à un
 * utilisateur) : clé, catégorie, sous-catégorie, nom FR, description FR, image
 * (URL complète), coût d'achat et prérequis d'obtention.
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const chestItems = getChestCatalog()

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderChestItemsMarkdown(chestItems))
  }

  return {
    count: chestItems.length,
    chestItems
  }
})
