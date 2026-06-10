import { storeTempData } from '../utils/temp-store'
import { setBookmarkletCors } from '../utils/cors'

export default defineEventHandler(async (event) => {
  // CORS restreint à seaofthieves.com (bookmarklet)
  setBookmarkletCors(event)

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
