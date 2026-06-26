import bcrypt from 'bcrypt'
import { getReputationDb, importReputationData, importChestData, getGroupsByUserId, setChestItemCost, setChestItemPrereqs } from '../utils/reputation-db'
import { fetchWikiItemsByTitles, normalizeName } from '../utils/sot-wiki'
import { broadcastToGroups } from '../utils/sse'

// Plafond d'items enrichis par import. L'endpoint /api/import est non authentifié et
// le payload de coffre est contrôlable : sans plafond, un import forgé déclencherait
// un nombre illimité de requêtes sortantes vers le wiki. Au-delà du seuil, on s'abstient
// (drop de contenu légitime → synchro admin ; payload abusif → ignoré).
const ENRICH_MAX_NEW_ITEMS = 50

/**
 * Enrichit (best-effort) les items tout juste créés dans le catalogue partagé avec
 * leur coût et leurs prérequis lus sur le wiki. N'est lancé qu'en arrière-plan
 * (fire-and-forget) : ne bloque jamais la réponse d'import et n'écrit que sur des
 * items neufs (donc encore vides). La synchro admin reste le filet de secours.
 */
async function enrichNewChestItemsFromWiki(newItems: Array<{ id: number, enTitle: string }>): Promise<void> {
  // '|' est un caractère interdit dans un titre wiki et casserait le batch titles=A|B.
  const titles = [...new Set(newItems.map(n => n.enTitle.trim()).filter(t => t && !t.includes('|')))]
  if (!titles.length) return
  const wiki = await fetchWikiItemsByTitles(titles)
  const byTitle = new Map(wiki.map(w => [normalizeName(w.title), w]))
  for (const n of newItems) {
    const w = byTitle.get(normalizeName(n.enTitle))
    if (!w) continue
    if (w.cost) setChestItemCost(n.id, w.cost)
    if (w.prereqs) setChestItemPrereqs(n.id, w.prereqs)
  }
}

// Mappe une erreur d'import vers un code HTTP (400 si JSON pas en français, 500 sinon).
function throwImportError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Erreur inconnue'
  const isValidationError = message.includes('français') || message.includes('francais')
  throw createError({ statusCode: isValidationError ? 400 : 500, message })
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, jsonData } = body

  // Vérifier si l'utilisateur est connecté via session
  const sessionUser = event.context.user

  if (!jsonData) {
    throw createError({
      statusCode: 400,
      message: 'jsonData est requis'
    })
  }

  // Valider que jsonData est un objet valide
  if (typeof jsonData !== 'object' || jsonData === null) {
    throw createError({
      statusCode: 400,
      message: 'jsonData doit etre un objet JSON valide'
    })
  }

  // Format combiné { reputation, chest } (bookmarklet v7+) vs réputation brute
  // (ancien bookmarklet / collage manuel) — rétro-compatible.
  const wrapper = jsonData as { reputation?: unknown, chest?: unknown, chestEn?: unknown, chestEs?: unknown }
  const hasWrapper = typeof wrapper.reputation === 'object' && wrapper.reputation !== null
  const reputationData = hasWrapper ? wrapper.reputation : jsonData
  const chestData = hasWrapper && wrapper.chest && typeof wrapper.chest === 'object' ? wrapper.chest : null
  // Coffres EN/ES (bookmarklet v8+) : alimentent les traductions de noms d'items.
  const chestEn = hasWrapper && wrapper.chestEn && typeof wrapper.chestEn === 'object' ? wrapper.chestEn : null
  const chestEs = hasWrapper && wrapper.chestEs && typeof wrapper.chestEs === 'object' ? wrapper.chestEs : null

  const db = getReputationDb()
  let userId: number
  let isNewUser = false

  if (sessionUser) {
    // Utilisateur connecté via session : pas besoin de mot de passe
    userId = sessionUser.id
    db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId)
  } else {
    // Pas de session : username et password requis
    if (!username || !password) {
      throw createError({
        statusCode: 400,
        message: 'Username et password sont requis'
      })
    }

    // Vérifier si l'utilisateur existe
    const existingUser = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as { id: number, password_hash: string } | undefined

    if (existingUser) {
      // Utilisateur existe : vérifier le mot de passe
      const passwordMatch = await bcrypt.compare(password, existingUser.password_hash)
      if (!passwordMatch) {
        throw createError({
          statusCode: 401,
          message: 'Mot de passe incorrect'
        })
      }
      userId = existingUser.id
      db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId)
    } else {
      // Nouvel utilisateur : créer le compte ET importer dans UNE transaction,
      // pour ne pas laisser un compte orphelin si l'import échoue (cas fréquent :
      // JSON non-français rejeté par importReputationData -> rollback de l'INSERT).
      const passwordHash = await bcrypt.hash(password, 10)
      const createAndImport = db.transaction(() => {
        const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash)
        const newId = Number(result.lastInsertRowid)
        importReputationData(newId, reputationData)
        return newId
      })
      try {
        userId = createAndImport()
      } catch (error) {
        throwImportError(error)
      }
      isNewUser = true
    }
  }

  // Importer les données de réputation (déjà fait dans la transaction de création
  // pour un nouveau compte).
  if (!isNewUser) {
    try {
      importReputationData(userId, reputationData)
    } catch (error) {
      throwImportError(error)
    }
  }

  // Importer le coffre si présent (best-effort : ne fait pas échouer l'import
  // de réputation déjà réussi en cas de données de coffre invalides).
  let newChestItems: Array<{ id: number, enTitle: string }> = []
  if (chestData) {
    try {
      newChestItems = importChestData(userId, chestData, { en: chestEn, es: chestEs }).newItems
    } catch (error) {
      // coffre optionnel : on n'échoue pas l'import de réputation, mais on trace.
      console.error('[import] Échec de l\'import du coffre:', error instanceof Error ? error.message : error)
    }
  }

  // Enrichissement wiki des nouveaux items du catalogue, en arrière-plan : on ne
  // bloque pas la réponse. Les coûts/prérequis apparaîtront au prochain affichage.
  // Borné par ENRICH_MAX_NEW_ITEMS pour éviter une amplification de requêtes sortantes.
  if (newChestItems.length > 0 && newChestItems.length <= ENRICH_MAX_NEW_ITEMS) {
    enrichNewChestItemsFromWiki(newChestItems).catch((error) => {
      console.error('[import] Échec de l\'enrichissement wiki des nouveaux items:', error instanceof Error ? error.message : error)
    })
  } else if (newChestItems.length > ENRICH_MAX_NEW_ITEMS) {
    console.warn(`[import] Enrichissement wiki ignoré (${newChestItems.length} nouveaux items > ${ENRICH_MAX_NEW_ITEMS}) ; synchro admin requise.`)
  }

  // Notifier les groupes de l'utilisateur via SSE
  const userGroups = getGroupsByUserId(userId)
  if (userGroups.length > 0) {
    const groupUids = userGroups.map(g => g.uid)
    const importerUsername = sessionUser?.username || username
    broadcastToGroups(groupUids, 'member-updated', {
      userId,
      username: importerUsername,
      timestamp: Date.now()
    })
  }

  return {
    success: true,
    message: isNewUser ? 'Compte cree et donnees importees avec succes' : 'Donnees mises a jour avec succes',
    userId
  }
})
