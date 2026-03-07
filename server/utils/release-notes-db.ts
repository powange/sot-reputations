import { join } from 'path'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

export const RELEASE_NOTES_DB_PATH = join('/app/data', 'release-notes.db')

export function getReleaseNotesDb(): Database.Database {
  if (db) return db

  db = new Database(RELEASE_NOTES_DB_PATH)

  db.exec(`
    CREATE TABLE IF NOT EXISTS release_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_release_notes_date ON release_notes(date DESC);
  `)

  return db
}

export interface ReleaseNoteRow {
  id: number
  version: string
  date: string
  content: string | null
}

// Toutes les release notes (pour l'admin)
export function getReleaseNotes(): ReleaseNoteRow[] {
  const db = getReleaseNotesDb()
  return db.prepare('SELECT id, version, date, content FROM release_notes ORDER BY date DESC').all() as ReleaseNoteRow[]
}

// Uniquement les release notes avec contenu (pour la page publique)
export function getReleaseNotesWithContent(): ReleaseNoteRow[] {
  const db = getReleaseNotesDb()
  return db.prepare('SELECT id, version, date, content FROM release_notes WHERE content IS NOT NULL ORDER BY date DESC').all() as ReleaseNoteRow[]
}

export function getReleaseNoteById(id: number): ReleaseNoteRow | undefined {
  const db = getReleaseNotesDb()
  return db.prepare('SELECT id, version, date, content FROM release_notes WHERE id = ?').get(id) as ReleaseNoteRow | undefined
}

export function getReleaseNoteByVersion(version: string): ReleaseNoteRow | undefined {
  const db = getReleaseNotesDb()
  return db.prepare('SELECT id, version, date, content FROM release_notes WHERE version = ?').get(version) as ReleaseNoteRow | undefined
}

export function insertReleaseNote(version: string, date: string, content: string | null = null): number {
  const db = getReleaseNotesDb()
  const result = db.prepare('INSERT OR IGNORE INTO release_notes (version, date, content) VALUES (?, ?, ?)').run(version, date, content)
  return Number(result.lastInsertRowid)
}

export function updateReleaseNoteContent(id: number, content: string): void {
  const db = getReleaseNotesDb()
  db.prepare('UPDATE release_notes SET content = ? WHERE id = ?').run(content, id)
}

export function deleteReleaseNote(id: number): void {
  const db = getReleaseNotesDb()
  db.prepare('DELETE FROM release_notes WHERE id = ?').run(id)
}
