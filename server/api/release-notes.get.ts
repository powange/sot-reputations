import { getReleaseNotesWithContent } from '../utils/release-notes-db'

export default defineEventHandler(() => {
  return getReleaseNotesWithContent()
})
