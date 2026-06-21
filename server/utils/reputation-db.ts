import { join } from 'path'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

export const DB_PATH = join('/app/data', 'reputation.db')

export function getReputationDb(): Database.Database {
  if (db) return db

  db = new Database(DB_PATH)

  // Créer les tables si elles n'existent pas
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_import_at DATETIME,
      is_admin INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS factions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      motto TEXT
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faction_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (faction_id) REFERENCES factions(id),
      UNIQUE(faction_id, key)
    );

    CREATE TABLE IF NOT EXISTS emblems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      image TEXT,
      max_grade INTEGER DEFAULT 5,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      UNIQUE(campaign_id, key)
    );

    CREATE TABLE IF NOT EXISTS user_emblems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      emblem_id INTEGER NOT NULL,
      value INTEGER DEFAULT 0,
      threshold INTEGER DEFAULT 0,
      grade INTEGER DEFAULT 0,
      completed BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (emblem_id) REFERENCES emblems(id),
      UNIQUE(user_id, emblem_id)
    );

    CREATE INDEX IF NOT EXISTS idx_campaigns_faction ON campaigns(faction_id);
    CREATE INDEX IF NOT EXISTS idx_emblems_campaign ON emblems(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_user_emblems_user ON user_emblems(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_emblems_emblem ON user_emblems(emblem_id);

    -- Groupes
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Membres de groupes
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    );

    -- Sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Liens d'invitation aux groupes
    CREATE TABLE IF NOT EXISTS group_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      max_uses INTEGER,
      uses_count INTEGER DEFAULT 0,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Invitations en attente (par pseudo)
    CREATE TABLE IF NOT EXISTS group_pending_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      invited_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    );

    -- Seuils de grades des emblemes (collectes lors des imports)
    CREATE TABLE IF NOT EXISTS emblem_grade_thresholds (
      emblem_id INTEGER NOT NULL,
      grade INTEGER NOT NULL,
      threshold INTEGER NOT NULL,
      PRIMARY KEY (emblem_id, grade),
      FOREIGN KEY (emblem_id) REFERENCES emblems(id) ON DELETE CASCADE
    );

    -- Traductions des emblèmes (EN, ES)
    CREATE TABLE IF NOT EXISTS emblem_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emblem_id INTEGER NOT NULL,
      locale TEXT NOT NULL,
      name TEXT,
      description TEXT,
      FOREIGN KEY (emblem_id) REFERENCES emblems(id) ON DELETE CASCADE,
      UNIQUE(emblem_id, locale)
    );

    -- Jetons d'API (accès lecture pour agents externes, gérés par un admin)
    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      token_prefix TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      revoked_at DATETIME,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Traductions des factions (EN, ES) — le nom/motto de base est en français
    CREATE TABLE IF NOT EXISTS faction_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faction_id INTEGER NOT NULL,
      locale TEXT NOT NULL,
      name TEXT,
      motto TEXT,
      FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
      UNIQUE(faction_id, locale)
    );

    -- Traductions des campagnes (EN, ES) — le nom/description de base est en français
    CREATE TABLE IF NOT EXISTS campaign_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      locale TEXT NOT NULL,
      name TEXT,
      description TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      UNIQUE(campaign_id, locale)
    );

    CREATE INDEX IF NOT EXISTS idx_groups_uid ON groups(uid);
    CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_group_invites_code ON group_invites(code);
    CREATE INDEX IF NOT EXISTS idx_group_invites_group ON group_invites(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_pending_invites_user ON group_pending_invites(user_id);
    CREATE INDEX IF NOT EXISTS idx_group_pending_invites_group ON group_pending_invites(group_id);
    CREATE INDEX IF NOT EXISTS idx_emblem_grade_thresholds_emblem ON emblem_grade_thresholds(emblem_id);
    CREATE INDEX IF NOT EXISTS idx_emblem_translations_emblem ON emblem_translations(emblem_id);
    CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_faction_translations_faction ON faction_translations(faction_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_translations_campaign ON campaign_translations(campaign_id);
  `)

  // Migration: ajouter last_import_at si la colonne n'existe pas
  const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
  const hasLastImportAt = userColumns.some(col => col.name === 'last_import_at')
  if (!hasLastImportAt) {
    db.exec('ALTER TABLE users ADD COLUMN last_import_at DATETIME')
  }

  // Migration: ajouter sort_order aux campagnes si la colonne n'existe pas
  const campaignColumns = db.prepare('PRAGMA table_info(campaigns)').all() as Array<{ name: string }>
  const hasSortOrder = campaignColumns.some(col => col.name === 'sort_order')
  if (!hasSortOrder) {
    db.exec('ALTER TABLE campaigns ADD COLUMN sort_order INTEGER DEFAULT 0')
  }

  // Migration: ajouter sort_order aux emblèmes si la colonne n'existe pas
  const emblemColumns = db.prepare('PRAGMA table_info(emblems)').all() as Array<{ name: string }>
  const hasEmblemSortOrder = emblemColumns.some(col => col.name === 'sort_order')
  if (!hasEmblemSortOrder) {
    db.exec('ALTER TABLE emblems ADD COLUMN sort_order INTEGER DEFAULT 0')
  }

  // Migration: ajouter description aux campagnes si la colonne n'existe pas
  const campaignColumnsForDesc = db.prepare('PRAGMA table_info(campaigns)').all() as Array<{ name: string }>
  const hasCampaignDesc = campaignColumnsForDesc.some(col => col.name === 'description')
  if (!hasCampaignDesc) {
    db.exec('ALTER TABLE campaigns ADD COLUMN description TEXT')
  }

  // Migration: ajouter microsoft_id aux utilisateurs pour OAuth Microsoft
  const userColumnsForMicrosoft = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
  const hasMicrosoftId = userColumnsForMicrosoft.some(col => col.name === 'microsoft_id')
  if (!hasMicrosoftId) {
    db.exec('ALTER TABLE users ADD COLUMN microsoft_id TEXT')
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_microsoft_id ON users(microsoft_id)')
  }

  // Migration: ajouter is_admin aux utilisateurs pour le système d'administration
  const userColumnsForAdmin = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
  const hasIsAdmin = userColumnsForAdmin.some(col => col.name === 'is_admin')
  if (!hasIsAdmin) {
    db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0')
  }

  // Migration: ajouter is_moderator aux utilisateurs
  const hasIsModerator = userColumnsForAdmin.some(col => col.name === 'is_moderator')
  if (!hasIsModerator) {
    db.exec('ALTER TABLE users ADD COLUMN is_moderator INTEGER DEFAULT 0')
  }

  // Migration: ajouter validated aux emblèmes (nouveaux emblèmes non validés par défaut)
  const emblemColumnsForValidated = db.prepare('PRAGMA table_info(emblems)').all() as Array<{ name: string }>
  const hasValidated = emblemColumnsForValidated.some(col => col.name === 'validated')
  if (!hasValidated) {
    db.exec('ALTER TABLE emblems ADD COLUMN validated INTEGER DEFAULT 0')
    db.exec('UPDATE emblems SET validated = 1') // Valider tous les emblèmes existants
  }

  // Migration: convertir les rôles 'admin' en 'chef' pour le nouveau système de grades
  const hasAdminRole = db.prepare(`
    SELECT id FROM group_members WHERE role = 'admin' LIMIT 1
  `).get()
  if (hasAdminRole) {
    db.exec(`UPDATE group_members SET role = 'chef' WHERE role = 'admin'`)
  }

  return db
}

export function closeReputationDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

// Noms des factions en français (seules ces factions seront importées)
const FACTION_NAMES: Record<string, string> = {
  AthenasFortune: 'Fortune d\'Athéna',
  ReapersBones: 'Os de la faucheuse',
  HuntersCall: 'L\'appel du chasseur',
  GoldHoarders: 'Collectionneurs d\'or',
  SeaDogs: 'Loups de mer',
  TallTales: 'Fables du flibustier',
  OrderOfSouls: 'Ordre des âmes',
  MerchantAlliance: 'Alliance des marchands',
  CreatorCrew: 'Creator Crew',
  BilgeRats: 'Aventure en mer',
  PirateLord: 'Gardiens de la Fortune',
  Flameheart: 'Serviteurs de la Flamme'
}

// Liste des factions valides (ignore tout le reste comme les guildes avec UUID)
const VALID_FACTIONS = Object.keys(FACTION_NAMES)

interface EmblemData {
  'DisplayName'?: string
  '#Name'?: string
  'Description'?: string
  'Image'?: string
  'image'?: string
  'MaxGrade'?: number
  'Value'?: number
  'Threshold'?: number
  'Grade'?: number
  'Completed'?: boolean
}

interface CampaignData {
  Title?: string
  Desc?: string
  Emblems?: EmblemData[]
}

interface FactionData {
  Motto?: string
  Emblems?: {
    Emblems?: EmblemData[]
  }
  Campaigns?: Record<string, CampaignData>
}

type ReputationJson = Record<string, FactionData>

// Mots-clés français pour vérifier la langue du JSON
const FRENCH_KEYWORDS = [
  'Les mers nous appartiennent', // Motto AthenasFortune
  'Nous voyons tout', // Motto OrderOfSouls
  'Le commerce avant tout' // Motto MerchantAlliance
]

export function validateJsonLanguage(jsonData: ReputationJson): boolean {
  // Vérifier si au moins un motto français est présent
  for (const factionData of Object.values(jsonData)) {
    if (factionData.Motto && FRENCH_KEYWORDS.includes(factionData.Motto)) {
      return true
    }
  }
  return false
}

export function importReputationData(userId: number, jsonData: ReputationJson): void {
  // Vérifier que le JSON est en français
  if (!validateJsonLanguage(jsonData)) {
    throw new Error('Le JSON doit être en français. Changez la langue du site Sea of Thieves en français avant de récupérer vos données.')
  }
  const db = getReputationDb()

  // Le motto vient du site officiel (source de vérité) : on le rafraîchit à chaque
  // import. Le nom n'est PAS touché en conflit (FACTION_NAMES / édition admin).
  const insertFaction = db.prepare(`
    INSERT INTO factions (key, name, motto) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET motto = excluded.motto
  `)

  const getFactionId = db.prepare(`SELECT id FROM factions WHERE key = ?`)

  // Nom (Title) et description (Desc) viennent du site officiel (source de vérité) :
  // rafraîchis à chaque import.
  const insertCampaign = db.prepare(`
    INSERT INTO campaigns (faction_id, key, name, description, sort_order) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(faction_id, key) DO UPDATE SET
      name = excluded.name,
      description = COALESCE(excluded.description, campaigns.description),
      sort_order = excluded.sort_order
  `)

  const getCampaignId = db.prepare(`
    SELECT id FROM campaigns WHERE faction_id = ? AND key = ?
  `)

  const insertEmblem = db.prepare(`
    INSERT INTO emblems (campaign_id, key, name, description, image, max_grade, sort_order, validated)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(campaign_id, key) DO UPDATE SET
      image = COALESCE(NULLIF(excluded.image, ''), emblems.image),
      sort_order = excluded.sort_order
  `)

  const getEmblemId = db.prepare(`
    SELECT id FROM emblems WHERE campaign_id = ? AND key = ?
  `)

  const upsertUserEmblem = db.prepare(`
    INSERT INTO user_emblems (user_id, emblem_id, value, threshold, grade, completed)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, emblem_id) DO UPDATE SET
      value = excluded.value,
      threshold = excluded.threshold,
      grade = excluded.grade,
      completed = excluded.completed
  `)

  const upsertGradeThreshold = db.prepare(`
    INSERT INTO emblem_grade_thresholds (emblem_id, grade, threshold)
    VALUES (?, ?, ?)
    ON CONFLICT(emblem_id, grade) DO UPDATE SET
      threshold = excluded.threshold
  `)

  const updateLastImport = db.prepare(`
    UPDATE users SET last_import_at = CURRENT_TIMESTAMP WHERE id = ?
  `)

  // Mettre à jour l'image si l'emblème est complété et l'image importée est différente
  const updateEmblemImageIfCompleted = db.prepare(`
    UPDATE emblems SET image = ?
    WHERE id = ? AND (image IS NULL OR image = '' OR image != ?)
  `)

  const transaction = db.transaction(() => {
    // Mettre à jour la date du dernier import
    updateLastImport.run(userId)

    for (const [factionKey, factionData] of Object.entries(jsonData)) {
      // Ignorer les factions non reconnues (guildes avec UUID, etc.)
      if (!VALID_FACTIONS.includes(factionKey)) continue

      const factionName = FACTION_NAMES[factionKey] || factionKey
      insertFaction.run(factionKey, factionName, factionData.Motto || '')

      const factionRow = getFactionId.get(factionKey) as { id: number }
      const factionId = factionRow.id

      // Factions avec Campaigns (BilgeRats, HuntersCall)
      if (factionData.Campaigns) {
        const campaignEntries = Object.entries(factionData.Campaigns)
        for (let i = 0; i < campaignEntries.length; i++) {
          const [campaignKey, campaignData] = campaignEntries[i]!
          const campaignName = campaignData.Title || campaignKey
          const campaignDesc = campaignData.Desc || ''
          insertCampaign.run(factionId, campaignKey, campaignName, campaignDesc, i)

          const campaignRow = getCampaignId.get(factionId, campaignKey) as { id: number }
          const campaignId = campaignRow.id

          if (campaignData.Emblems) {
            for (let j = 0; j < campaignData.Emblems.length; j++) {
              const emblem = campaignData.Emblems[j]!
              const emblemKey = emblem['#Name'] || emblem.DisplayName || ''
              if (!emblemKey) continue

              insertEmblem.run(
                campaignId,
                emblemKey,
                emblem.DisplayName || emblemKey,
                emblem.Description || '',
                emblem.image || '',
                emblem.MaxGrade || 5,
                j
              )

              const emblemRow = getEmblemId.get(campaignId, emblemKey) as { id: number }

              // Si complété avec une image, mettre à jour l'image de l'emblème
              if (emblem.Completed && emblem.image) {
                updateEmblemImageIfCompleted.run(emblem.image, emblemRow.id, emblem.image)
              }

              upsertUserEmblem.run(
                userId,
                emblemRow.id,
                emblem.Value || 0,
                emblem.Threshold || 0,
                emblem.Grade || 0,
                emblem.Completed ? 1 : 0
              )

              // Enregistrer le seuil du grade actuel
              const grade = emblem.Grade || 0
              const threshold = emblem.Threshold || 0
              const value = emblem.Value || 0
              const maxGrade = emblem.MaxGrade || 1

              // Pour max_grade=1 complétés, Grade reste à 0 mais c'est effectivement grade 1
              const gradeToStore = (emblem.Completed && maxGrade === 1 && grade === 0) ? 1 : grade
              let thresholdToStore = threshold > 0 ? threshold : value

              // Pour les emblèmes binaires complétés (HasScalar=false), utiliser 1 comme seuil
              if (gradeToStore > 0 && thresholdToStore === 0 && emblem.Completed) {
                thresholdToStore = 1
              }

              if (gradeToStore > 0 && thresholdToStore > 0) {
                upsertGradeThreshold.run(emblemRow.id, gradeToStore, thresholdToStore)
              }
            }
          }
        }
      } else {
        // Factions standard avec Emblems.Emblems
        insertCampaign.run(factionId, 'default', factionName, '', 0)

        const campaignRow = getCampaignId.get(factionId, 'default') as { id: number }
        const campaignId = campaignRow.id

        const emblems = factionData.Emblems?.Emblems || []
        for (let j = 0; j < emblems.length; j++) {
          const emblem = emblems[j]!
          const emblemKey = emblem['#Name'] || emblem.DisplayName || ''
          if (!emblemKey) continue

          insertEmblem.run(
            campaignId,
            emblemKey,
            emblem.DisplayName || emblemKey,
            emblem.Description || '',
            emblem.image || '',
            emblem.MaxGrade || 5,
            j
          )

          const emblemRow = getEmblemId.get(campaignId, emblemKey) as { id: number }

          // Si complété avec une image, mettre à jour l'image de l'emblème
          if (emblem.Completed && emblem.image) {
            updateEmblemImageIfCompleted.run(emblem.image, emblemRow.id, emblem.image)
          }

          upsertUserEmblem.run(
            userId,
            emblemRow.id,
            emblem.Value || 0,
            emblem.Threshold || 0,
            emblem.Grade || 0,
            emblem.Completed ? 1 : 0
          )

          // Enregistrer le seuil du grade actuel
          const grade = emblem.Grade || 0
          const threshold = emblem.Threshold || 0
          const value = emblem.Value || 0
          const maxGrade = emblem.MaxGrade || 1

          // Pour max_grade=1 complétés, Grade reste à 0 mais c'est effectivement grade 1
          const gradeToStore = (emblem.Completed && maxGrade === 1 && grade === 0) ? 1 : grade
          let thresholdToStore = threshold > 0 ? threshold : value

          // Pour les emblèmes binaires complétés (HasScalar=false), utiliser 1 comme seuil
          if (gradeToStore > 0 && thresholdToStore === 0 && emblem.Completed) {
            thresholdToStore = 1
          }

          if (gradeToStore > 0 && thresholdToStore > 0) {
            upsertGradeThreshold.run(emblemRow.id, gradeToStore, thresholdToStore)
          }
        }
      }
    }
  })

  transaction()
}

export interface UserInfo {
  id: number
  username: string
  lastImportAt: string | null
}

export interface FactionInfo {
  id: number
  key: string
  name: string
  motto: string
}

export interface CampaignInfo {
  id: number
  key: string
  name: string
  description: string
  factionId: number
}

export interface GradeThreshold {
  grade: number
  threshold: number
}

export interface EmblemInfo {
  id: number
  key: string
  name: string
  description: string
  image: string
  maxGrade: number
  maxThreshold: number | null
  gradeThresholds: GradeThreshold[]
  campaignId: number
  factionKey: string
  campaignName: string
}

export interface UserEmblemProgress {
  userId: number
  username: string
  value: number
  threshold: number
  grade: number
  completed: boolean
}

export function getAllUsers(): UserInfo[] {
  const db = getReputationDb()
  return db.prepare('SELECT id, username, last_import_at as lastImportAt FROM users ORDER BY username').all() as UserInfo[]
}

export function getAllFactions(): FactionInfo[] {
  const db = getReputationDb()
  return db.prepare('SELECT id, key, name, motto FROM factions ORDER BY name').all() as FactionInfo[]
}

export interface FactionTranslation {
  name: string | null
  motto: string | null
}

/** Toutes les traductions de factions, indexées par faction_id puis locale. */
export function getAllFactionTranslations(): Record<number, Record<string, FactionTranslation>> {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT faction_id, locale, name, motto FROM faction_translations
  `).all() as Array<{ faction_id: number, locale: string, name: string | null, motto: string | null }>

  const result: Record<number, Record<string, FactionTranslation>> = {}
  for (const t of rows) {
    let bucket = result[t.faction_id]
    if (!bucket) {
      bucket = {}
      result[t.faction_id] = bucket
    }
    bucket[t.locale] = { name: t.name, motto: t.motto }
  }
  return result
}

