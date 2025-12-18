/**
 * Formate une date d'import pour l'affichage
 * @param dateStr - Date au format ISO ou null
 * @returns Date formatée en français ou "Jamais importé" si null
 */
export function formatLastImport(dateStr: string | null): string {
  if (!dateStr) return 'Jamais importé'
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
