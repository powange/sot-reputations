// Données du guide de pêche (/tools/fishing), partagées app + serveur.
// Libellés i18n : tools.fishing.species.<key>.{name,location} et tools.fishing.variants.<key>.<variant>.
// Source : https://sotfr.net/guides/gameplay/guide-peche-chasse/

export type FishBait = 'none' | 'earthworms' | 'grubs' | 'leeches'
export type FishVariantKind = 'common' | 'night' | 'rare'

export interface FishVariant {
  key: string
  kind: FishVariantKind
  // Îles où la variété apparaît (noms propres, non traduits)
  islands?: string[]
  // Précision localisée : tools.fishing.variantNotes.<note>
  note?: string
}

export interface FishSpecies {
  key: string
  bait: FishBait
  variants: FishVariant[]
}

export const FISH_BAITS: FishBait[] = ['none', 'earthworms', 'grubs', 'leeches']

export const FISH_SPECIES: FishSpecies[] = [
  {
    key: 'splashtail',
    bait: 'none',
    variants: [
      { key: 'ruby', kind: 'common' },
      { key: 'sunny', kind: 'common' },
      { key: 'indigo', kind: 'common' },
      { key: 'seafoam', kind: 'night' },
      { key: 'umber', kind: 'rare' }
    ]
  },
  {
    key: 'plentifin',
    bait: 'earthworms',
    variants: [
      { key: 'olive', kind: 'common' },
      { key: 'amber', kind: 'common' },
      { key: 'cloudy', kind: 'common' },
      { key: 'watery', kind: 'night' },
      { key: 'bonedust', kind: 'rare' }
    ]
  },
  {
    key: 'ancientscale',
    bait: 'leeches',
    variants: [
      { key: 'almond', kind: 'common' },
      { key: 'sapphire', kind: 'common' },
      { key: 'smoke', kind: 'common' },
      { key: 'starshine', kind: 'night' },
      { key: 'bone', kind: 'rare' }
    ]
  },
  {
    key: 'wildsplash',
    bait: 'earthworms',
    variants: [
      { key: 'russet', kind: 'common' },
      { key: 'sandy', kind: 'common' },
      { key: 'ocean', kind: 'common' },
      { key: 'coral', kind: 'night' },
      { key: 'muddy', kind: 'rare' }
    ]
  },
  {
    key: 'devilfish',
    bait: 'grubs',
    variants: [
      { key: 'ashen', kind: 'common' },
      { key: 'seashell', kind: 'common' },
      { key: 'lava', kind: 'common' },
      { key: 'firelight', kind: 'night' },
      { key: 'forsaken', kind: 'rare' }
    ]
  },
  {
    key: 'islehopper',
    bait: 'none',
    variants: [
      { key: 'stone', kind: 'common', islands: ['Shark Bait Cove', 'Cannon Cove', 'Crook\'s Hollow', 'Shipwreck Bay', 'Sailor\'s Bounty', 'Fetcher\'s Rest'] },
      { key: 'moss', kind: 'common', islands: ['Thieves\' Haven', 'Wanderers Refuge', 'Marauder\'s Arch', 'Ashen Reaches', 'Lone Cove'] },
      { key: 'honey', kind: 'common', islands: ['Discovery Ridge', 'Plunder Valley', 'Crescent Isle', 'Kraken\'s Fall', 'The Sunken Grove', 'Devil\'s Thirst'] },
      { key: 'amethyst', kind: 'night', islands: ['Devil\'s Ridge', 'The Crooked Masts', 'Smugglers\' Bay', 'Snake Island', 'Old Faithful Isle', 'Flintlock Peninsula', 'Mermaid\'s Hideaway'] },
      { key: 'raven', kind: 'rare', islands: ['Discovery Ridge', 'Shark Bait Cove', 'Marauder\'s Arch', 'Devil\'s Ridge', 'Thieves\' Haven', 'Wanderers Refuge', 'Plunder Valley'] }
    ]
  },
  {
    key: 'pondie',
    bait: 'none',
    variants: [
      { key: 'charcoal', kind: 'common' },
      { key: 'orchid', kind: 'common' },
      { key: 'bronze', kind: 'common' },
      { key: 'moonsky', kind: 'night' },
      { key: 'bright', kind: 'rare' }
    ]
  },
  {
    key: 'battlegill',
    bait: 'grubs',
    variants: [
      { key: 'jade', kind: 'common' },
      { key: 'sky', kind: 'common' },
      { key: 'rum', kind: 'common' },
      { key: 'bittersweet', kind: 'night' },
      { key: 'sand', kind: 'rare' }
    ]
  },
  {
    key: 'wrecker',
    bait: 'earthworms',
    variants: [
      { key: 'rose', kind: 'common' },
      { key: 'sun', kind: 'common' },
      { key: 'moon', kind: 'night' },
      { key: 'snow', kind: 'rare' },
      { key: 'blackcloud', kind: 'rare', note: 'wreckInStorm' }
    ]
  },
  {
    key: 'stormfish',
    bait: 'leeches',
    variants: [
      { key: 'ancient', kind: 'common', note: 'ancientIsles' },
      { key: 'shores', kind: 'common', note: 'shoresOfPlenty' },
      { key: 'wild', kind: 'common', note: 'wilds' },
      { key: 'twilight', kind: 'night' },
      { key: 'shadow', kind: 'rare' }
    ]
  }
]

