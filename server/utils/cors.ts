import type { H3Event } from 'h3'

// Le bookmarklet s'exécute dans le contexte de seaofthieves.com : on n'autorise
// que cette origine (au lieu de '*') pour limiter l'abus depuis des sites tiers.
const BOOKMARKLET_ALLOWED_ORIGIN = 'https://www.seaofthieves.com'

export function setBookmarkletCors(event: H3Event, methods = 'POST, OPTIONS'): void {
  setHeader(event, 'Access-Control-Allow-Origin', BOOKMARKLET_ALLOWED_ORIGIN)
  setHeader(event, 'Access-Control-Allow-Methods', methods)
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  setHeader(event, 'Vary', 'Origin')
}
