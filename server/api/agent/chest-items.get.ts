import { requireApiToken } from '../../utils/api-token'
import { getChestCatalog, type ChestCatalogItem } from '../../utils/reputation-db'
import { wantsMarkdown, sendMarkdown, mdInline, pushMdHeading } from '../../utils/api-markdown'

/**
 * Rendu Markdown du catalogue : titres par catégorie puis sous-catégorie, items
 * en puces « **Nom** (`clé`) — description ».
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
      }
    }
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie l'intégralité du catalogue d'items du coffre (non lié à un
 * utilisateur) : clé, catégorie, sous-catégorie, nom FR, description FR, image.
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
