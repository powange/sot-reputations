export interface ReputationTranslationsImportResult {
  success: boolean
  factions: { fr: number, en: number, es: number }
  campaigns: { fr: number, en: number, es: number }
}

/**
 * Appel partagé vers l'endpoint d'import des traductions de réputation
 * (mottos de factions + Title/Desc des campagnes). Utilisé par le flux
 * bookmarklet (page Traductions) et la modale manuelle (page Éditer les
 * factions) pour éviter que les deux divergent.
 */
export function useReputationTranslationsImport() {
  function importReputationTranslations(payload: { fr?: unknown, en?: unknown, es?: unknown }) {
    return $fetch<ReputationTranslationsImportResult>(
      '/api/admin/factions-edition/import-translations',
      { method: 'POST', body: payload }
    )
  }

  return { importReputationTranslations }
}
