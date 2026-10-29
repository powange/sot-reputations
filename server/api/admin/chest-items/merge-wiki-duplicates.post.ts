import { requireAdminOrModerator } from '../../../utils/admin'
import { mergeWikiDuplicates } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-items/merge-wiki-duplicates  { apply }
 * Fusionne les items wiki qui doublonnent un objet officiel (« X Emote » du wiki = « X »
 * du jeu…) dans cet objet, puis les supprime. apply = false : aperçu sans écriture.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const body = await readBody<{ apply?: unknown }>(event)
  return mergeWikiDuplicates(body?.apply === true)
})
