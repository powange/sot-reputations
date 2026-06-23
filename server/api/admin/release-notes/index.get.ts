import { requireAdmin } from '../../../utils/admin'
import { getReleaseNotes } from '../../../utils/release-notes-db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getReleaseNotes()
})
