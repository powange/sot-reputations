import { isValidEclipseObservation } from '#shared/utils/eclipses'
import { requireAdmin } from '../../../utils/admin'
import { getEclipseSettings, setEclipseObservation } from '../../../utils/eclipses'

// Recale le planning : « la Nième éclipse d'une série a eu lieu à tel instant »
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ at?: unknown, order?: unknown }>(event)
  const observation = { at: Number(body?.at), order: Number(body?.order) }
  if (!isValidEclipseObservation(observation)) {
    throw createError({ statusCode: 400, message: 'Horaire ou rang dans la série invalide' })
  }
  setEclipseObservation(observation)
  return getEclipseSettings()
})
