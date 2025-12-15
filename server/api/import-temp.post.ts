import { storeTempData } from '../utils/temp-store'

export default defineEventHandler(async (event) => {
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
