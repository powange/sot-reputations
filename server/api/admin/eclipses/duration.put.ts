import { ECLIPSE_DURATION_LIMITS, isValidEclipseDuration } from '#shared/utils/eclipses'
import { requireAdmin } from '../../../utils/admin'
import { getEclipseSettings, setEclipseDuration } from '../../../utils/eclipses'

// Durée d'une éclipse (minutes, 0 = inconnue) : pendant ce temps la page l'affiche « en cours »
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ minutes?: unknown }>(event)
  const minutes = Number(body?.minutes)
  if (!isValidEclipseDuration(minutes)) {
    throw createError({
      statusCode: 400,
      message: `Durée invalide (de ${ECLIPSE_DURATION_LIMITS.min} à ${ECLIPSE_DURATION_LIMITS.max} minutes)`
    })
  }
  setEclipseDuration(minutes)
  return getEclipseSettings()
})
