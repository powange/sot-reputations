import { storeTempData } from '../utils/temp-store'

export default defineEventHandler(async (event) => {
  // Headers CORS pour permettre les requêtes depuis seaofthieves.com (bookmarklet)
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })

  const body = await readBody(event)

  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Donnees invalides'
    })
  }

  const code = storeTempData(body)

  return {
    success: true,
    code
  }
})
