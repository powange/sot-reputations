// Stockage temporaire en mémoire pour les imports via bookmarklet
// Les données expirent après 5 minutes
import { randomBytes } from 'crypto'

interface TempEntry {
  data: unknown
  createdAt: number
}

const tempStore = new Map<string, TempEntry>()
const EXPIRY_TIME = 5 * 60 * 1000 // 5 minutes

// Garde-fous anti-DoS (le store est en mémoire et alimenté par des endpoints publics)
const MAX_ENTRIES = 1000
const MAX_DATA_BYTES = 1024 * 1024 // 1 Mo par entrée

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
  const bytes = randomBytes(16)
  let result = ''
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(bytes[i] % chars.length)
  }
  return result
}

export function storeTempData(data: unknown): string {
  cleanup() // Nettoyer avant d'ajouter

  // Refuser les payloads trop volumineux
  if (JSON.stringify(data ?? null).length > MAX_DATA_BYTES) {
    throw createError({ statusCode: 413, message: 'Donnees trop volumineuses' })
  }

  // Plafonner le nombre d'entrées : si plein, évincer la plus ancienne
  if (tempStore.size >= MAX_ENTRIES) {
    const oldestKey = tempStore.keys().next().value
    if (oldestKey) tempStore.delete(oldestKey)
  }

  // Générer un code unique (aléatoire cryptographique)
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
