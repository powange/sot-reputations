import { requireAdmin } from '../../../utils/admin'
import { syncReleaseNotes } from '../../../utils/release-notes-sync'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await syncReleaseNotes()
})
