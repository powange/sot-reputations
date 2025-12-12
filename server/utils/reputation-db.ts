import { join } from 'path'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

export function getReputationDb(): Database.Database {
  if (db) return db

  const dbPath = join(process.cwd(), 'data', 'reputation.db')
  db = new Database(dbPath)

  // Créer les tables si elles n'existent pas
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_import_at DATETIME
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
  `)

  // Migration: ajouter last_import_at si la colonne n'existe pas
  const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>
  const hasLastImportAt = userColumns.some(col => col.name === 'last_import_at')
  if (!hasLastImportAt) {
    db.exec('ALTER TABLE users ADD COLUMN last_import_at DATETIME')
  }

  // Migration: ajouter sort_order aux campagnes si la colonne n'existe pas
  const campaignColumns = db.prepare("PRAGMA table_info(campaigns)").all() as Array<{ name: string }>
  const hasSortOrder = campaignColumns.some(col => col.name === 'sort_order')
  if (!hasSortOrder) {
    db.exec('ALTER TABLE campaigns ADD COLUMN sort_order INTEGER DEFAULT 0')
  }

  // Migration: ajouter sort_order aux emblèmes si la colonne n'existe pas
  const emblemColumns = db.prepare("PRAGMA table_info(emblems)").all() as Array<{ name: string }>
  const hasEmblemSortOrder = emblemColumns.some(col => col.name === 'sort_order')
  if (!hasEmblemSortOrder) {
    db.exec('ALTER TABLE emblems ADD COLUMN sort_order INTEGER DEFAULT 0')
  }

  // Migration: ajouter description aux campagnes si la colonne n'existe pas
  const campaignColumnsForDesc = db.prepare("PRAGMA table_info(campaigns)").all() as Array<{ name: string }>
  const hasCampaignDesc = campaignColumnsForDesc.some(col => col.name === 'description')
  if (!hasCampaignDesc) {
    db.exec('ALTER TABLE campaigns ADD COLUMN description TEXT')
  }

  return db
}

// Noms des factions en français (seules ces factions seront importées)
const FACTION_NAMES: Record<string, string> = {
  AthenasFortune: "Fortune d'Athéna",
  ReapersBones: 'Os de la faucheuse',
  HuntersCall: "L'appel du chasseur",
  GoldHoarders: "Collectionneurs d'or",
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
  DisplayName?: string
  '#Name'?: string
  Description?: string
  Image?: string
  image?: string
  MaxGrade?: number
  Value?: number
  Threshold?: number
  Grade?: number
  Completed?: boolean
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

  const insertFaction = db.prepare(`
    INSERT OR IGNORE INTO factions (key, name, motto) VALUES (?, ?, ?)
  `)

  const getFactionId = db.prepare(`SELECT id FROM factions WHERE key = ?`)

  const insertCampaign = db.prepare(`
    INSERT INTO campaigns (faction_id, key, name, description, sort_order) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(faction_id, key) DO UPDATE SET
      description = COALESCE(excluded.description, campaigns.description),
      sort_order = excluded.sort_order
  `)

  const getCampaignId = db.prepare(`
    SELECT id FROM campaigns WHERE faction_id = ? AND key = ?
  `)

  const insertEmblem = db.prepare(`
    INSERT INTO emblems (campaign_id, key, name, description, image, max_grade, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, key) DO UPDATE SET
      image = COALESCE(excluded.image, emblems.image),
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

  const updateLastImport = db.prepare(`
    UPDATE users SET last_import_at = CURRENT_TIMESTAMP WHERE id = ?
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
              upsertUserEmblem.run(
                userId,
                emblemRow.id,
                emblem.Value || 0,
                emblem.Threshold || 0,
                emblem.Grade || 0,
                emblem.Completed ? 1 : 0
              )
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
          upsertUserEmblem.run(
            userId,
            emblemRow.id,
            emblem.Value || 0,
            emblem.Threshold || 0,
            emblem.Grade || 0,
            emblem.Completed ? 1 : 0
          )
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

export interface EmblemInfo {
  id: number
  key: string
  name: string
  description: string
  image: string
  maxGrade: number
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
  return db.prepare(`
    SELECT
      e.id,
      e.key,
      e.name,
      e.description,
      e.image,
      e.max_grade as maxGrade,
      e.campaign_id as campaignId,
      f.key as factionKey,
      c.name as campaignName
    FROM emblems e
    JOIN campaigns c ON e.campaign_id = c.id
    JOIN factions f ON c.faction_id = f.id
    WHERE f.key = ?
    ORDER BY c.sort_order, c.id, e.sort_order, e.id
  `).all(factionKey) as EmblemInfo[]
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
      const emblems = db.prepare(`
        SELECT
          id, key, name, description, image, max_grade as maxGrade, campaign_id as campaignId
        FROM emblems
        WHERE campaign_id = ?
        ORDER BY sort_order, id
      `).all(campaign.id) as EmblemInfo[]

      const emblemsWithProgress = emblems.map((emblem) => {
        const progress = getUserProgressForEmblem(emblem.id)
        const userProgress: Record<number, UserEmblemProgress> = {}
        for (const p of progress) {
          userProgress[p.userId] = p
        }
        return { ...emblem, factionKey: faction.key, campaignName: campaign.name, userProgress }
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