export interface CampaignTranslation {
  name: string | null
  description: string | null
}

/** Toutes les traductions de campagnes, indexées par campaign_id puis locale. */
export function getAllCampaignTranslations(): Record<number, Record<string, CampaignTranslation>> {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT campaign_id, locale, name, description FROM campaign_translations
  `).all() as Array<{ campaign_id: number, locale: string, name: string | null, description: string | null }>

  const result: Record<number, Record<string, CampaignTranslation>> = {}
  for (const t of rows) {
    let bucket = result[t.campaign_id]
    if (!bucket) {
      bucket = {}
      result[t.campaign_id] = bucket
    }
    bucket[t.locale] = { name: t.name, description: t.description }
  }
  return result
}

export interface FactionTranslationInput {
  locale: string
  name?: string | null
  motto?: string | null
}

/**
 * Upsert des traductions EN/ES d'une faction. Une traduction dont le nom ET la
 * devise sont vides est supprimée. Les locales non gérées sont ignorées.
 */
export function setFactionTranslations(factionId: number, translations: FactionTranslationInput[]): void {
  const db = getReputationDb()
  const upsert = db.prepare(`
    INSERT INTO faction_translations (faction_id, locale, name, motto)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(faction_id, locale) DO UPDATE SET
      name = excluded.name,
      motto = excluded.motto
  `)
  const del = db.prepare('DELETE FROM faction_translations WHERE faction_id = ? AND locale = ?')

  for (const t of translations) {
    if (!t.locale || !['en', 'es'].includes(t.locale)) continue
    const name = t.name?.trim() || null
    const motto = t.motto?.trim() || null
    if (!name && !motto) {
      del.run(factionId, t.locale)
    } else {
      upsert.run(factionId, t.locale, name, motto)
    }
  }
}

/** Crée une faction (clé + nom/devise FR) et ses traductions, en transaction. */
export function createFaction(
  key: string,
  name: string,
  motto: string | null,
  translations: FactionTranslationInput[] = []
): number {
  const db = getReputationDb()
  const create = db.transaction(() => {
    const result = db.prepare('INSERT INTO factions (key, name, motto) VALUES (?, ?, ?)').run(key, name, motto)
    const id = Number(result.lastInsertRowid)
    setFactionTranslations(id, translations)
    return id
  })
  return create()
}

/** Met à jour le nom/devise FR d'une faction et ses traductions, en transaction. */
export function updateFaction(
  id: number,
  name: string,
  motto: string | null,
  translations: FactionTranslationInput[] = []
): void {
  const db = getReputationDb()
  const update = db.transaction(() => {
    db.prepare('UPDATE factions SET name = ?, motto = ? WHERE id = ?').run(name, motto, id)
    setFactionTranslations(id, translations)
  })
  update()
}

export type ReputationLocaleData = Record<string, Record<string, unknown>>

/**
 * Importe les mottos de factions depuis les données de réputation officielles
 * récupérées par langue (clé `<FactionKey>.Motto`). Met à jour le motto FR de
 * base et upsert les mottos EN/ES dans faction_translations (sans écraser un nom
 * de traduction déjà saisi). Ne crée pas de faction : seules celles déjà en base
 * sont mises à jour.
 */
export function importFactionMottoTranslations(payload: {
  fr?: ReputationLocaleData
  en?: ReputationLocaleData
  es?: ReputationLocaleData
}): { fr: number, en: number, es: number } {
  const db = getReputationDb()
  const factions = db.prepare('SELECT id, key FROM factions').all() as Array<{ id: number, key: string }>

  const updateFrMotto = db.prepare('UPDATE factions SET motto = ? WHERE id = ?')
  const upsertTranslationMotto = db.prepare(`
    INSERT INTO faction_translations (faction_id, locale, name, motto)
    VALUES (?, ?, NULL, ?)
    ON CONFLICT(faction_id, locale) DO UPDATE SET motto = excluded.motto
  `)

  const counts = { fr: 0, en: 0, es: 0 }

  const readMotto = (loc: ReputationLocaleData | undefined, key: string): string | null => {
    const raw = loc?.[key]?.Motto
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null
  }

  const run = db.transaction(() => {
    for (const f of factions) {
      const fr = readMotto(payload.fr, f.key)
      if (fr) {
        updateFrMotto.run(fr, f.id)
        counts.fr++
      }
      const en = readMotto(payload.en, f.key)
      if (en) {
        upsertTranslationMotto.run(f.id, 'en', en)
        counts.en++
      }
      const es = readMotto(payload.es, f.key)
      if (es) {
        upsertTranslationMotto.run(f.id, 'es', es)
        counts.es++
      }
    }
  })
  run()

  return counts
}

/**
 * Importe les traductions de campagnes (Title/Desc) depuis les données de
 * réputation officielles par langue. Met à jour le nom/description FR de base et
 * upsert les traductions EN/ES. Ne traite que les campagnes déjà en base
 * (les campagnes "default" des factions standard ne sont pas concernées).
 */
export function importCampaignTranslations(payload: {
  fr?: ReputationLocaleData
  en?: ReputationLocaleData
  es?: ReputationLocaleData
}): { fr: number, en: number, es: number } {
  const db = getReputationDb()
  const campaigns = db.prepare(`
    SELECT c.id, c.key as campaignKey, f.key as factionKey
    FROM campaigns c
    JOIN factions f ON c.faction_id = f.id
  `).all() as Array<{ id: number, campaignKey: string, factionKey: string }>

  const updateFr = db.prepare(
    'UPDATE campaigns SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?'
  )
  // COALESCE : ne pas mettre à NULL une colonne déjà traduite si l'import courant
  // n'apporte qu'un des deux champs (cohérent avec le rafraîchissement FR ci-dessus).
  const upsertTranslation = db.prepare(`
    INSERT INTO campaign_translations (campaign_id, locale, name, description)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(campaign_id, locale) DO UPDATE SET
      name = COALESCE(excluded.name, campaign_translations.name),
      description = COALESCE(excluded.description, campaign_translations.description)
  `)

  const counts = { fr: 0, en: 0, es: 0 }

  const read = (loc: ReputationLocaleData | undefined, factionKey: string, campaignKey: string) => {
    const faction = loc?.[factionKey] as { Campaigns?: Record<string, { Title?: unknown, Desc?: unknown }> } | undefined
    const c = faction?.Campaigns?.[campaignKey]
    const title = typeof c?.Title === 'string' && c.Title.trim() ? c.Title.trim() : null
    const desc = typeof c?.Desc === 'string' && c.Desc.trim() ? c.Desc.trim() : null
    return { title, desc }
  }

  const run = db.transaction(() => {
    for (const c of campaigns) {
      const fr = read(payload.fr, c.factionKey, c.campaignKey)
      if (fr.title || fr.desc) {
        updateFr.run(fr.title, fr.desc, c.id)
        counts.fr++
      }
      const en = read(payload.en, c.factionKey, c.campaignKey)
      if (en.title || en.desc) {
        upsertTranslation.run(c.id, 'en', en.title, en.desc)
        counts.en++
      }
      const es = read(payload.es, c.factionKey, c.campaignKey)
      if (es.title || es.desc) {
        upsertTranslation.run(c.id, 'es', es.title, es.desc)
        counts.es++
      }
    }
  })
  run()

  return counts
}

export function getCampaignsByFaction(factionId: number): CampaignInfo[] {
  const db = getReputationDb()
  return db.prepare(`
    SELECT id, key, name, description, faction_id as factionId
    FROM campaigns
    WHERE faction_id = ?
    ORDER BY sort_order, id
  `).all(factionId) as CampaignInfo[]
}

export function getEmblemsByFaction(factionKey: string): EmblemInfo[] {
  const db = getReputationDb()
  const emblemRows = db.prepare(`
    SELECT
      e.id,
      e.key,
      e.name,
      e.description,
      e.image,
      e.max_grade as maxGrade,
      e.campaign_id as campaignId,
      f.key as factionKey,
      c.name as campaignName,
      (SELECT threshold FROM emblem_grade_thresholds WHERE emblem_id = e.id ORDER BY grade DESC LIMIT 1) as maxThreshold
    FROM emblems e
    JOIN campaigns c ON e.campaign_id = c.id
    JOIN factions f ON c.faction_id = f.id
    WHERE f.key = ? AND e.validated = 1
    ORDER BY c.sort_order, c.id, e.sort_order, e.id
  `).all(factionKey) as Array<Omit<EmblemInfo, 'gradeThresholds'>>

  // Récupérer tous les seuils de grades pour ces emblèmes
  const emblemIds = emblemRows.map(e => e.id)
  const allGradeThresholds = getAllGradeThresholdsForEmblems(emblemIds)

  return emblemRows.map(emblem => ({
    ...emblem,
    gradeThresholds: allGradeThresholds[emblem.id] || []
  }))
}

export function getUserProgressForEmblem(emblemId: number): UserEmblemProgress[] {
  const db = getReputationDb()
  return db.prepare(`
    SELECT
      u.id as userId,
      u.username,
      ue.value,
      ue.threshold,
      ue.grade,
      ue.completed
    FROM user_emblems ue
    JOIN users u ON ue.user_id = u.id
    WHERE ue.emblem_id = ?
    ORDER BY u.username
  `).all(emblemId) as UserEmblemProgress[]
}

export function getFullReputationData() {
  const db = getReputationDb()

  const users = getAllUsers()
  const factions = getAllFactions()

  const result: {
    users: UserInfo[]
    factions: Array<FactionInfo & {
      campaigns: Array<CampaignInfo & {
        emblems: Array<EmblemInfo & {
          userProgress: Record<number, UserEmblemProgress>
        }>
      }>
    }>
  } = {
    users,
    factions: []
  }

  for (const faction of factions) {
    const campaigns = getCampaignsByFaction(faction.id)
    const factionWithCampaigns: typeof result.factions[0] = {
      ...faction,
      campaigns: []
    }

    for (const campaign of campaigns) {
      const emblemRows = db.prepare(`
        SELECT
          e.id, e.key, e.name, e.description, e.image, e.max_grade as maxGrade,
          e.campaign_id as campaignId,
          (SELECT threshold FROM emblem_grade_thresholds WHERE emblem_id = e.id ORDER BY grade DESC LIMIT 1) as maxThreshold
        FROM emblems e
        WHERE e.campaign_id = ? AND e.validated = 1
        ORDER BY e.sort_order, e.id
      `).all(campaign.id) as Array<Omit<EmblemInfo, 'gradeThresholds' | 'factionKey' | 'campaignName'>>

      // Récupérer tous les seuils de grades pour les emblèmes de cette campagne
      const emblemIds = emblemRows.map(e => e.id)
      const allGradeThresholds = getAllGradeThresholdsForEmblems(emblemIds)

      const emblemsWithProgress = emblemRows.map((emblem) => {
        const progress = getUserProgressForEmblem(emblem.id)
        const userProgress: Record<number, UserEmblemProgress> = {}
        for (const p of progress) {
          userProgress[p.userId] = p
        }
        return {
          ...emblem,
          factionKey: faction.key,
          campaignName: campaign.name,
          gradeThresholds: allGradeThresholds[emblem.id] || [],
          userProgress
        }
      })

      factionWithCampaigns.campaigns.push({
        ...campaign,
        emblems: emblemsWithProgress
      })
    }

    result.factions.push(factionWithCampaigns)
  }

  return result
}

// ============ ADMINISTRATION ============

export function isUserAdmin(userId: number): boolean {
  const db = getReputationDb()
  const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as { is_admin: number } | undefined
  return row?.is_admin === 1
}

export function setUserAdmin(userId: number, isAdmin: boolean): void {
  const db = getReputationDb()
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, userId)
}

export function isUserModerator(userId: number): boolean {
  const db = getReputationDb()
  const row = db.prepare('SELECT is_moderator FROM users WHERE id = ?').get(userId) as { is_moderator: number } | undefined
  return row?.is_moderator === 1
}

export function setUserModerator(userId: number, isModerator: boolean): void {
  const db = getReputationDb()
  db.prepare('UPDATE users SET is_moderator = ? WHERE id = ?').run(isModerator ? 1 : 0, userId)
}

export function isUserAdminOrModerator(userId: number): boolean {
  const db = getReputationDb()
  const row = db.prepare('SELECT is_admin, is_moderator FROM users WHERE id = ?').get(userId) as { is_admin: number, is_moderator: number } | undefined
  return row?.is_admin === 1 || row?.is_moderator === 1
}

// ============ GROUPES ============

export interface GroupInfo {
  id: number
  uid: string
  name: string
  createdAt: string
  createdBy: number
}

export type GroupRole = 'chef' | 'moderator' | 'member'

export interface GroupMemberInfo {
  id: number
  groupId: number
  userId: number
  username: string
  role: GroupRole
  joinedAt: string
  lastImportAt: string | null
}

export interface GroupWithRole extends GroupInfo {
  role: GroupRole
}

// Génère un UID court et URL-safe
function generateGroupUid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function createGroup(name: string, createdBy: number): GroupInfo {
  const db = getReputationDb()

  // Générer un UID unique
  let uid = generateGroupUid()
  let attempts = 0
  while (attempts < 10) {
    const existing = db.prepare('SELECT id FROM groups WHERE uid = ?').get(uid)
    if (!existing) break
    uid = generateGroupUid()
    attempts++
  }

  const result = db.prepare(`
    INSERT INTO groups (uid, name, created_by) VALUES (?, ?, ?)
  `).run(uid, name, createdBy)

  // Ajouter le créateur comme chef de groupe
  db.prepare(`
    INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'chef')
  `).run(result.lastInsertRowid, createdBy)

  return {
    id: result.lastInsertRowid as number,
    uid,
    name,
    createdAt: new Date().toISOString(),
    createdBy
  }
}

export function getGroupByUid(uid: string): GroupInfo | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT id, uid, name, created_at as createdAt, created_by as createdBy
    FROM groups WHERE uid = ?
  `).get(uid) as GroupInfo | undefined
  return row || null
}

