import { requireAdminOrModerator } from '../../utils/admin'
import { getTempData } from '../../utils/temp-store'

interface TranslationData {
  fr: Record<string, unknown>
  en: Record<string, unknown>
  es: Record<string, unknown>
}

export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const query = getQuery(event)
  const code = query.code as string

  if (!code) {
    throw createError({
      statusCode: 400,
      message: 'Code requis'
    })
  }

  const data = getTempData(code) as TranslationData | null

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
