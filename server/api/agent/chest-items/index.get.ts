import { requireApiToken } from '../../../utils/api-token'
import { getChestItemsIndex, type ChestCategorySummary, type ChestLabel } from '../../../utils/chest-items-agent'
import { wantsMarkdown, sendMarkdown, mdInline, pushMdHeading } from '../../../utils/api-markdown'

function mdName(label: ChestLabel, key: string): string {
  const names = [...new Set([label.fr, label.en].filter((n): n is string => !!n))].map(mdInline)
  return names.length ? names.join(' / ') : key
}

/**
 * Rendu Markdown : une section par catégorie (libellés FR/EN, nombre d'items,
 * chemin de son endpoint), ses sous-catégories en puces avec le leur.
 */
function renderIndexMarkdown(categories: ChestCategorySummary[]): string {
  const lines: string[] = []
  const total = categories.reduce((n, c) => n + c.count, 0)
  pushMdHeading(lines, `# Catalogue du coffre (${total} items)`)
  lines.push('Items d\'une catégorie : `GET /api/agent/chest-items/<catégorie>` ; d\'une sous-catégorie : `GET /api/agent/chest-items/<catégorie>/<sous-catégorie>`.')
  for (const c of categories) {
    pushMdHeading(lines, `## ${mdName(c.label, c.key)} (${c.count}) — \`${c.url}\``)
    for (const s of c.subcategories) {
      lines.push(`- ${mdName(s.label, s.key)} (${s.count}) : \`${s.url}\``)
    }
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Sommaire du catalogue du coffre : catégories et sous-catégories avec libellés
 * FR/EN et nombre d'items, sans les items (voir `chest-items/[category]` et
 * `chest-items/[category]/[subcategory]`).
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const categories = getChestItemsIndex()

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderIndexMarkdown(categories))
  }

  return {
    count: categories.reduce((n, c) => n + c.count, 0),
    categories
  }
})