export function getGroupsByUserId(userId: number): GroupWithRole[] {
  const db = getReputationDb()
  return db.prepare(`
    SELECT g.id, g.uid, g.name, g.created_at as createdAt, g.created_by as createdBy, gm.role
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY g.name
  `).all(userId) as GroupWithRole[]
}

export function getGroupMembers(groupId: number): GroupMemberInfo[] {
  const db = getReputationDb()
  return db.prepare(`
    SELECT gm.id, gm.group_id as groupId, gm.user_id as userId, u.username,
           gm.role, gm.joined_at as joinedAt, u.last_import_at as lastImportAt
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
    ORDER BY
      CASE gm.role
        WHEN 'chef' THEN 1
        WHEN 'moderator' THEN 2
        ELSE 3
      END,
      u.username
  `).all(groupId) as GroupMemberInfo[]
}

export function isGroupMember(groupId: number, userId: number): boolean {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT id FROM group_members WHERE group_id = ? AND user_id = ?
  `).get(groupId, userId)
  return !!row
}

export function isGroupChef(groupId: number, userId: number): boolean {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'chef'
  `).get(groupId, userId)
  return !!row
}

export function isGroupModerator(groupId: number, userId: number): boolean {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND role IN ('chef', 'moderator')
  `).get(groupId, userId)
  return !!row
}

export function getMemberRole(groupId: number, userId: number): GroupRole | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT role FROM group_members WHERE group_id = ? AND user_id = ?
  `).get(groupId, userId) as { role: GroupRole } | undefined
  return row?.role || null
}

