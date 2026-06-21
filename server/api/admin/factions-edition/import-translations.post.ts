import { requireAdminOrModerator } from '../../../utils/admin'
import { importFactionMottoTranslations, importCampaignTranslations } from '../../../utils/reputation-db'

type ReputationLocalePayload = Record<string, Record<string, unknown>>

interface ImportBody {
  fr?: ReputationLocalePayload
  en?: ReputationLocalePayload
  es?: ReputationLocalePayload
}

/**
 * POST /api/admin/factions-edition/import-translations
 * Importe les traductions de réputation (factions: motto ; campagnes: Title/Desc)
 * depuis les données officielles récupérées par langue (bookmarklet de
 * traductions). Met à jour le FR de base et les traductions EN/ES des entités
 * déjà en base ; aucune entité n'est créée.
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

  const payload = {
    fr: isObject(body.fr) ? body.fr : undefined,
    en: isObject(body.en) ? body.en : undefined,
    es: isObject(body.es) ? body.es : undefined
  }

  const factions = importFactionMottoTranslations(payload)
  const campaigns = importCampaignTranslations(payload)

  return { success: true, factions, campaigns }
})
