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

/**
 * Vérifie si un emblème correspond à une recherche
 */
export function emblemMatchesSearch(
  emblem: { name: string; description: string; key?: string },
  query: string,
  includeKey = false
): boolean {
  const q = normalizeForSearch(query)
  if (!q) return true

  return normalizeForSearch(emblem.name).includes(q) ||
         normalizeForSearch(emblem.description).includes(q) ||
         (includeKey && !!emblem.key && normalizeForSearch(emblem.key).includes(q))
}