export function addGroupMember(groupId: number, userId: number, role: GroupRole = 'member'): void {
  const db = getReputationDb()
  db.prepare(`
    INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)
  `).run(groupId, userId, role)
}

export function removeGroupMember(groupId: number, userId: number): void {
  const db = getReputationDb()
  db.prepare(`
    DELETE FROM group_members WHERE group_id = ? AND user_id = ?
  `).run(groupId, userId)
}

export function setMemberRole(groupId: number, userId: number, role: GroupRole): void {
  const db = getReputationDb()
  db.prepare(`
    UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?
  `).run(role, groupId, userId)
}

export function transferChefRole(groupId: number, currentChefId: number, newChefId: number): void {
  const db = getReputationDb()
  const transaction = db.transaction(() => {
    // L'ancien chef devient modérateur
    db.prepare(`
      UPDATE group_members SET role = 'moderator' WHERE group_id = ? AND user_id = ?
    `).run(groupId, currentChefId)
    // Le nouveau devient chef
    db.prepare(`
      UPDATE group_members SET role = 'chef' WHERE group_id = ? AND user_id = ?
    `).run(groupId, newChefId)
  })
  transaction()
}

export function deleteGroup(groupId: number): void {
  const db = getReputationDb()
  // Les group_members seront supprimés automatiquement grâce à ON DELETE CASCADE
  db.prepare('DELETE FROM groups WHERE id = ?').run(groupId)
}

