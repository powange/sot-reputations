import { requireAdmin } from '../../../utils/admin'
import { getEclipseSettings, resetEclipseObservation } from '../../../utils/eclipses'

// Revient au planning par défaut (ECLIPSE_ANCHOR)
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  resetEclipseObservation()
  return getEclipseSettings()
})
