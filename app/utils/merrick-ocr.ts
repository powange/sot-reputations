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
const MENU_TITLE_WORDS = ['menu de merrick', 'merrick s menu', 'merricks menu']

// En-tête gris souvent mal lu (« PLAT BRING PAI », « PLAT rage ») : ligne courte
// commençant par « PLAT ». null = pas un en-tête ; 'ambiguous' = plat principal ou du jour
// illisible, déduit ensuite de l'ordre des plats.
function platHeader(core: string): MerrickCourse | 'ambiguous' | null {
  const words = core.split(' ')
  if (words.length > 4 || bestScore(words[0] ?? '', ['plat', 'plato']) < 0.75) return null
  const rest = words.slice(1)
  if (rest.some(w => bestScore(w, ['jour', 'dia']) >= 0.6)) return 'special'
  if (rest.some(w => bestScore(w, ['principal']) >= 0.6)) return 'main'
  return 'ambiguous'
}

// Un seul mot d'en-tête reconnaissable au milieu du bruit (« ar ENTRÉES bai »)
const SINGLE_WORD_COURSES: Record<string, MerrickCourse> = { entree: 'starter', starter: 'starter', entrante: 'starter' }

function courseHeader(core: string): MerrickCourse | 'ambiguous' | null {
  const direct = MERRICK_COURSES.find(c => bestScore(core, COURSE_WORDS[c]) >= 0.75)
  if (direct) return direct
  const words = core.split(' ')
  if (words.length <= 3) {
    for (const w of words) {
      for (const [word, course] of Object.entries(SINGLE_WORD_COURSES)) {
        if (similarity(w, word) >= 0.8) return course
      }
    }
  }
  return platHeader(core)
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

// Autres libellés possibles d'un même item (le jeu écrit « Poule », on dit souvent « Poulet »)
const OCR_ALIASES: MerrickVocabEntry[] = [
  { text: 'poulet', item: { type: 'meat', key: 'chicken', variant: null } }
]

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
  for (const alias of OCR_ALIASES) entries.push({ text: alias.text, item: alias.item })
  return entries
}

const MATCH_THRESHOLD = 0.72

function bestEntry(text: string, vocab: MerrickVocabEntry[]): { entry: MerrickVocabEntry, sim: number } | null {
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
  return best ? { entry: best, sim: bestSim } : null
}

// Ligne entière, ou (si une quantité a été lue, donc ligne d'ingrédient) n'importe quelle
// suite de mots de la ligne : rattrape le texte parasite autour du nom (« 7e 1 HOULE … | »).
// Les titres de plats (« CURRY DE DÉFERLANTE ») n'ont pas de quantité : jamais découpés.
// Rapprochement de la ligne entière, puis (si allowWindows) d'une suite de mots de la ligne.
// Une suite n'est retenue que si aucun autre vrai mot (≥ 3 lettres) ne l'entoure — le reste
// n'est que du bruit (« v | POULE | PR ») — ou si c'est un nom de variété très proche
// (« eee M DE FEB ANTE CORALLIENNE »). Ainsi un titre comme « CURRY DE DÉFERLANTE »
// ne devient jamais l'ingrédient « Déferlante ».
function matchItem(text: string, vocab: MerrickVocabEntry[], allowWindows = false): MerrickVocabEntry | null {
  let best = bestEntry(text, vocab)
  // Découpage seulement en secours : sinon « HOULE » (exact) battrait « HOULE ORCHIDEE » mal lu
  if (allowWindows && (!best || best.sim < MATCH_THRESHOLD)) {
    best = null
    const words = text.split(' ')
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= words.length; j++) {
        if (i === 0 && j === words.length) continue
        const found = bestEntry(words.slice(i, j).join(' '), vocab)
        if (!found || found.sim < MATCH_THRESHOLD) continue
        const onlyNoiseAround = [...words.slice(0, i), ...words.slice(j)].every(w => w.length < 3)
        const closeVariant = !!found.entry.item.variant && found.sim >= 0.8
        if (!onlyNoiseAround && !closeVariant) continue
        // À score égal, la variété précise (libellé plus long) l'emporte sur l'espèce seule
        if (!best || found.sim > best.sim || (found.sim === best.sim && found.entry.text.length > best.entry.text.length)) best = found
      }
    }
  }
  return best && best.sim >= MATCH_THRESHOLD ? best.entry : null
}

