import { requireAdminOrModerator } from '../../../utils/admin'
import { importFactionMottoTranslations } from '../../../utils/reputation-db'

type ReputationLocalePayload = Record<string, { Motto?: unknown }>

interface ImportBody {
  fr?: ReputationLocalePayload
  en?: ReputationLocalePayload
  es?: ReputationLocalePayload
}

/**
 * POST /api/admin/factions-edition/import-translations
 * Importe les mottos de factions (FR de base + traductions EN/ES) depuis les
 * données de réputation officielles récupérées par langue (bookmarklet de
 * traductions). Aucune faction n'est créée : seules celles déjà en base sont
 * mises à jour.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const body = await readBody<ImportBody>(event)

  const isObject = (v: unknown): v is ReputationLocalePayload =>
    !!v && typeof v === 'object' && !Array.isArray(v)

  if (!body || (!isObject(body.fr) && !isObject(body.en) && !isObject(body.es))) {
    throw createError({
      statusCode: 400,
      message: 'Au moins une langue (fr, en ou es) de données de réputation est requise'
    })
  }

  const counts = importFactionMottoTranslations({
    fr: isObject(body.fr) ? body.fr : undefined,
    en: isObject(body.en) ? body.en : undefined,
    es: isObject(body.es) ? body.es : undefined
  })

  return {
    success: true,
    updatedFr: counts.fr,
    updatedEn: counts.en,
    updatedEs: counts.es
  }
})
