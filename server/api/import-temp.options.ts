export default defineEventHandler((event) => {
  // Handler pour les requêtes preflight CORS (OPTIONS)
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  setResponseStatus(event, 204)
  return ''
})