// Retire les fragments de 1-2 caractères en début et fin de ligne (cadre du parchemin,
// bavures : « ï A PLAT rage © é »). Le premier nombre rencontré est gardé comme quantité lue.
function trimNoise(line: string): { core: string, quantity: number | null } {
  const words = line.split(' ')
  let a = 0
  let b = words.length
  let quantity: number | null = null
  while (a < b && words[a]!.length <= 2) {
    if (quantity === null && /^\d+$/.test(words[a]!)) quantity = clampQuantity(Number(words[a]))
    a++
  }
  while (b > a && words[b - 1]!.length <= 2) b--
  return { core: words.slice(a, b).join(' '), quantity }
}

// « (CUIT) » / « (CRU) » souvent abîmés (« (eur) », « (CuIT) », « (cu) ») : le début du mot
// suffit à trancher entre les deux en français ; sinon rapprochement approximatif
function stateOf(word: string): MerrickState | null {
  if (!word || word.length > 8) return null
  if (/^cr/.test(word)) return 'raw'
  if (/^cu/.test(word)) return 'cooked'
  const scores = MERRICK_STATES.map(s => ({ s, score: bestScore(word, STATE_WORDS[s]) }))
  const best = scores.sort((x, y) => y.score - x.score)[0]!
  return best.score >= 0.6 ? best.s : null
}

// « 1 POULE (CUIT) » lu sur une seule ligne : retire l'état en fin de ligne
function splitTrailingState(line: string): { text: string, state: MerrickState | null } {
  const words = line.split(' ')
  if (words.length < 2) return { text: line, state: null }
  const state = stateOf(words.at(-1)!)
  return state ? { text: words.slice(0, -1).join(' '), state } : { text: line, state: null }
}

