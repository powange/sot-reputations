export interface FactionMottoImportResult {
  success: boolean
  updatedFr: number
  updatedEn: number
  updatedEs: number
}

/**
 * Appel partagé vers l'endpoint d'import des mottos de factions.
 * Utilisé par le flux bookmarklet (page Traductions) et par la modale manuelle
 * (page Éditer les factions) pour éviter que les deux divergent.
 */
export function useFactionTranslationsImport() {
  function importFactionMottos(payload: { fr?: unknown, en?: unknown, es?: unknown }) {
    return $fetch<FactionMottoImportResult>(
      '/api/admin/factions-edition/import-translations',
      { method: 'POST', body: payload }
    )
  }

  return { importFactionMottos }
}
