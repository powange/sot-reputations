import { describe, expect, it } from 'vitest'
import { emblemMatchesSearch } from '../app/utils/search'

describe('emblemMatchesSearch', () => {
  const emblem = {
    name: 'Marchand voyageur',
    description: 'Vous avez terminé 250 voyages de l\'Alliance des marchands !',
    translations: {
      en: { name: 'Merchant Voyager', description: 'You completed 250 Merchant Alliance voyages!' },
      es: { name: 'Viajero comerciante', description: null }
    }
  }

  it('trouve par le nom de n\'importe quelle langue, quelle que soit la langue affichée', () => {
    expect(emblemMatchesSearch(emblem, 'merchant voyager', { locale: 'fr' })).toBe(true)
    expect(emblemMatchesSearch(emblem, 'viajero', { locale: 'en' })).toBe(true)
    expect(emblemMatchesSearch(emblem, 'marchand voyageur', { locale: 'es' })).toBe(true)
  })

  it('ne trouve pas un texte absent', () => {
    expect(emblemMatchesSearch(emblem, 'kraken', { locale: 'fr' })).toBe(false)
  })
})
