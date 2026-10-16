import { getReputationDb } from './reputation-db'

// Réglages simples clé -> valeur JSON, modifiables depuis l'admin (ex. ancrage des feux d'artifice).
let initialized = false

function db() {
  const d = getReputationDb()
  if (!initialized) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    initialized = true
  }
  return d
}

export function getSetting<T>(key: string): { value: T, updatedAt: string } | null {
  const row = db().prepare('SELECT value, updated_at FROM app_settings WHERE key = ?').get(key) as { value: string, updated_at: string } | undefined
  if (!row) return null
  try {
    return { value: JSON.parse(row.value) as T, updatedAt: row.updated_at }
  } catch {
    return null
  }
}

export function setSetting(key: string, value: unknown): void {
  db().prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(value))
}

export function deleteSetting(key: string): void {
  db().prepare('DELETE FROM app_settings WHERE key = ?').run(key)
}