export function updateGroupName(groupId: number, name: string): void {
  const db = getReputationDb()
  db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(name, groupId)
}

export function getUserByUsername(username: string): UserInfo | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT id, username, last_import_at as lastImportAt FROM users WHERE username = ?
  `).get(username) as UserInfo | undefined
  return row || null
}

export function getUserById(userId: number): UserInfo | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT id, username, last_import_at as lastImportAt FROM users WHERE id = ?
  `).get(userId) as UserInfo | undefined
  return row || null
}

export function deleteUserReputationData(userId: number): void {
  const db = getReputationDb()
  db.prepare('DELETE FROM user_emblems WHERE user_id = ?').run(userId)
  db.prepare('UPDATE users SET last_import_at = NULL WHERE id = ?').run(userId)
}

// Informations sur les groupes dont l'utilisateur est chef
export interface ChefGroupInfo {
  groupId: number
  groupUid: string
  groupName: string
  memberCount: number
  members: Array<{ userId: number, username: string, role: GroupRole }>
}

// Récupère les groupes dont l'utilisateur est chef avec plus d'un membre
export function getChefGroupsWithMembers(userId: number): ChefGroupInfo[] {
  const db = getReputationDb()

  // Récupérer les groupes dont l'utilisateur est chef
  const chefGroups = db.prepare(`
    SELECT g.id as groupId, g.uid as groupUid, g.name as groupName
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ? AND gm.role = 'chef'
  `).all(userId) as Array<{ groupId: number, groupUid: string, groupName: string }>

  return chefGroups.map((group) => {
    const members = db.prepare(`
      SELECT gm.user_id as userId, u.username, gm.role
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ? AND gm.user_id != ?
      ORDER BY
        CASE gm.role
          WHEN 'moderator' THEN 1
          ELSE 2
        END,
        u.username
    `).all(group.groupId, userId) as Array<{ userId: number, username: string, role: GroupRole }>

    return {
      ...group,
      memberCount: members.length + 1, // +1 pour le chef
      members
    }
  }).filter(group => group.members.length > 0) // Seulement les groupes avec d'autres membres
}

