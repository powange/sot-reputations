import { requireAdmin } from '../../../utils/admin'
import { getFireworksAnchor, resetFireworksAnchor } from '../../../utils/fireworks'

// Revient au planning par défaut (DEFAULT_FIREWORKS_ANCHOR)
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  resetFireworksAnchor()
  return getFireworksAnchor()
})
