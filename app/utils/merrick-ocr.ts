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

// "1REQUIN", "2 NAGEOIRES…", "I SERPENT" (1 lu comme I/l), ou pas de quantité du tout.
function splitQuantity(line: string): { quantity: number, rest: string } {
  const m = line.match(/^([0-9]{1,2}|[il])\s*(.*)$/)
  if (m && m[2]!.length >= 3) {
    const q = /^[0-9]+$/.test(m[1]!) ? Number(m[1]) : 1
    return { quantity: Math.min(Math.max(q, 1), MERRICK_LIMITS.quantity), rest: m[2]! }
  }
  return { quantity: 1, rest: line }
}

export function parseMerrickMenu(rawLines: string[], vocab: MerrickVocabEntry[]): MerrickDish[] {
  const dishes: MerrickDish[] = []
  let current: MerrickDish | null = null
  let pendingCourse: MerrickCourse | null = null

  const nextCourse = (): MerrickCourse => MERRICK_COURSES[Math.min(dishes.length, MERRICK_COURSES.length - 1)]!
  const startDish = (course: MerrickCourse, name = '') => {
    current = { course, name, ingredients: [] }
    dishes.push(current)
    return current
  }

  for (const raw of rawLines) {
    const line = normalizeOcr(raw)
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

    const { quantity, rest } = splitQuantity(line)
    const match = matchItem(rest, vocab) ?? matchItem(line, vocab)
    if (match) {
      const dish: MerrickDish = current ?? startDish(pendingCourse ?? nextCourse())
      pendingCourse = null
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