// Supprime le compte utilisateur et gère les groupes
export function deleteUserAccount(
  userId: number,
  chefTransfers: Array<{ groupId: number, newChefId: number }>
): void {
  const db = getReputationDb()

  const transaction = db.transaction(() => {
    // 1. Transférer les rôles de chef pour les groupes spécifiés
    for (const transfer of chefTransfers) {
      db.prepare(`
        UPDATE group_members SET role = 'chef' WHERE group_id = ? AND user_id = ?
      `).run(transfer.groupId, transfer.newChefId)
    }

    // 2. Récupérer les groupes où l'utilisateur est le seul membre
    const soloGroups = db.prepare(`
      SELECT g.id
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
      AND (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) = 1
    `).all(userId) as Array<{ id: number }>

    // 3. Supprimer ces groupes (les members seront supprimés en cascade)
    for (const group of soloGroups) {
      db.prepare('DELETE FROM groups WHERE id = ?').run(group.id)
    }

    // 4. Retirer l'utilisateur des groupes restants
    db.prepare('DELETE FROM group_members WHERE user_id = ?').run(userId)

    // 5. Supprimer les invitations en attente liées à cet utilisateur
    db.prepare('DELETE FROM group_pending_invites WHERE user_id = ? OR invited_by = ?').run(userId, userId)

    // 6. Supprimer les données de réputation
    db.prepare('DELETE FROM user_emblems WHERE user_id = ?').run(userId)

    // 7. Supprimer l'utilisateur
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  })

  transaction()
}