// --- Quêtes de Merrick : listes de poissons/viandes à livrer ---
// Libellés : tools.fishing.species.<key>.one (+ variants) et tools.fishing.merrick.meats.<key>.

export const MERRICK_MEATS = ['chicken', 'pork', 'snake', 'shark', 'kraken', 'megalodon'] as const
export const MERRICK_COURSES = ['starter', 'main', 'special'] as const
export const MERRICK_STATES = ['cooked', 'raw'] as const

export type MerrickItemType = 'fish' | 'meat'
export type MerrickCourse = typeof MERRICK_COURSES[number]
export type MerrickState = typeof MERRICK_STATES[number]

export interface MerrickIngredient {
  // Absent pour un ingrédient pas encore enregistré
  id?: number
  type: MerrickItemType
  key: string
  // Variété précise du poisson, null = n'importe laquelle
  variant: string | null
  state: MerrickState
  quantity: number
  delivered?: number
}

export interface MerrickDish {
  course: MerrickCourse
  name: string
  ingredients: MerrickIngredient[]
}

export interface MerrickQuest {
  token: string
  updatedAt: string
  dishes: MerrickDish[]
}

export const MERRICK_LIMITS = {
  dishes: 6,
  ingredientsPerDish: 10,
  quantity: 20,
  nameLength: 80
}

// Identifiant compact d'un item, utilisé comme valeur des sélecteurs : fish:<espèce>[:<variété>] ou meat:<viande>
export function merrickItemId(i: Pick<MerrickIngredient, 'type' | 'key' | 'variant'>): string {
  return i.variant ? `${i.type}:${i.key}:${i.variant}` : `${i.type}:${i.key}`
}

export function parseMerrickItemId(id: string): Pick<MerrickIngredient, 'type' | 'key' | 'variant'> | null {
  const [type, key, variant] = id.split(':')
  const item = { type: type as MerrickItemType, key: key ?? '', variant: variant ?? null }
  return isValidMerrickItem(item) ? item : null
}

export function isValidMerrickItem(i: Pick<MerrickIngredient, 'type' | 'key' | 'variant'>): boolean {
  if (i.type === 'meat') return (MERRICK_MEATS as readonly string[]).includes(i.key) && !i.variant
  if (i.type !== 'fish') return false
  const species = FISH_SPECIES.find(s => s.key === i.key)
  if (!species) return false
  return !i.variant || species.variants.some(v => v.key === i.variant)
}
