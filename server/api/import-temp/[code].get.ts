import { getTempData } from '../../utils/temp-store'

export default defineEventHandler((event) => {
  const code = getRouterParam(event, 'code')

  if (!code) {
    throw createError({
      statusCode: 400,
      message: 'Code requis'
    })
  }

  const data = getTempData(code)

  if (!data) {
    throw createError({
      statusCode: 404,
      message: 'Donnees non trouvees ou expirees'
    })
  }

  return {
    success: true,
    data
  }
})
