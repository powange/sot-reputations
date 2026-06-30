import { requireApiToken } from '../../utils/api-token'
import { getChestCatalog, type ChestCatalogItem } from '../../utils/reputation-db'
import { wantsMarkdown, sendMarkdown, mdInline, pushMdHeading } from '../../utils/api-markdown'

/**
 * Rendu Markdown du catalogue : titres par catégorie puis sous-catégorie, items
 * en puces « **Nom** (`clé`) — description ». Les items arrivent déjà triés
 * (catégorie, sous-catégorie, ordre), on émet un titre au changement.
 */
function renderChestItemsMarkdown(items: ChestCatalogItem[]): string {
  const lines: string[] = []
  pushMdHeading(lines, `# Catalogue du coffre (${items.length} items)`)
  let category: string | null = null
  let subcategory: string | null | undefined
  for (const item of items) {
    if (item.category !== category) {
      category = item.category
      subcategory = undefined
      pushMdHeading(lines, `## ${item.category}`)
    }
    if ((item.subcategory ?? null) !== subcategory) {
      subcategory = item.subcategory ?? null
      if (subcategory) pushMdHeading(lines, `### ${subcategory}`)
    }
    const desc = mdInline(item.description)
    lines.push(`- **${mdInline(item.name)}** (\`${item.key}\`)${desc ? ` — ${desc}` : ''}`)
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
