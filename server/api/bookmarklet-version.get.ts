// Version actuelle du bookmarklet
// Incrémenter cette valeur à chaque modification du bookmarklet
export const BOOKMARKLET_VERSION = 4

export default defineEventHandler(() => {
  return {
    version: BOOKMARKLET_VERSION
  }
})
