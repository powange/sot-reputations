import { setBookmarkletCors } from '../utils/cors'

export default defineEventHandler((event) => {
  // Handler pour les requêtes preflight CORS (OPTIONS)
  setBookmarkletCors(event)
  setResponseStatus(event, 204)
  return ''
})
