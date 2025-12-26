import { storeTempData } from '../../utils/temp-store'

export default defineEventHandler(async (event) => {
  // Headers CORS pour permettre les requêtes depuis seaofthieves.com (bookmarklet)
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')

  const body = await readBody(event)

  // Vérifier que les 3 langues sont présentes
  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Donnees invalides'
    })
  }

  if (!body.fr || !body.en || !body.es) {
    throw createError({
      statusCode: 400,
      message: 'Les donnees des 3 langues (fr, en, es) sont requises'
    })
  }

  const code = storeTempData(body)

  return {
    success: true,
    code
  }
})
