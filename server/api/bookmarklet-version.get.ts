import { BOOKMARKLET_VERSION } from '~/utils/bookmarklet'

export default defineEventHandler(() => {
  return {
    version: BOOKMARKLET_VERSION
  }
})
