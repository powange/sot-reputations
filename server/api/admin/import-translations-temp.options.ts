import { setBookmarkletCors } from '../../utils/cors'

export default defineEventHandler((event) => {
  // Headers CORS pour la requête preflight
  setBookmarkletCors(event, 'GET, POST, OPTIONS')
  setHeader(event, 'Access-Control-Max-Age', 86400)

  return null
})
