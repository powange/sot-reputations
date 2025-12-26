/**
 * Normalise le texte pour la recherche
 * Gère les espaces insécables (U+00A0), multiples espaces, etc.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, ' ')
    .trim()
}

interface EmblemTranslations {
  translations?: Record<string, { name: string | null; description: string | null }>
}

/**
 * Vérifie si un emblème correspond à une recherche
 * Cherche dans le nom et la description en français (par défaut)
 * et dans les traductions de la langue courante si spécifiée
 */
export function emblemMatchesSearch(
  emblem: { name: string; description: string; key?: string } & EmblemTranslations,
  query: string,
  options: { includeKey?: boolean; locale?: string } = {}
): boolean {
  const { includeKey = false, locale } = options
  const q = normalizeForSearch(query)
  if (!q) return true

  // Chercher dans les textes français (par défaut)
  if (normalizeForSearch(emblem.name).includes(q)) return true
  if (normalizeForSearch(emblem.description).includes(q)) return true
  if (includeKey && emblem.key && normalizeForSearch(emblem.key).includes(q)) return true

  // Chercher dans les traductions de la langue courante
  if (locale && locale !== 'fr' && emblem.translations) {
    const translation = emblem.translations[locale]
    if (translation) {
      if (translation.name && normalizeForSearch(translation.name).includes(q)) return true
      if (translation.description && normalizeForSearch(translation.description).includes(q)) return true
    }
  }

  return false
}
