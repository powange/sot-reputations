import { requireApiToken } from '../../../../utils/api-token'
import { getChestCatalog } from '../../../../utils/reputation-db'
import { renderChestItemsMarkdown } from '../../../../utils/chest-items-agent'
import { wantsMarkdown, sendMarkdown } from '../../../../utils/api-markdown'

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Items du coffre d'une sous-catégorie (ex. `Pets/Parrot`) : clé, nom et
 * description FR/EN, image, coût d'achat et prérequis d'obtention.
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const category = getRouterParam(event, 'category', { decode: true })?.trim() || ''
  const subcategory = getRouterParam(event, 'subcategory', { decode: true })?.trim() || ''
  const chestItems = category && subcategory ? getChestCatalog({ category, subcategory }) : []
  if (!chestItems.length) {
    throw createError({ statusCode: 404, message: `Sous-catégorie « ${category}/${subcategory} » introuvable` })
  }

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderChestItemsMarkdown(chestItems))
  }

  return {
    category: chestItems[0]!.category,
    subcategory: chestItems[0]!.subcategory,
    count: chestItems.length,
    chestItems
  }
})
