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

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

// sRGB -> CIE Lab (D65), pour une distance perceptuelle correcte.
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116)
  const fx = f(x), fy = f(y), fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const PALETTE_LAB = CHEST_COLOR_PALETTE.map(c => ({ name: c.name, lab: rgbToLab(...hexToRgb(c.hex)) }))

/** Couleur nommée la plus proche (distance Lab) d'un RGB. */
export function classifyColor(r: number, g: number, b: number): string {
  const lab = rgbToLab(r, g, b)
  let bestName = PALETTE_LAB[0]!.name
  let bestDist = Infinity
  for (const p of PALETTE_LAB) {
    const d = (lab[0] - p.lab[0]) ** 2 + (lab[1] - p.lab[1]) ** 2 + (lab[2] - p.lab[2]) ** 2
    if (d < bestDist) {
      bestDist = d
      bestName = p.name
    }
  }
  return bestName
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
