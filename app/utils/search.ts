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
  translations?: Record<string, { name: string | null, description: string | null }>
}

/**
 * Vérifie si un emblème correspond à une recherche : nom et description en français et
 * dans TOUTES les traductions disponibles (EN, ES…), quelle que soit la langue affichée,
 * pour trouver un emblème par n'importe lequel de ses noms.
 */
export function emblemMatchesSearch(
  emblem: { name: string, description: string | null, key?: string } & EmblemTranslations,
  query: string,
  // locale : conservé pour compatibilité, la recherche porte sur toutes les langues.
  options: { includeKey?: boolean, locale?: string } = {}
): boolean {
  const { includeKey = false } = options
  const q = normalizeForSearch(query)
  if (!q) return true

  // Chercher dans les textes français (par défaut)
  if (normalizeForSearch(emblem.name).includes(q)) return true
  if (emblem.description && normalizeForSearch(emblem.description).includes(q)) return true
  if (includeKey && emblem.key && normalizeForSearch(emblem.key).includes(q)) return true

  // Chercher dans toutes les traductions
  for (const translation of Object.values(emblem.translations ?? {})) {
    if (translation.name && normalizeForSearch(translation.name).includes(q)) return true
    if (translation.description && normalizeForSearch(translation.description).includes(q)) return true
  }

  return false
}
