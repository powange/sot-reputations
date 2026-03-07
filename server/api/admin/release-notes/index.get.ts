import { requireAdminOrModerator } from '../../../utils/admin'
import { getReleaseNotes } from '../../../utils/release-notes-db'

export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)
  return getReleaseNotes()
})