// ============ INVITATIONS EN ATTENTE ============

export interface PendingInvite {
  id: number
  groupId: number
  groupUid: string
  groupName: string
  userId: number
  invitedBy: number
  invitedByUsername: string
  createdAt: string
}

export function createPendingInvite(groupId: number, userId: number, invitedBy: number): void {
  const db = getReputationDb()
  db.prepare(`
    INSERT INTO group_pending_invites (group_id, user_id, invited_by)
    VALUES (?, ?, ?)
  `).run(groupId, userId, invitedBy)
}

export function hasPendingInvite(groupId: number, userId: number): boolean {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT id FROM group_pending_invites WHERE group_id = ? AND user_id = ?
  `).get(groupId, userId)
  return !!row
}

export function getPendingInvitesForUser(userId: number): PendingInvite[] {
  const db = getReputationDb()
  return db.prepare(`
    SELECT
      pi.id,
      pi.group_id as groupId,
      g.uid as groupUid,
      g.name as groupName,
      pi.user_id as userId,
      pi.invited_by as invitedBy,
      u.username as invitedByUsername,
      pi.created_at as createdAt
    FROM group_pending_invites pi
    JOIN groups g ON g.id = pi.group_id
    JOIN users u ON u.id = pi.invited_by
    WHERE pi.user_id = ?
    ORDER BY pi.created_at DESC
  `).all(userId) as PendingInvite[]
}

export interface GroupPendingInvite {
  id: number
  username: string
  invitedByUsername: string
  createdAt: string
}

export function getPendingInvitesForGroup(groupId: number): GroupPendingInvite[] {
  const db = getReputationDb()
  return db.prepare(`
    SELECT
      pi.id,
      invited.username as username,
      inviter.username as invitedByUsername,
      pi.created_at as createdAt
    FROM group_pending_invites pi
    JOIN users invited ON invited.id = pi.user_id
    JOIN users inviter ON inviter.id = pi.invited_by
    WHERE pi.group_id = ?
    ORDER BY pi.created_at DESC
  `).all(groupId) as GroupPendingInvite[]
}

export function getPendingInvite(id: number): PendingInvite | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT
      pi.id,
      pi.group_id as groupId,
      g.uid as groupUid,
      g.name as groupName,
      pi.user_id as userId,
      pi.invited_by as invitedBy,
      u.username as invitedByUsername,
      pi.created_at as createdAt
    FROM group_pending_invites pi
    JOIN groups g ON g.id = pi.group_id
    JOIN users u ON u.id = pi.invited_by
    WHERE pi.id = ?
  `).get(id) as PendingInvite | undefined
  return row || null
}

export function deletePendingInvite(id: number): void {
  const db = getReputationDb()
  db.prepare('DELETE FROM group_pending_invites WHERE id = ?').run(id)
}

export function acceptPendingInvite(inviteId: number): void {
  const db = getReputationDb()
  const invite = getPendingInvite(inviteId)
  if (!invite) return

  const transaction = db.transaction(() => {
    // Ajouter comme membre
    addGroupMember(invite.groupId, invite.userId, 'member')
    // Supprimer l'invitation
    deletePendingInvite(inviteId)
  })
  transaction()
}

// Récupère les réputations pour un groupe (seulement les membres du groupe)
export function getGroupReputationData(groupId: number) {
  const db = getReputationDb()

  // Récupérer les membres du groupe
  const members = getGroupMembers(groupId)
  const memberUserIds = members.map(m => m.userId)

  if (memberUserIds.length === 0) {
    return { users: [], factions: [] }
  }

  const users: UserInfo[] = members.map(m => ({
    id: m.userId,
    username: m.username,
    lastImportAt: m.lastImportAt
  }))

  const factions = getAllFactions()
  const factionTranslations = getAllFactionTranslations()
  const campaignTranslations = getAllCampaignTranslations()

  // Récupérer toutes les traductions d'emblèmes
  const allTranslations = db.prepare(`
    SELECT emblem_id, locale, name, description FROM emblem_translations
  `).all() as Array<{ emblem_id: number, locale: string, name: string | null, description: string | null }>

  // Indexer par emblem_id
  const translationsByEmblem: Record<number, Record<string, { name: string | null, description: string | null }>> = {}
  for (const t of allTranslations) {
    if (!translationsByEmblem[t.emblem_id]) {
      translationsByEmblem[t.emblem_id] = {}
    }
    translationsByEmblem[t.emblem_id][t.locale] = { name: t.name, description: t.description }
  }

  const result: {
    users: UserInfo[]
    factions: Array<FactionInfo & {
      translations: Record<string, FactionTranslation>
      campaigns: Array<CampaignInfo & {
        translations: Record<string, CampaignTranslation>
        emblems: Array<EmblemInfo & {
          userProgress: Record<number, UserEmblemProgress>
          translations: Record<string, { name: string | null, description: string | null }>
        }>
      }>
    }>
  } = {
    users,
    factions: []
  }

  // Créer le placeholder pour les IDs
  const placeholders = memberUserIds.map(() => '?').join(',')

  for (const faction of factions) {
    const campaigns = getCampaignsByFaction(faction.id)
    const factionWithCampaigns: typeof result.factions[0] = {
      ...faction,
      translations: factionTranslations[faction.id] || {},
      campaigns: []
    }

    for (const campaign of campaigns) {
      const emblemRows = db.prepare(`
        SELECT
          e.id, e.key, e.name, e.description, e.image, e.max_grade as maxGrade,
          e.campaign_id as campaignId,
          (SELECT threshold FROM emblem_grade_thresholds WHERE emblem_id = e.id ORDER BY grade DESC LIMIT 1) as maxThreshold
        FROM emblems e
        WHERE e.campaign_id = ? AND e.validated = 1
        ORDER BY e.sort_order, e.id
      `).all(campaign.id) as Array<Omit<EmblemInfo, 'gradeThresholds' | 'factionKey' | 'campaignName'>>

      // Récupérer tous les seuils de grades pour les emblèmes de cette campagne
      const emblemIds = emblemRows.map(e => e.id)
      const allGradeThresholds = getAllGradeThresholdsForEmblems(emblemIds)

      const emblemsWithProgress = emblemRows.map((emblem) => {
        // Ne récupérer que la progression des membres du groupe
        const progress = db.prepare(`
          SELECT
            u.id as userId,
            u.username,
            ue.value,
            ue.threshold,
            ue.grade,
            ue.completed
          FROM user_emblems ue
          JOIN users u ON ue.user_id = u.id
          WHERE ue.emblem_id = ? AND u.id IN (${placeholders})
          ORDER BY u.username
        `).all(emblem.id, ...memberUserIds) as UserEmblemProgress[]

        const userProgress: Record<number, UserEmblemProgress> = {}
        for (const p of progress) {
          userProgress[p.userId] = p
        }
        return {
          ...emblem,
          factionKey: faction.key,
          campaignName: campaign.name,
          gradeThresholds: allGradeThresholds[emblem.id] || [],
          userProgress,
          translations: translationsByEmblem[emblem.id] || {}
        }
      })

      factionWithCampaigns.campaigns.push({
        ...campaign,
        translations: campaignTranslations[campaign.id] || {},
        emblems: emblemsWithProgress
      })
    }

    result.factions.push(factionWithCampaigns)
  }

  return result
}

