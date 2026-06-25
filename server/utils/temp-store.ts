// Stockage temporaire en mémoire pour les imports via bookmarklet
// Les données expirent après 5 minutes
import { randomBytes } from 'crypto'

interface TempEntry {
  data: unknown
  createdAt: number
  size: number
}

const tempStore = new Map<string, TempEntry>()
const EXPIRY_TIME = 5 * 60 * 1000 // 5 minutes

// Garde-fous anti-DoS (le store est en mémoire et alimenté par des endpoints publics)
const MAX_ENTRIES = 1000
const MAX_TOTAL_BYTES = 128 * 1024 * 1024 // budget mémoire global : 128 Mo

// Limites par type de payload (en octets)
export const REPUTATION_MAX_BYTES = 8 * 1024 * 1024 // 8 Mo (réputation complète d'un compte)
export const TRANSLATION_MAX_BYTES = 32 * 1024 * 1024 // 32 Mo (3 langues x tous les emblèmes)
export const IMPORT_MAX_BYTES = 32 * 1024 * 1024 // 32 Mo (réputation + coffre, ~6000 items)

let totalBytes = 0

function removeEntry(key: string): void {
  const entry = tempStore.get(key)
  if (entry) {
    totalBytes -= entry.size
    tempStore.delete(key)
  }
}

// Nettoyer les entrées expirées
function cleanup() {
  const now = Date.now()
  for (const [key, value] of tempStore.entries()) {
    if (now - value.createdAt > EXPIRY_TIME) {
      removeEntry(key)
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
    result += chars.charAt(bytes[i]! % chars.length)
  }
  return result
}

export function storeTempData(data: unknown, maxBytes: number = REPUTATION_MAX_BYTES): string {
  cleanup() // Nettoyer avant d'ajouter

  // Refuser les payloads trop volumineux (taille réelle en octets, accents inclus)
  const size = Buffer.byteLength(JSON.stringify(data ?? null))
  if (size > maxBytes) {
    throw createError({ statusCode: 413, message: 'Donnees trop volumineuses' })
  }

  // Rester dans le budget mémoire global : évincer les plus anciennes entrées
  while (totalBytes + size > MAX_TOTAL_BYTES && tempStore.size > 0) {
    const oldestKey = tempStore.keys().next().value
    if (!oldestKey) break
    removeEntry(oldestKey)
  }

  // Plafonner le nombre d'entrées
  while (tempStore.size >= MAX_ENTRIES) {
    const oldestKey = tempStore.keys().next().value
    if (!oldestKey) break
    removeEntry(oldestKey)
  }

  // Générer un code unique (aléatoire cryptographique)
  let code = generateCode()
  let attempts = 0
  while (tempStore.has(code) && attempts < 10) {
    code = generateCode()
    attempts++
  }

  tempStore.set(code, { data, createdAt: Date.now(), size })
  totalBytes += size

  return code
}

export function getTempData(code: string): unknown | null {
  const entry = tempStore.get(code)
  if (!entry) return null

  // Vérifier l'expiration
  if (Date.now() - entry.createdAt > EXPIRY_TIME) {
    removeEntry(code)
    return null
  }

  // Supprimer après récupération (usage unique)
  removeEntry(code)
  return entry.data
}
