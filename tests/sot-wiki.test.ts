import { describe, expect, it } from 'vitest'
import { looseWikiName, pickByDescription, wikiDataForItem, wikiVariantBase, withTrophyQualityEn } from '../server/utils/sot-wiki'

describe('wikiVariantBase', () => {
  it('retire la précision finale entre parenthèses', () => {
    expect(wikiVariantBase('Barrel Bombardier Costume (Goggles)')).toBe('Barrel Bombardier Costume')
    expect(wikiVariantBase('Barrel Bombardier Costume (Messy hairstyle and goggles)')).toBe('Barrel Bombardier Costume')
  })

  it('renvoie null sans précision finale', () => {
    expect(wikiVariantBase('Barrel Bombardier Costume')).toBeNull()
    expect(wikiVariantBase('Cutlass (Old) of Courage')).toBeNull()
  })
})

describe('pickByDescription', () => {
  const variants = [
    { title: 'A (No goggles)', description: 'Soot-stained outfit festooned with wicks.' },
    { title: 'A (Goggles)', description: 'Soot-stained outfit festooned with wicks. Includes a set of goggles.' },
    { title: 'A (Messy hairstyle and goggles)', description: 'Soot-stained outfit festooned with wicks. Includes a set of goggles and a messy hairstyle.' }
  ]

  it('préfère la description identique', () => {
    expect(pickByDescription(variants, 'Soot-stained outfit festooned with wicks. Includes a set of goggles.')?.title).toBe('A (Goggles)')
  })

  it('sinon la plus proche', () => {
    expect(pickByDescription(variants, 'Outfit with wicks, includes goggles and a messy hairstyle')?.title).toBe('A (Messy hairstyle and goggles)')
  })

  it('sans description : la première', () => {
    expect(pickByDescription(variants, null)?.title).toBe('A (No goggles)')
  })
})

describe('looseWikiName', () => {
  it('retire la qualité des trophées', () => {
    expect(looseWikiName('Admired Raven Islehopper Plaque')).toBe(looseWikiName('Raven Islehopper Plaque'))
    expect(looseWikiName('Prized Raven Islehopper Plaque')).toBe('raven islehopper plaque')
  })

  it('retire les guillemets des titres de tableaux', () => {
    expect(looseWikiName('‘Below Wonderlit Skies’')).toBe(looseWikiName('Below Wonderlit Skies'))
  })

  it('ne retire pas un autre premier mot', () => {
    expect(looseWikiName('Dire Dark Warsmith Costume')).not.toBe(looseWikiName('Dark Warsmith Costume'))
  })
})

describe('wikiDataForItem (qualités de trophées)', () => {
  const page = {
    title: 'Raven Islehopper Plaque',
    cost: null,
    prereqs: { commendations: [{ name: 'Hunter of the Raven Islehopper', grade: null }] },
    description: null,
    image: null,
    tiers: {
      admired: { gold: 20000, grade: 1, milestone: 'Islehoppers Caught', milestoneClass: 5 },
      prized: { gold: 45000, grade: 3, milestone: 'Islehoppers Caught', milestoneClass: 10 },
      treasured: { gold: 85000, grade: 4, milestone: 'Islehoppers Caught', milestoneClass: 20 },
      cherished: { gold: 150000, grade: 5, milestone: 'Islehoppers Caught', milestoneClass: 30 }
    }
  }

  it('prix, grade et jalon de la qualité', () => {
    expect(wikiDataForItem(page, 'Prized Raven Islehopper Plaque')).toEqual({
      cost: { gold: 45000 },
      prereqs: {
        commendations: [{ name: 'Hunter of the Raven Islehopper', grade: 3 }],
        requires: 'Class 10 in the \'Islehoppers Caught\' Pirate Milestone'
      }
    })
  })

  it('qualité lue dans le nom français (tableaux)', () => {
    expect(wikiDataForItem(page, 'Raven Islehopper Plaque', 'Superbe « Plaque »').cost).toEqual({ gold: 45000 })
    expect(wikiDataForItem(page, 'Raven Islehopper Plaque', 'Inestimable « Plaque »').cost).toEqual({ gold: 150000 })
    expect(wikiDataForItem(page, 'Arms of Athena', 'Magnifiques « Armes d’Athéna »').cost).toEqual({ gold: 85000 })
  })

  it('objet sans qualité : données de la page', () => {
    expect(wikiDataForItem(page, 'Raven Islehopper Plaque')).toEqual({ cost: null, prereqs: page.prereqs })
  })
})

describe('withTrophyQualityEn', () => {
  it('rajoute la qualité portée par le nom français', () => {
    expect(withTrophyQualityEn('Lord of Legends', 'Superbe « Seigneurs des légendes »')).toBe('Prized \'Lord of Legends\'')
    expect(withTrophyQualityEn('Arms of Athena', 'Inestimables « Armes d’Athéna »')).toBe('Cherished \'Arms of Athena\'')
  })

  it('laisse un nom anglais qui a déjà sa qualité, ou un objet sans qualité', () => {
    expect(withTrophyQualityEn('Admired Raven Islehopper Plaque', 'Plaque admirable d’écumeur des îles de jais')).toBe('Admired Raven Islehopper Plaque')
    expect(withTrophyQualityEn('Spartan Wheel', 'Barre Spartan')).toBe('Spartan Wheel')
  })
})
