import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestTranslationOverview } from '../../../utils/reputation-db'

/**
 * POST /api/admin/chest-items/lookup  { keys: string[] }
 * Valeurs actuelles (noms, descriptions, nom wiki) des objets désignés par leur clé, pour
 * comparer un import (CSV, réponse d'IA) à la base avant de l'appliquer.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const body = await readBody<{ keys?: unknown }>(event)
  const keys = new Set(Array.isArray(body?.keys) ? body.keys.filter((k): k is string => typeof k === 'string') : [])
  if (keys.size > 20000) throw createError({ statusCode: 400, statusMessage: 'Trop de clés (20 000 max.)' })
  const { items } = getChestTranslationOverview({ status: 'all' }, 0, 100000)
  return { items: items.filter(i => keys.has(i.itemKey)) }
})
