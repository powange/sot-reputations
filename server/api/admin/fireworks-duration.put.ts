import { FIREWORKS_DURATION_LIMITS, isValidFireworksDuration } from '#shared/utils/fireworks'
import { requireAdmin } from '../../utils/admin'
import { getFireworksAnchor, setFireworksDuration } from '../../utils/fireworks'

// Durée d'un feu d'artifice (minutes) : pendant ce temps l'avant-poste est « en cours »
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ minutes?: unknown }>(event)
  const minutes = Number(body?.minutes)
  if (!isValidFireworksDuration(minutes)) {
    throw createError({
      statusCode: 400,
      message: `Durée invalide (de ${FIREWORKS_DURATION_LIMITS.min} à ${FIREWORKS_DURATION_LIMITS.max} minutes)`
    })
  }
  setFireworksDuration(minutes)
  return getFireworksAnchor()
})
