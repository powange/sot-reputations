import { requireAdminOrModerator } from '../../../utils/admin'
import { getChestColorStatus } from '../../../utils/reputation-db'

export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  const status = getChestColorStatus()
  return { ...status, remaining: status.total - status.analyzed }
})
