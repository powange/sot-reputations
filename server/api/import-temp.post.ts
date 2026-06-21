import { storeTempData, IMPORT_MAX_BYTES } from '../utils/temp-store'
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

  // Le payload peut contenir réputation + coffre (~6000 items) → limite élargie.
  const code = storeTempData(body, IMPORT_MAX_BYTES)

  return {
    success: true,
    code
  }
})
