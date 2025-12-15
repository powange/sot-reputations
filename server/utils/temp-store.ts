// Stockage temporaire en mémoire pour les imports via bookmarklet
// Les données expirent après 5 minutes

interface TempEntry {
  data: unknown
  createdAt: number
}

const tempStore = new Map<string, TempEntry>()
const EXPIRY_TIME = 5 * 60 * 1000 // 5 minutes

// Nettoyer les entrées expirées
function cleanup() {
  const now = Date.now()
  for (const [key, value] of tempStore.entries()) {
    if (now - value.createdAt > EXPIRY_TIME) {
      tempStore.delete(key)
    }
  }
}

// Nettoyer toutes les minutes
setInterval(cleanup, 60 * 1000)

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function storeTempData(data: unknown): string {
  cleanup() // Nettoyer avant d'ajouter

  // Générer un code unique
  let code = generateCode()
  let attempts = 0
  while (tempStore.has(code) && attempts < 10) {
    code = generateCode()
    attempts++
  }

  tempStore.set(code, {
    data,
    createdAt: Date.now()
  })

  return code
}

export function getTempData(code: string): unknown | null {
  const entry = tempStore.get(code)
  if (!entry) return null

  // Vérifier l'expiration
  if (Date.now() - entry.createdAt > EXPIRY_TIME) {
    tempStore.delete(code)
    return null
  }

  // Supprimer après récupération (usage unique)
  tempStore.delete(code)
  return entry.data
}
