interface TranslatableFaction {
  name: string
  motto?: string | null
  translations?: Record<string, { name: string | null, motto: string | null }> | null
}

/**
 * Renvoie le nom ou la devise d'une faction dans la langue courante.
 * Le texte de base (FR) est utilisé pour la locale 'fr', en l'absence de
 * traduction, ou si le champ traduit est vide.
 */
export function translateFactionField(
  faction: TranslatableFaction,
  field: 'name' | 'motto',
  locale: string
): string {
  const base = faction[field] || ''
  if (locale === 'fr' || !faction.translations) return base
  const translated = faction.translations[locale]?.[field]
  return translated || base
}
