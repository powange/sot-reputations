import { storeTempData, TRANSLATION_MAX_BYTES } from '../../utils/temp-store'
import { setBookmarkletCors } from '../../utils/cors'

export default defineEventHandler(async (event) => {
  // CORS restreint à seaofthieves.com (bookmarklet)
  setBookmarkletCors(event)

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

  const code = storeTempData(body, TRANSLATION_MAX_BYTES)

  return {
    success: true,
    code
  }
})