// ============ INVITATIONS ============

export interface GroupInvite {
  id: number
  groupId: number
  code: string
  createdBy: number
  createdAt: string
  expiresAt: string | null
  maxUses: number | null
  usesCount: number
}

// Génère un code d'invitation unique
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function createGroupInvite(groupId: number, createdBy: number, expiresAt?: Date, maxUses?: number): GroupInvite {
  const db = getReputationDb()

  // Générer un code unique
  let code = generateInviteCode()
  let attempts = 0
  while (attempts < 10) {
    const existing = db.prepare('SELECT id FROM group_invites WHERE code = ?').get(code)
    if (!existing) break
    code = generateInviteCode()
    attempts++
  }

  const result = db.prepare(`
    INSERT INTO group_invites (group_id, code, created_by, expires_at, max_uses)
    VALUES (?, ?, ?, ?, ?)
  `).run(groupId, code, createdBy, expiresAt?.toISOString() || null, maxUses || null)

  return {
    id: result.lastInsertRowid as number,
    groupId,
    code,
    createdBy,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt?.toISOString() || null,
    maxUses: maxUses || null,
    usesCount: 0
  }
}

export function getGroupInvite(groupId: number): GroupInvite | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT id, group_id as groupId, code, created_by as createdBy,
           created_at as createdAt, expires_at as expiresAt,
           max_uses as maxUses, uses_count as usesCount
    FROM group_invites
    WHERE group_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(groupId) as GroupInvite | undefined
  return row || null
}

export function getInviteByCode(code: string): (GroupInvite & { groupName: string, groupUid: string }) | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT gi.id, gi.group_id as groupId, gi.code, gi.created_by as createdBy,
           gi.created_at as createdAt, gi.expires_at as expiresAt,
           gi.max_uses as maxUses, gi.uses_count as usesCount,
           g.name as groupName, g.uid as groupUid
    FROM group_invites gi
    JOIN groups g ON gi.group_id = g.id
    WHERE gi.code = ?
  `).get(code) as (GroupInvite & { groupName: string, groupUid: string }) | undefined
  return row || null
}

export function isInviteValid(invite: GroupInvite): boolean {
  // Vérifier l'expiration
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return false
  }
  // Vérifier le nombre d'utilisations
  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
    return false
  }
  return true
}

export function useInvite(inviteId: number): void {
  const db = getReputationDb()
  db.prepare(`
    UPDATE group_invites SET uses_count = uses_count + 1 WHERE id = ?
  `).run(inviteId)
}

export function deleteGroupInvite(groupId: number): void {
  const db = getReputationDb()
  db.prepare('DELETE FROM group_invites WHERE group_id = ?').run(groupId)
}

// ============ GRADE THRESHOLDS ============

export interface EmblemGradeThreshold {
  emblemId: number
  grade: number
  threshold: number
}

/**
 * Enregistre ou met a jour le seuil d'un grade pour un embleme
 */
export function upsertEmblemGradeThreshold(emblemId: number, grade: number, threshold: number): void {
  if (grade <= 0 || threshold <= 0) return // Ignorer les valeurs invalides

  const db = getReputationDb()
  db.prepare(`
    INSERT INTO emblem_grade_thresholds (emblem_id, grade, threshold)
    VALUES (?, ?, ?)
    ON CONFLICT(emblem_id, grade) DO UPDATE SET
      threshold = excluded.threshold
  `).run(emblemId, grade, threshold)
}

/**
 * Recupere tous les seuils de grades connus pour un embleme
 */
export function getEmblemGradeThresholds(emblemId: number): EmblemGradeThreshold[] {
  const db = getReputationDb()
  return db.prepare(`
    SELECT emblem_id as emblemId, grade, threshold
    FROM emblem_grade_thresholds
    WHERE emblem_id = ?
    ORDER BY grade
  `).all(emblemId) as EmblemGradeThreshold[]
}

/**
 * Recupere le seuil du grade maximum connu pour un embleme
 */
export function getMaxKnownThreshold(emblemId: number): number | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT threshold
    FROM emblem_grade_thresholds
    WHERE emblem_id = ?
    ORDER BY grade DESC
    LIMIT 1
  `).get(emblemId) as { threshold: number } | undefined
  return row?.threshold || null
}

/**
 * Recupere les seuils max connus pour plusieurs emblemes
 */
export function getMaxKnownThresholds(emblemIds: number[]): Record<number, number> {
  if (emblemIds.length === 0) return {}

  const db = getReputationDb()
  const placeholders = emblemIds.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT emblem_id as emblemId, MAX(threshold) as maxThreshold
    FROM emblem_grade_thresholds
    WHERE emblem_id IN (${placeholders})
    GROUP BY emblem_id
  `).all(...emblemIds) as Array<{ emblemId: number, maxThreshold: number }>

  const result: Record<number, number> = {}
  for (const row of rows) {
    result[row.emblemId] = row.maxThreshold
  }
  return result
}

/**
 * Recupere tous les seuils de grades pour plusieurs emblemes
 */
export function getAllGradeThresholdsForEmblems(emblemIds: number[]): Record<number, GradeThreshold[]> {
  if (emblemIds.length === 0) return {}

  const db = getReputationDb()
  const placeholders = emblemIds.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT emblem_id as emblemId, grade, threshold
    FROM emblem_grade_thresholds
    WHERE emblem_id IN (${placeholders})
    ORDER BY emblem_id, grade
  `).all(...emblemIds) as Array<{ emblemId: number, grade: number, threshold: number }>

  const result: Record<number, GradeThreshold[]> = {}
  for (const row of rows) {
    if (!result[row.emblemId]) {
      result[row.emblemId] = []
    }
    result[row.emblemId].push({ grade: row.grade, threshold: row.threshold })
  }
  return result
}
