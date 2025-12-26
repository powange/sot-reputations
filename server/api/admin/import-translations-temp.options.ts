export default defineEventHandler((event) => {
  // Headers CORS pour la requête preflight
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  setHeader(event, 'Access-Control-Max-Age', '86400')

  return null
})
