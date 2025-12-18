/**
 * Utilitaires pour le filtrage des emblèmes
 * Utilisé par les pages mes-reputations et groupe
 */

export type CompletionFilter = 'all' | 'incomplete' | 'complete'

export interface FilterOptions {
  /** Filtre de complétion: tous, complétés, non complétés */
  completionFilter: CompletionFilter
  /** Si true, cache les emblèmes sans données */
  ignoreWithoutData: boolean
  /** Si true, ne montre que les emblèmes non complétés par personne (groupe uniquement) */
  onlyNotCompletedByAnyone?: boolean
}

export interface EmblemFilterCallbacks<T> {
  /** Vérifie si l'emblème est considéré comme "complété" */
  isCompleted: (emblem: T) => boolean
  /** Vérifie si l'emblème a des données (non null/undefined) */
  hasData: (emblem: T) => boolean
  /** Vérifie si l'emblème n'est complété par personne (optionnel, pour groupe) */
  isCompletedByNone?: (emblem: T) => boolean
}

/**
 * Filtre une liste d'emblèmes selon les options et callbacks fournis
 */
export function filterEmblems<T>(
  emblems: T[],
  options: FilterOptions,
  callbacks: EmblemFilterCallbacks<T>
): T[] {
  const { completionFilter, ignoreWithoutData, onlyNotCompletedByAnyone } = options
  const { isCompleted, hasData, isCompletedByNone } = callbacks

  // Pas de filtrage si "tous"
  if (completionFilter === 'all') {
    return emblems
  }

  return emblems.filter(emblem => {
    // Si "ignorer sans données" est activé, cacher les emblèmes sans données
    if (ignoreWithoutData && !hasData(emblem)) {
      return false
    }

    const completed = isCompleted(emblem)

    if (completionFilter === 'complete') {
      return completed
    } else {
      // Non complétés
      if (!completed) {
        // Si le switch "non complétés par personne" est activé
        if (onlyNotCompletedByAnyone && isCompletedByNone) {
          return isCompletedByNone(emblem)
        }
        return true
      }
      return false
    }
  })
}
