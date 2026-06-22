/**
 * Palette de couleurs nommées (définie en code pour la v1 ; modifiable plus tard).
 * `hex` sert à la fois de couleur de référence (classification au plus proche en
 * Lab) et de pastille d'affichage. Comme on stocke les RGB dominants bruts des
 * items, modifier cette palette ne nécessite qu'une re-classification (sans
 * re-télécharger les images).
 */
export const CHEST_COLOR_PALETTE: Array<{ name: string, hex: string }> = [
  { name: 'red', hex: '#d11919' },
  { name: 'orange', hex: '#e8730f' },
  { name: 'yellow', hex: '#f2d31b' },
  { name: 'green', hex: '#2ba84a' },
  { name: 'cyan', hex: '#1bb3c4' },
  { name: 'blue', hex: '#2a5fd6' },
  { name: 'purple', hex: '#8a3fd1' },
  { name: 'pink', hex: '#e85fb0' },
  { name: 'brown', hex: '#6b4423' },
  { name: 'black', hex: '#1a1a1a' },
  { name: 'white', hex: '#f0f0f0' },
  { name: 'gray', hex: '#8a8a8a' }
]

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ]
}

// Seuils de classification (modèle HSV). Choisis pour que :
//  - une couleur sombre mais teintée (bleu nuit) garde sa teinte (≠ « noir ») ;
//  - une couleur pâle peu saturée (crème) reste « blanc » (≠ forcée vers une teinte) ;
//  - les tons très sombres tombent sur « noir », les désaturés sur gris/blanc.
const V_MIN = 0.16 // sous cette clarté : noir quoi qu'il arrive
const S_MIN = 0.25 // sous cette saturation : neutre (noir/gris/blanc selon la clarté)
const WHITE_V = 0.78
const GRAY_V = 0.30
const BROWN_V_MAX = 0.6 // un orange assez sombre est nommé « marron »
// Rose vs rouge dans l'arc rouge-magenta : un rouge CLAIR et peu saturé (rosé, saumon
// pâle) est un rose ; un rouge saturé ou sombre reste rouge.
const PINK_V_MIN = 0.6 // un rose est clair…
const PINK_S_MAX = 0.5 // …et peu saturé (au-delà = rouge/corail franc)
const PINK_DARK_V = 0.45 // côté magenta, plus sombre que ça = rouge (lie-de-vin), pas rose

// Angle de teinte (degrés) façon HSV. `delta` = max - min des canaux.
function hueDeg(r: number, g: number, b: number, max: number, delta: number): number {
  let h: number
  if (delta === 0) h = 0
  else if (max === r) h = ((g - b) / delta) % 6
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

// Nom de teinte pour les teintes NON rouge-magenta (appelé seulement pour h ∈ [14, 296)).
// L'arc rouge-magenta (h ≥ 296 ou < 14) est traité à part dans classifyColor, car y
// distinguer rouge/rose/marron dépend aussi de la clarté et de la saturation.
function hueName(h: number): string {
  if (h < 40) return 'orange'
  if (h < 66) return 'yellow'
  if (h < 158) return 'green'
  if (h < 200) return 'cyan'
  if (h < 254) return 'blue'
  return 'purple' // [254, 296)
}

/**
 * Couleur nommée d'un RGB (modèle HSV). Une couleur assez saturée est nommée par sa
 * teinte même sombre (bleu nuit → « bleu ») ; les tons neutres/pâles tombent sur
 * noir/gris/blanc selon la clarté. Dans l'arc rouge-magenta, rouge/rose se départagent
 * surtout par la clarté et la saturation (un rouge clair et doux = rosé/saumon = rose),
 * et un orange sombre/terreux devient « marron ».
 */
export function classifyColor(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const v = max / 255
  const s = max === 0 ? 0 : (max - min) / max
  if (v < V_MIN) return 'black'
  if (s < S_MIN) return v > WHITE_V ? 'white' : v > GRAY_V ? 'gray' : 'black'
  const h = hueDeg(r, g, b, max, max - min)
  // Arc rouge-magenta (rosé, saumon, fuchsia, rouge, plum) : départage par clarté/saturation.
  if (h >= 296 || h < 14) {
    if (v >= PINK_V_MIN && s <= PINK_S_MAX) return 'pink' // rouge clair & doux : rosé / saumon pâle
    if (h >= 296 && h < 345) {
      if (v >= PINK_DARK_V) return 'pink' // magenta / fuchsia franc
      // Sombre : côté pourpre (296–335°) c'est un plum → violet ; côté rouge (335–345°) un lie-de-vin → rouge.
      return h < 335 ? 'purple' : 'red'
    }
    return 'red' // côté chaud (≥ 345° ou < 14°), saturé ou sombre
  }
  const name = hueName(h)
  return name === 'orange' && v < BROWN_V_MAX ? 'brown' : name
}

/** Couleurs nommées (uniques, dans l'ordre de dominance) à partir des RGB dominants. */
export function classifyDominantColors(dominantHex: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const hex of dominantHex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) continue
    const [r, g, b] = hexToRgb(hex)
    const name = classifyColor(r, g, b)
    if (!seen.has(name)) {
      seen.add(name)
      out.push(name)
    }
  }
  return out
}
