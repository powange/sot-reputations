import { BOOKMARKLET_VERSION } from '~/utils/bookmarklet'
import { setBookmarkletCors } from '../utils/cors'

export default defineEventHandler((event) => {
  // Appelé en cross-origin depuis le bookmarklet (seaofthieves.com)
  setBookmarkletCors(event, 'GET, OPTIONS')

  return {
    version: BOOKMARKLET_VERSION
  }
})
