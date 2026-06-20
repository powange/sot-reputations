import { requireAdmin } from '../../../utils/admin'
import { listApiTokens } from '../../../utils/api-token'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listApiTokens()
})
