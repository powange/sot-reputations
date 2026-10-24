import { requireApiToken } from '../../../../utils/api-token'
import { getChestCatalog } from '../../../../utils/reputation-db'
import { renderChestItemsMarkdown } from '../../../../utils/chest-items-agent'
import { wantsMarkdown, sendMarkdown } from '../../../../utils/api-markdown'

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Items du coffre d'une catégorie (ex. `Pets`) : clé, sous-catégorie, nom et
 * description FR/EN, image, coût d'achat et prérequis d'obtention.
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const category = getRouterParam(event, 'category', { decode: true })?.trim() || ''
  const chestItems = category ? getChestCatalog({ category }) : []
  if (!chestItems.length) {
    throw createError({ statusCode: 404, message: `Catégorie « ${category} » introuvable` })
  }

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderChestItemsMarkdown(chestItems))
  }

  return {
    category: chestItems[0]!.category,
    count: chestItems.length,
    chestItems
  }
})