// Titre de plat lisible, ou '' si la ligne n'est que du bruit OCR (« 7e TS BR ‘ NT »)
function cleanDishName(raw: string): string {
  const letters = raw.replace(/[^\p{L}]/gu, '').length
  const nonSpace = raw.replace(/\s/g, '').length
  // Ligne surtout faite de symboles : bruit
  if (letters < 6 || letters / Math.max(1, nonSpace) < 0.75) return ''
  const name = raw.replace(/[^\p{L}\s'’-]/gu, ' ').replace(/\s+/g, ' ').trim()
    // Fragments de 1-2 lettres en début / fin : souvent le cadre du parchemin (« A GRILLADE … AU TI »)
    .replace(/^(\p{L}{1,2}\s)+/u, '').replace(/(\s\p{L}{1,2})+$/u, '')
  if (!name.split(' ').some(w => w.length >= 3)) return ''
  return name.slice(0, MERRICK_LIMITS.nameLength)
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

  // Plats sans en-tête lisible : entrée, plat principal puis plat du jour, dans l'ordre
  const nextCourse = (): MerrickCourse => {
    const started = dishes.filter(d => d.ingredients.length > 0).length
    return MERRICK_COURSES[Math.min(started, MERRICK_COURSES.length - 1)]!
  }
  // Course qui suit le dernier plat (en-tête « PLAT … » illisible)
  const courseAfterLast = (): MerrickCourse => {
    const last = dishes.at(-1)?.course
    return last === 'main' || last === 'special' ? 'special' : 'main'
  }
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
    const { core, quantity: leadingQuantity } = trimNoise(line)
    if (core.replace(/[^a-z]/g, '').length < 2) continue

    // Titre du parchemin (« MENU DE MERRICK ») : ignoré
    if (bestScore(core, MENU_TITLE_WORDS) >= 0.7) continue

    // En-tête de plat (ENTRÉE / PLAT PRINCIPAL / PLAT DU JOUR)
    const header = courseHeader(core)
    if (header) {
      pendingCourse = header === 'ambiguous' ? courseAfterLast() : header
      current = null
      continue
    }

    // État "(CUIT)" / "(CRU)" seul sur sa ligne : s'applique au dernier ingrédient
    const state = core.split(' ').length === 1 ? stateOf(core) : null
    if (state) {
      const last = (current as MerrickDish | null)?.ingredients.at(-1)
      if (last) last.state = state
      continue
    }

    const trailing = splitTrailingState(core)
    const split = splitQuantity(trailing.text)
    // La ligne qui suit un en-tête est le titre du plat : jamais découpée
    const allowWindows = !pendingCourse
    let text = split.rest
    let match = matchItem(text, vocab, allowWindows)
    if (!match) {
      text = trailing.text
      match = matchItem(text, vocab, allowWindows)
    }
    if (match) {
      const dish: MerrickDish = current ?? startDish(pendingCourse ?? nextCourse())
      pendingCourse = null
      // Le chiffre stylisé du jeu est mal lu (le « 1 » à crochet sort en 2, 7, Z, |…) :
      // c'est l'accord du nom qui décide. Singulier = 1 ; pluriel = le chiffre lu s'il
      // est plausible, sinon 2.
      const read = (text === trailing.text ? null : split.quantity) ?? leadingQuantity ?? pendingQuantity
      const quantity = looksPlural(text, match.text) ? Math.max(2, read ?? 2) : 1
      pendingQuantity = null
      // Même ligne lue deux fois (fusion de lectures) : un menu ne liste jamais deux fois
      // de suite le même ingrédient, on garde la variété la plus précise
      const last = dish.ingredients.at(-1)
      if (last && last.type === match.item.type && last.key === match.item.key
        && (!last.variant || !match.item.variant || last.variant === match.item.variant)) {
        last.variant ??= match.item.variant
        last.quantity = Math.max(last.quantity, quantity)
        if (trailing.state) last.state = trailing.state
        continue
      }
      dish.ingredients.push({ ...match.item, state: trailing.state ?? 'cooked', quantity })
      continue
    }

    // Sinon : nom du plat (juste après l'en-tête), le reste est ignoré
    const name = cleanDishName(raw)
    if (pendingCourse) {
      // Même illisible, la ligne après l'en-tête est le titre : le plat commence ici
      startDish(pendingCourse, name)
      pendingCourse = null
    } else if (!name) {
      // Bruit OCR (cadre, emblème du parchemin) : ne doit pas couper un plat en deux
      continue
    } else if (!current || (current as MerrickDish).ingredients.length > 0) {
      // Nouveau plat sans en-tête lisible
      startDish(nextCourse(), name)
    } else if (name.length > (current as MerrickDish).name.length) {
      // Plusieurs lignes candidates avant le 1er ingrédient : la plus longue est le vrai titre
      (current as MerrickDish).name = name
    }
  }

  return dishes.filter(d => d.ingredients.length > 0).slice(0, MERRICK_LIMITS.dishes)
}

// --- Fusion de plusieurs lectures OCR ---
// Selon le cadrage, chaque mode de Tesseract rate des lignes différentes (aucun réglage
// ne lit tout sur toutes les captures). On fusionne donc plusieurs lectures ligne par
// ligne : les lignes à la même hauteur sont regroupées et on garde la plus « lisible ».

export interface OcrLine {
  text: string
  y0: number
  y1: number
}

// Intérêt d'une ligne lue : ingrédient reconnu > en-tête > état > titre lisible > bruit
function lineScore(raw: string, vocab: MerrickVocabEntry[]): number {
  const { core } = trimNoise(normalizeOcr(raw))
  if (core.replace(/[^a-z]/g, '').length < 2) return 0
  const trailing = splitTrailingState(core)
  const item = bestEntry(splitQuantity(trailing.text).rest, vocab)
  // Bonus à la variété précise : « HOULE CHAR SONNEUSE » (94 %) vaut mieux que « HOULE TT » (espèce, 100 %)
  if (item && item.sim >= MATCH_THRESHOLD) return 3 + item.sim + (item.entry.item.variant ? 0.1 : 0)
  if (courseHeader(core)) return 2.5
  if (core.split(' ').length === 1 && stateOf(core)) return 2
  const name = cleanDishName(raw)
  return name ? 1 + Math.min(name.length, 60) / 100 : 0.1
}

export function mergeOcrPasses(passes: OcrLine[][], vocab: MerrickVocabEntry[]): string[] {
  const lines = passes.flatMap((pass, index) => pass.map(l => ({ ...l, pass: index })))
    .filter(l => l.text.trim() && l.y1 > l.y0)
    .sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1))
  // Chaque groupe garde la boîte de sa 1re ligne (il ne grossit pas, sinon il avalerait
  // les lignes voisines) et au plus une ligne par lecture : deux lignes d'une même
  // lecture sont forcément deux lignes différentes du parchemin.
  const clusters: { y0: number, y1: number, lines: (OcrLine & { pass: number })[] }[] = []
  for (const line of lines) {
    const height = line.y1 - line.y0
    const cluster = clusters.findLast(c => !c.lines.some(l => l.pass === line.pass)
      && Math.min(c.y1, line.y1) - Math.max(c.y0, line.y0) > 0.5 * Math.min(c.y1 - c.y0, height))
    if (cluster) cluster.lines.push(line)
    else clusters.push({ y0: line.y0, y1: line.y1, lines: [line] })
  }
  return clusters
    .sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1))
    .map((c) => {
      let best = c.lines[0]!
      let bestScore = -1
      for (const l of c.lines) {
        const score = lineScore(l.text, vocab)
        if (score > bestScore) {
          best = l
          bestScore = score
        }
      }
      return best.text
    })
}
