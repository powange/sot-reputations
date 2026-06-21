/**
 * Transforme une clé technique du jeu en libellé lisible :
 * "ShipDecoration" -> "Ship Decoration", "Flintlock_Double-Barrel" -> "Flintlock Double Barrel".
 * Utilisé comme repli quand aucune traduction n'est saisie.
 */
export function humanizeKey(key: string | null | undefined): string {
  if (!key) return ''
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').trim()
}
