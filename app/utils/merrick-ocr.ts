// Analyse du texte OCR d'un menu de Merrick -> plats + ingrédients.
// Le texte brut de Tesseract est approximatif (police stylisée, parchemin) : chaque
// ligne est rapprochée par distance d'édition d'un vocabulaire fermé (noms de
// poissons/viandes dans toutes les langues du site, en-têtes de plats, états).

export interface MerrickVocabEntry {
  // Libellé normalisé (minuscules, sans accents ni ponctuation)
  text: string
  item: Pick<MerrickIngredient, 'type' | 'key' | 'variant'>
}

interface LocaleMessages {
  tools?: {
    fishing?: {
      species?: Record<string, { one?: string }>
      variants?: Record<string, Record<string, string>>
      merrick?: { meats?: Record<string, string> }
    }
  }
}

const COURSE_WORDS: Record<MerrickCourse, string[]> = {
  starter: ['entree', 'starter', 'entrante'],
  main: ['plat principal', 'main course', 'plato principal'],
  special: ['plat du jour', 'special', 'dish of the day', 'plato del dia']
}
const STATE_WORDS: Record<MerrickState, string[]> = {
  cooked: ['cuit', 'cooked', 'cocinado'],
  raw: ['cru', 'raw', 'crudo']
}

export function normalizeOcr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]!
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  // Les espaces sont peu fiables en OCR ("1REQUIN", "ECLABOUSSANTE NSOLEILLEE")
  const x = a.replace(/ /g, '')
  const y = b.replace(/ /g, '')
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length)
}

function bestScore(line: string, words: string[]): number {
  return Math.max(...words.map(w => similarity(line, w)))
}

// Vocabulaire des items à partir des messages i18n (une ou plusieurs langues).
export function buildMerrickVocabulary(messagesList: LocaleMessages[], frenchOrder: boolean[]): MerrickVocabEntry[] {
  const entries: MerrickVocabEntry[] = []
  messagesList.forEach((messages, idx) => {
    const fishing = messages.tools?.fishing
    if (!fishing) return
    for (const species of FISH_SPECIES) {
      const one = fishing.species?.[species.key]?.one
      if (!one) continue
      entries.push({ text: normalizeOcr(one), item: { type: 'fish', key: species.key, variant: null } })
      for (const v of species.variants) {
        const variant = fishing.variants?.[species.key]?.[v.key]
        if (!variant) continue
        const full = frenchOrder[idx] ? `${one} ${variant}` : `${variant} ${one}`
        entries.push({ text: normalizeOcr(full), item: { type: 'fish', key: species.key, variant: v.key } })
      }
    }
    for (const meat of MERRICK_MEATS) {
      const label = fishing.merrick?.meats?.[meat]
      if (label) entries.push({ text: normalizeOcr(label), item: { type: 'meat', key: meat, variant: null } })
    }
  })
  return entries
}

function matchItem(text: string, vocab: MerrickVocabEntry[]): MerrickVocabEntry | null {
  let best: MerrickVocabEntry | null = null
  let bestSim = 0
  for (const entry of vocab) {
    const sim = similarity(text, entry.text)
    // À score égal, préférer le libellé le plus long (variété précise plutôt qu'espèce)
    if (sim > bestSim || (sim === bestSim && best && entry.text.length > best.text.length)) {
      best = entry
      bestSim = sim
    }
  }
  return bestSim >= 0.72 ? best : null
}

// Lettres que l'OCR lit souvent à la place du chiffre de quantité (retirées avant le rapprochement)
const DIGIT_LOOKALIKES: Record<string, number> = { i: 1, l: 1, j: 1, t: 1, z: 2 }

const clampQuantity = (q: number) => Math.min(Math.max(q, 1), MERRICK_LIMITS.quantity)

// "1REQUIN", "2 NAGEOIRES…", "I SERPENT" / "Z NAGEOIRES" (chiffre lu comme une lettre).
// quantity = null si aucune quantité n'a pu être lue.
function splitQuantity(line: string): { quantity: number | null, rest: string } {
  let m = line.match(/^(\d{1,2})\s*([a-z].{2,})$/)
  if (m) return { quantity: clampQuantity(Number(m[1])), rest: m[2]! }
  m = line.match(/^([a-z])\s*(.{3,})$/)
  if (m && m[1]! in DIGIT_LOOKALIKES) return { quantity: DIGIT_LOOKALIKES[m[1]!]!, rest: m[2]! }
  return { quantity: null, rest: line }
}

