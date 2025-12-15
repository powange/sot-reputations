export default defineEventHandler((event) => {
  // Handler pour les requêtes preflight CORS (OPTIONS)
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  return null
})
