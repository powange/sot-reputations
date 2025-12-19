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