// "NAGEOIRES D'ABONDANCE" vs "nageoire d abondance" : le jeu met le nom au pluriel
// dès qu'il en faut plusieurs, ce qui rattrape un chiffre illisible ou perdu.
function looksPlural(text: string, entry: string): boolean {
  const entryWords = entry.split(' ')
  // Mot à mot, sans exiger le même découpage (l'OCR colle ou coupe parfois les mots)
  return text.split(' ').some((w) => {
    if (w.length <= 3 || !/[sx]$/.test(w)) return false
    const stem = w.slice(0, -1)
    return entryWords.some(e => !/[sx]$/.test(e) && levenshtein(stem, e) <= 1 && levenshtein(stem, e) < levenshtein(w, e))
  })
}

export function parseMerrickMenu(rawLines: string[], vocab: MerrickVocabEntry[]): MerrickDish[] {
  const dishes: MerrickDish[] = []
  let current: MerrickDish | null = null
  let pendingCourse: MerrickCourse | null = null
  let pendingQuantity: number | null = null

  const nextCourse = (): MerrickCourse => MERRICK_COURSES[Math.min(dishes.length, MERRICK_COURSES.length - 1)]!
  const startDish = (course: MerrickCourse, name = '') => {
    current = { course, name, ingredients: [] }
    dishes.push(current)
    return current
  }

  for (const raw of rawLines) {
    const line = normalizeOcr(raw)
    // Quantité isolée sur sa propre ligne : s'applique à l'ingrédient suivant
    if (/^\d{1,2}$/.test(line)) {
      pendingQuantity = clampQuantity(Number(line))
      continue
    }
    if (line.replace(/[^a-z]/g, '').length < 3) continue

    // En-tête de plat (ENTRÉE / PLAT PRINCIPAL / PLAT DU JOUR)
    const course = MERRICK_COURSES.find(c => bestScore(line, COURSE_WORDS[c]) >= 0.75)
    if (course) {
      pendingCourse = course
      current = null
      continue
    }

    // État "(CUIT)" / "(CRU)" : s'applique au dernier ingrédient
    const state = MERRICK_STATES.find(s => line.length <= 10 && bestScore(line, STATE_WORDS[s]) >= 0.6)
    if (state) {
      const last = (current as MerrickDish | null)?.ingredients.at(-1)
      if (last) last.state = state
      continue
    }

    const split = splitQuantity(line)
    let text = split.rest
    let match = matchItem(text, vocab)
    if (!match) {
      text = line
      match = matchItem(text, vocab)
    }
    if (match) {
      const dish: MerrickDish = current ?? startDish(pendingCourse ?? nextCourse())
      pendingCourse = null
      // Le chiffre stylisé du jeu est mal lu (le « 1 » à crochet sort en 2, 7, Z…) :
      // c'est l'accord du nom qui décide. Singulier = 1 ; pluriel = le chiffre lu s'il
      // est plausible, sinon 2.
      const read = (text === line ? null : split.quantity) ?? pendingQuantity
      const quantity = looksPlural(text, match.text) ? Math.max(2, read ?? 2) : 1
      pendingQuantity = null
      dish.ingredients.push({ ...match.item, state: 'cooked', quantity })
      continue
    }

    // Sinon : nom du plat (juste après l'en-tête), le reste est ignoré ("MENU DE MERRICK"…)
    if (pendingCourse) {
      startDish(pendingCourse, raw.trim().slice(0, MERRICK_LIMITS.nameLength))
      pendingCourse = null
    } else if (current && (current as MerrickDish).ingredients.length > 0) {
      // Nouveau plat sans en-tête lisible
      startDish(nextCourse(), raw.trim().slice(0, MERRICK_LIMITS.nameLength))
    } else if (current && !(current as MerrickDish).name) {
      (current as MerrickDish).name = raw.trim().slice(0, MERRICK_LIMITS.nameLength)
    }
  }

  return dishes.filter(d => d.ingredients.length > 0).slice(0, MERRICK_LIMITS.dishes)
}
