import { createMerrickQuest, sanitizeMerrickDishes } from '../../utils/merrick-db'

// Création ouverte à tous (pas de compte) : limite simple par IP pour éviter le spam.
const CREATE_LIMIT = 20
const CREATE_WINDOW_MS = 60 * 60 * 1000
const recentCreations = new Map<string, number[]>()

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const now = Date.now()
  const recent = (recentCreations.get(ip) ?? []).filter(ts => now - ts < CREATE_WINDOW_MS)
  if (recent.length >= CREATE_LIMIT) {
    throw createError({ statusCode: 429, message: 'Trop de listes créées, réessayez plus tard' })
  }

  const body = await readBody<{ dishes?: unknown }>(event)
  const dishes = sanitizeMerrickDishes(body?.dishes)
  const token = createMerrickQuest(dishes)

  recent.push(now)
  recentCreations.set(ip, recent)
  return { token }
})
