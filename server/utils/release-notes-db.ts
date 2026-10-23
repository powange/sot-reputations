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

  // Migration : ajout colonne display_version
  try {
    db.exec('ALTER TABLE release_notes ADD COLUMN display_version TEXT')
  } catch {
    // Colonne déjà existante
  }

  return db
}

export interface ReleaseNoteRow {
  id: number
  version: string
  display_version: string | null
  date: string
  content: string | null
}

// Toutes les release notes (pour l'admin)
export function getReleaseNotes(): ReleaseNoteRow[] {
  const db = getReleaseNotesDb()
  return db.prepare('SELECT id, version, display_version, date, content FROM release_notes ORDER BY date DESC').all() as ReleaseNoteRow[]
}

// Uniquement les release notes avec contenu (pour la page publique)
export function getReleaseNotesWithContent(): ReleaseNoteRow[] {
  const db = getReleaseNotesDb()
  return db.prepare('SELECT id, version, display_version, date, content FROM release_notes WHERE content IS NOT NULL ORDER BY date DESC').all() as ReleaseNoteRow[]
}

export type ReleaseNoteSummary = Omit<ReleaseNoteRow, 'content'>

// Compare deux versions « 3.8.0.2 » numériquement (décroissant : la plus récente d'abord).
function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0)
    if (diff) return diff
  }
  return 0
}

// Versions publiées (avec contenu), sans le contenu : la plus récente d'abord.
// À date égale (plusieurs versions publiées le même jour), le numéro départage.
export function getReleaseNoteVersions(): ReleaseNoteSummary[] {
  const db = getReleaseNotesDb()
  const rows = db.prepare('SELECT id, version, display_version, date FROM release_notes WHERE content IS NOT NULL').all() as ReleaseNoteSummary[]
  return rows.sort((a, b) => b.date.localeCompare(a.date) || compareVersionsDesc(a.version, b.version))
}

// Dernière version publiée (avec contenu)
export function getLatestReleaseNote(): ReleaseNoteRow | undefined {
  const latest = getReleaseNoteVersions()[0]
  return latest ? getReleaseNoteById(latest.id) : undefined
}

// Version publiée (avec contenu) par numéro interne ou affiché
export function getPublishedReleaseNote(version: string): ReleaseNoteRow | undefined {
  const db = getReleaseNotesDb()
  return db.prepare('SELECT id, version, display_version, date, content FROM release_notes WHERE content IS NOT NULL AND (version = ? OR display_version = ?) LIMIT 1').get(version, version) as ReleaseNoteRow | undefined
}

export function getReleaseNoteById(id: number): ReleaseNoteRow | undefined {
  const db = getReleaseNotesDb()
  return db.prepare('SELECT id, version, display_version, date, content FROM release_notes WHERE id = ?').get(id) as ReleaseNoteRow | undefined
}

export function getReleaseNoteByVersion(version: string): ReleaseNoteRow | undefined {
  const db = getReleaseNotesDb()
  return db.prepare('SELECT id, version, display_version, date, content FROM release_notes WHERE version = ?').get(version) as ReleaseNoteRow | undefined
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

export function updateReleaseNoteDisplayVersion(id: number, displayVersion: string): void {
  const db = getReleaseNotesDb()
  db.prepare('UPDATE release_notes SET display_version = ? WHERE id = ?').run(displayVersion, id)
}

export function updateReleaseNoteDate(id: number, date: string): void {
  const db = getReleaseNotesDb()
  db.prepare('UPDATE release_notes SET date = ? WHERE id = ?').run(date, id)
}

export function deleteReleaseNote(id: number): void {
  const db = getReleaseNotesDb()
  db.prepare('DELETE FROM release_notes WHERE id = ?').run(id)
}
