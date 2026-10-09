import { randomBytes } from 'crypto'
import { getReputationDb } from './reputation-db'

// Listes partagées des quêtes de Merrick (/tools/fishing/merrick). Pas de compte :
// l'accès se fait uniquement par le token du lien. Les listes inactives depuis
// MERRICK_TTL_DAYS sont purgées à chaque création.
const MERRICK_TTL_DAYS = 14

let initialized = false

function db() {
  const d = getReputationDb()
  if (!initialized) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS merrick_quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS merrick_quest_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quest_id INTEGER NOT NULL REFERENCES merrick_quests(id) ON DELETE CASCADE,
        dish_index INTEGER NOT NULL,
        course TEXT NOT NULL,
        dish_name TEXT NOT NULL,
        position INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        item_key TEXT NOT NULL,
        variant TEXT,
        state TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        delivered INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_merrick_quest_items_quest ON merrick_quest_items(quest_id);
    `)
    initialized = true
  }
  return d
}

interface ItemRow {
  id: number
  dish_index: number
  course: MerrickCourse
  dish_name: string
  item_type: MerrickItemType
  item_key: string
  variant: string | null
  state: MerrickState
  quantity: number
  delivered: number
}

// Valide et normalise les plats reçus du client ; lève une 400 sinon.
export function sanitizeMerrickDishes(input: unknown): MerrickDish[] {
  const bad = (message: string) => createError({ statusCode: 400, message })
  if (!Array.isArray(input) || input.length === 0 || input.length > MERRICK_LIMITS.dishes) {
    throw bad('Liste de plats invalide')
  }
  return input.map((dish: Partial<MerrickDish>) => {
    if (!dish || !MERRICK_COURSES.includes(dish.course as MerrickCourse)) throw bad('Type de plat invalide')
    const name = typeof dish.name === 'string' ? dish.name.trim().slice(0, MERRICK_LIMITS.nameLength) : ''
    const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : []
    if (ingredients.length === 0 || ingredients.length > MERRICK_LIMITS.ingredientsPerDish) {
      throw bad('Chaque plat doit contenir entre 1 et 10 ingrédients')
    }
    return {
      course: dish.course as MerrickCourse,
      name,
      ingredients: ingredients.map((ing: Partial<MerrickIngredient>) => {
        const item = { type: ing?.type as MerrickItemType, key: String(ing?.key ?? ''), variant: ing?.variant ? String(ing.variant) : null }
        if (!isValidMerrickItem(item)) throw bad('Ingrédient inconnu')
        if (!MERRICK_STATES.includes(ing.state as MerrickState)) throw bad('État invalide')
        const quantity = Number(ing.quantity)
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MERRICK_LIMITS.quantity) throw bad('Quantité invalide')
        return {
          id: Number.isInteger(ing.id) ? ing.id : undefined,
          ...item,
          state: ing.state as MerrickState,
          quantity
        }
      })
    }
  })
}

function insertItems(questId: number, dishes: MerrickDish[], keepDelivered: Map<number, number> = new Map()) {
  const insert = db().prepare(`
    INSERT INTO merrick_quest_items (quest_id, dish_index, course, dish_name, position, item_type, item_key, variant, state, quantity, delivered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  dishes.forEach((dish, dishIndex) => {
    dish.ingredients.forEach((ing, position) => {
      const delivered = Math.min(ing.id ? keepDelivered.get(ing.id) ?? 0 : 0, ing.quantity)
      insert.run(questId, dishIndex, dish.course, dish.name, position, ing.type, ing.key, ing.variant, ing.state, ing.quantity, delivered)
    })
  })
}

export function createMerrickQuest(dishes: MerrickDish[]): string {
  const d = db()
  const token = randomBytes(18).toString('base64url')
  d.transaction(() => {
    const stale = d.prepare(`SELECT id FROM merrick_quests WHERE updated_at < datetime('now', ?)`).all(`-${MERRICK_TTL_DAYS} days`) as { id: number }[]
    for (const { id } of stale) {
      d.prepare('DELETE FROM merrick_quest_items WHERE quest_id = ?').run(id)
      d.prepare('DELETE FROM merrick_quests WHERE id = ?').run(id)
    }
    const { lastInsertRowid } = d.prepare('INSERT INTO merrick_quests (token) VALUES (?)').run(token)
    insertItems(Number(lastInsertRowid), dishes)
  })()
  return token
}

function getQuestId(token: string): number | null {
  const row = db().prepare('SELECT id FROM merrick_quests WHERE token = ?').get(token) as { id: number } | undefined
  return row?.id ?? null
}

export function getMerrickQuest(token: string): MerrickQuest | null {
  const d = db()
  const quest = d.prepare('SELECT id, updated_at FROM merrick_quests WHERE token = ?').get(token) as { id: number, updated_at: string } | undefined
  if (!quest) return null
  const rows = d.prepare('SELECT * FROM merrick_quest_items WHERE quest_id = ? ORDER BY dish_index, position').all(quest.id) as ItemRow[]
  const dishes: MerrickDish[] = []
  for (const row of rows) {
    const dish = dishes[row.dish_index] ??= { course: row.course, name: row.dish_name, ingredients: [] }
    dish.ingredients.push({
      id: row.id,
      type: row.item_type,
      key: row.item_key,
      variant: row.variant,
      state: row.state,
      quantity: row.quantity,
      delivered: row.delivered
    })
  }
  return { token, updatedAt: quest.updated_at, dishes: dishes.filter(Boolean) }
}

// Remplace le contenu de la liste ; les ingrédients conservés (même id) gardent leur avancement.
export function updateMerrickQuest(token: string, dishes: MerrickDish[]): boolean {
  const d = db()
  const questId = getQuestId(token)
  if (!questId) return false
  d.transaction(() => {
    const previous = d.prepare('SELECT id, delivered FROM merrick_quest_items WHERE quest_id = ?').all(questId) as { id: number, delivered: number }[]
    d.prepare('DELETE FROM merrick_quest_items WHERE quest_id = ?').run(questId)
    insertItems(questId, dishes, new Map(previous.map(p => [p.id, p.delivered])))
    d.prepare('UPDATE merrick_quests SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(questId)
  })()
  return true
}

// Coche / décoche une unité d'un ingrédient (borné entre 0 et la quantité demandée).
export function stepMerrickItem(token: string, itemId: number, delta: 1 | -1): { id: number, delivered: number } | null {
  const d = db()
  const questId = getQuestId(token)
  if (!questId) return null
  const row = d.prepare(`
    UPDATE merrick_quest_items
    SET delivered = MAX(0, MIN(quantity, delivered + ?))
    WHERE id = ? AND quest_id = ?
    RETURNING id, delivered
  `).get(delta, itemId, questId) as { id: number, delivered: number } | undefined
  if (!row) return null
  d.prepare('UPDATE merrick_quests SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(questId)
  return row
}

// Suppression autorisée uniquement une fois tous les ingrédients livrés.
export function deleteCompletedMerrickQuest(token: string): 'deleted' | 'not-found' | 'incomplete' {
  const d = db()
  const questId = getQuestId(token)
  if (!questId) return 'not-found'
  const { remaining } = d.prepare('SELECT COUNT(*) AS remaining FROM merrick_quest_items WHERE quest_id = ? AND delivered < quantity').get(questId) as { remaining: number }
  if (remaining > 0) return 'incomplete'
  d.transaction(() => {
    d.prepare('DELETE FROM merrick_quest_items WHERE quest_id = ?').run(questId)
    d.prepare('DELETE FROM merrick_quests WHERE id = ?').run(questId)
  })()
  return 'deleted'
}
