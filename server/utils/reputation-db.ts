import { join } from 'path'
import Database from 'better-sqlite3'
import { normalizeName, type WikiPrereqs } from './sot-wiki'

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
      high_seas_only INTEGER DEFAULT 0,
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

    -- Niveau de réputation par faction et par utilisateur (capté à l'import ;
    -- sert à juger les prérequis « niveau de faction » des objets du coffre).
    CREATE TABLE IF NOT EXISTS user_faction_levels (
      user_id INTEGER NOT NULL,
      faction_key TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      distinction_level INTEGER NOT NULL DEFAULT 0,
      progress REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, faction_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

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

    -- Catalogue partagé des items du coffre (cosmétiques/équipements du jeu).
    -- sort_order conserve l'ordre d'import (intercalation des nouveaux items).
    -- uid = #Name du jeu (par exemplaire/joueur, conservé à titre informatif).
    -- item_key = identité stable de l'item, partagée entre joueurs (nom de
    -- fichier de l'image) ; c'est la clé d'unicité du catalogue.
    CREATE TABLE IF NOT EXISTS chest_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE NOT NULL,
      item_key TEXT,
      category TEXT NOT NULL,
      subcategory TEXT,
      name TEXT NOT NULL DEFAULT '',
      description TEXT,
      image TEXT,
      sort_order REAL NOT NULL DEFAULT 0,
      dominant_colors TEXT,
      colors TEXT
    );

    -- Possession des items du coffre par utilisateur
    CREATE TABLE IF NOT EXISTS user_chest_items (
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES chest_items(id) ON DELETE CASCADE
    );

    -- Traductions (FR/EN/ES) des libellés de catégories et sous-catégories du coffre.
    -- subcategory = '' pour la traduction de la catégorie elle-même.
    CREATE TABLE IF NOT EXISTS chest_taxonomy_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL DEFAULT '',
      locale TEXT NOT NULL,
      name TEXT,
      UNIQUE(category, subcategory, locale)
    );

    -- Traductions (EN/ES) des noms d'items du coffre, captées à l'import multi-langue.
    -- Le nom FR reste la langue de base dans chest_items.name ; cette table ne porte
    -- que EN/ES. Clé = item_key (identité stable partagée entre joueurs), donc une
    -- traduction profite à tous les possesseurs de l'item.
    CREATE TABLE IF NOT EXISTS chest_item_translations (
      item_key TEXT NOT NULL,
      locale TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      PRIMARY KEY (item_key, locale)
    );

    -- Signature de couleurs decor d'un scope (categorie::sous-categorie) : les bacs
    -- couleur presents sur ~toutes les images du scope = elements communs (coque de
    -- bateau pour les figures de proue) a exclure de l'extraction. bins = JSON de cles
    -- de bacs quantifies (4 bits/canal).
    CREATE TABLE IF NOT EXISTS chest_color_signatures (
      scope TEXT PRIMARY KEY,
      bins TEXT NOT NULL,
      sample_count INTEGER NOT NULL DEFAULT 0,
      built_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Surcharge du nom de Category: du wiki pour une sous-categorie, quand il differe
    -- de la sous-categorie elle-meme (memorise par l'admin sur la page des couts).
    -- subcategory = '' pour une categorie sans sous-categorie.
    CREATE TABLE IF NOT EXISTS chest_cost_wiki_map (
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL DEFAULT '',
      wiki_category TEXT NOT NULL,
      PRIMARY KEY (category, subcategory)
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
    CREATE INDEX IF NOT EXISTS idx_chest_items_category ON chest_items(category);
    CREATE INDEX IF NOT EXISTS idx_user_chest_items_user ON user_chest_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_chest_taxonomy_category ON chest_taxonomy_translations(category);
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

  // Migration: ajouter description aux traductions d'items du coffre (EN/ES)
  const chestTransCols = db.prepare('PRAGMA table_info(chest_item_translations)').all() as Array<{ name: string }>
  const hasChestTransDesc = chestTransCols.some(col => col.name === 'description')
  if (!hasChestTransDesc) {
    db.exec('ALTER TABLE chest_item_translations ADD COLUMN description TEXT')
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

  // Migration: ajouter high_seas_only aux emblèmes (commendations jouables uniquement
  // en Haute Mer / High Seas, d'après le wiki). Rempli par la synchro admin dédiée.
  const emblemColumnsForHighSeas = db.prepare('PRAGMA table_info(emblems)').all() as Array<{ name: string }>
  if (!emblemColumnsForHighSeas.some(col => col.name === 'high_seas_only')) {
    db.exec('ALTER TABLE emblems ADD COLUMN high_seas_only INTEGER DEFAULT 0')
  }

  // Migration: ajouter distinction_level et progress à user_faction_levels
  // (captés à l'import, en plus du Level cumulé : niveau de distinction et
  // progression fractionnaire vers le niveau suivant).
  const factionLevelCols = db.prepare('PRAGMA table_info(user_faction_levels)').all() as Array<{ name: string }>
  if (!factionLevelCols.some(col => col.name === 'distinction_level')) {
    db.exec('ALTER TABLE user_faction_levels ADD COLUMN distinction_level INTEGER NOT NULL DEFAULT 0')
  }
  if (!factionLevelCols.some(col => col.name === 'progress')) {
    db.exec('ALTER TABLE user_faction_levels ADD COLUMN progress REAL NOT NULL DEFAULT 0')
  }

  // Migration: convertir les rôles 'admin' en 'chef' pour le nouveau système de grades
  const hasAdminRole = db.prepare(`
    SELECT id FROM group_members WHERE role = 'admin' LIMIT 1
  `).get()
  if (hasAdminRole) {
    db.exec(`UPDATE group_members SET role = 'chef' WHERE role = 'admin'`)
  }

  // Migration: item_key (identité stable d'item du coffre) + dédoublonnage.
  // Avant, l'unicité reposait sur uid (#Name = par joueur) → doublons entre
  // utilisateurs. On ré-indexe sur item_key (GUID du fichier image).
  const chestItemCols = db.prepare('PRAGMA table_info(chest_items)').all() as Array<{ name: string }>
  if (!chestItemCols.some(col => col.name === 'item_key')) {
    db.exec('ALTER TABLE chest_items ADD COLUMN item_key TEXT')
  }
  // Backfill des clés manquantes + dédoublonnage dans UNE transaction, de façon
  // idempotente : le dédoublonnage tourne à chaque démarrage (no-op s'il n'y a
  // aucun doublon) pour garantir que l'index unique ci-dessous ne puisse jamais
  // échouer, même après un crash entre backfill et dédoublonnage.
  const cdb = db // non-null ici ; évite que la closure ré-élargisse `db` à `| null`
  const setChestKey = cdb.prepare('UPDATE chest_items SET item_key = ? WHERE id = ?')
  const migrateChestKeys = cdb.transaction(() => {
    const toBackfill = cdb.prepare(
      `SELECT id, uid, image FROM chest_items WHERE item_key IS NULL OR item_key = ''`
    ).all() as Array<{ id: number, uid: string, image: string | null }>
    for (const r of toBackfill) setChestKey.run(chestItemKey(r.image, r.uid), r.id)
    dedupeChestItemsByKey(cdb)
  })
  migrateChestKeys()
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_chest_items_item_key ON chest_items(item_key)')

  // Migration: couleurs des items du coffre (RGB dominants bruts + couleurs nommées)
  const chestColorCols = db.prepare('PRAGMA table_info(chest_items)').all() as Array<{ name: string }>
  if (!chestColorCols.some(col => col.name === 'dominant_colors')) {
    db.exec('ALTER TABLE chest_items ADD COLUMN dominant_colors TEXT')
  }
  if (!chestColorCols.some(col => col.name === 'colors')) {
    db.exec('ALTER TABLE chest_items ADD COLUMN colors TEXT')
  }
  // Flag « couleurs éditées à la main » : ces items sont protégés des ré-analyses /
  // re-classements en masse (pour ne pas écraser les corrections de l'admin).
  if (!chestColorCols.some(col => col.name === 'colors_manual')) {
    db.exec('ALTER TABLE chest_items ADD COLUMN colors_manual INTEGER DEFAULT 0')
  }

  // Migration: coût d'achat de l'item (récupéré depuis le wiki Sea of Thieves).
  // JSON { gold?, doubloons?, ancientCoins? } ; NULL si l'item n'est pas achetable
  // (item par défaut, événement, récompense…).
  if (!chestColorCols.some(col => col.name === 'cost')) {
    db.exec('ALTER TABLE chest_items ADD COLUMN cost TEXT')
  }

  // Migration: prérequis d'obtention (récupérés du wiki). JSON
  // { commendations?, factionLevels?, legendary?, requires? } ; NULL si aucun.
  if (!chestColorCols.some(col => col.name === 'prerequisites')) {
    db.exec('ALTER TABLE chest_items ADD COLUMN prerequisites TEXT')
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
  Level?: number
  DistinctionLevel?: number
  Progress?: number
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

  const upsertUserFactionLevel = db.prepare(`
    INSERT INTO user_faction_levels (user_id, faction_key, level, distinction_level, progress)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, faction_key) DO UPDATE SET
      level = excluded.level,
      distinction_level = excluded.distinction_level,
      progress = excluded.progress
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

      // Niveau de réputation de la faction (pour l'éligibilité des objets du coffre).
      // On capte aussi le niveau de distinction et la progression fractionnaire
      // quand ils sont présents dans le JSON officiel.
      if (typeof factionData.Level === 'number') {
        upsertUserFactionLevel.run(
          userId,
          factionKey,
          factionData.Level,
          typeof factionData.DistinctionLevel === 'number' ? factionData.DistinctionLevel : 0,
          typeof factionData.Progress === 'number' ? factionData.Progress : 0
        )
      }

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
  // Commendation jouable uniquement en Haute Mer (High Seas), d'après le wiki.
  highSeasOnly: boolean
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

// ============ COFFRE (CHEST) ============

// Ordre d'affichage des catégories (ordre du jeu) ; les catégories inconnues
// sont ajoutées à la fin par ordre alphabétique.
const CHEST_CATEGORY_ORDER = [
  'Ship', 'Vanity', 'Equipment', 'Armory', 'Clothing', 'ShipDecoration', 'Pets', 'ShipTrinket', 'Bones'
]

// Rang d'affichage d'une catégorie (ordre du jeu) ; inconnues en dernier.
function chestCategoryRank(cat: string): number {
  const i = CHEST_CATEGORY_ORDER.indexOf(cat)
  return i === -1 ? CHEST_CATEGORY_ORDER.length : i
}

// Tri partagé des items du coffre : catégorie (ordre du jeu) puis ordre d'import,
// avec un départage stable sur l'uid (les sort_order peuvent coïncider après
// intercalation). Utilisé par le catalogue utilisateur et le catalogue agent.
function compareChestRows(
  a: { category: string, sortOrder: number, uid: string },
  b: { category: string, sortOrder: number, uid: string }
): number {
  const ra = chestCategoryRank(a.category)
  const rb = chestCategoryRank(b.category)
  if (ra !== rb) return ra - rb
  if (a.category !== b.category) return a.category.localeCompare(b.category)
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.uid.localeCompare(b.uid)
}

export interface ChestItem {
  id: number
  uid: string
  category: string
  subcategory: string | null
  name: string
  description: string | null
  image: string | null
  owned: boolean
  // Couleurs principales nommées (palette), pour le filtre couleur.
  colors: string[]
  // Coût d'achat (récupéré du wiki) ; null si non achetable / non renseigné.
  cost: ChestItemCost | null
  // Prérequis d'obtention (récupérés du wiki) ; null si aucun / non renseigné.
  prerequisites: ChestItemPrereqs | null
  // Éligibilité calculée vs la progression commendations de l'utilisateur.
  // null = aucun prérequis. status: 'met' (débloquable), 'locked' (commendation
  // manquante connue), 'unknown' (prérequis non entièrement vérifiables).
  eligibility: ChestItemEligibility | null
  // Co-membres qui possèdent aussi cet item, regroupés par groupe partagé.
  groupOwners: Array<{ group: string, members: string[] }>
}

export interface ChestItemEligibility {
  status: 'met' | 'locked' | 'unknown'
  commendations: Array<{ name: string, requiredGrade: number, userGrade: number | null, met: boolean, maxGrade: number | null, emblemId: number | null }>
  factions: Array<{ key: string, requiredLevel: number, userLevel: number | null, met: boolean }>
}

interface ParsedChestItem {
  uid: string
  itemKey: string
  subcategory: string | null
  name: string
  description: string | null
  image: string | null
}

// Identité stable d'un item, partagée entre joueurs : le nom de fichier de
// l'image (GUID de l'asset), insensible au préfixe de version de l'URL.
// Repli sur l'uid (#Name) si l'item n'a pas d'image.
function chestItemKey(image: string | null, uid: string): string {
  if (image) {
    const base = image.split('/').pop()
    if (base) return base
  }
  return uid
}

// Fusionne les lignes de chest_items partageant le même item_key (doublons
// hérités de l'ancienne clé uid) : on garde la plus ancienne, on réaiguille la
// possession dessus (en évitant les conflits de PK), et on supprime les doublons.
function dedupeChestItemsByKey(db: Database.Database): void {
  const groups = db.prepare(`
    SELECT item_key as key, MIN(id) as keepId
    FROM chest_items
    WHERE item_key IS NOT NULL
    GROUP BY item_key
    HAVING COUNT(*) > 1
  `).all() as Array<{ key: string, keepId: number }>
  if (groups.length === 0) return

  const getDups = db.prepare('SELECT id FROM chest_items WHERE item_key = ? AND id != ?')
  const remapOwnership = db.prepare('UPDATE OR IGNORE user_chest_items SET item_id = ? WHERE item_id = ?')
  const deleteOwnership = db.prepare('DELETE FROM user_chest_items WHERE item_id = ?')
  const deleteItem = db.prepare('DELETE FROM chest_items WHERE id = ?')

  const tx = db.transaction(() => {
    for (const g of groups) {
      for (const dup of getDups.all(g.key, g.keepId) as Array<{ id: number }>) {
        remapOwnership.run(g.keepId, dup.id)
        deleteOwnership.run(dup.id)
        deleteItem.run(dup.id)
      }
    }
  })
  tx()
}

export interface DuplicateChestItemGroup {
  name: string
  category: string
  subcategory: string | null
  items: Array<{ id: number, image: string | null, itemKey: string, owners: number, hasCost: boolean, hasPrereqs: boolean }>
}

/**
 * Doublons « résiduels » du catalogue : lignes de même nom (non vide) + catégorie +
 * sous-catégorie mais d'item_key DIFFÉRENT (donc non fusionnées par la dédup auto par
 * clé). Apparaissent quand un item est ré-importé avec une image variable ou sans
 * image (clé = #Name, par joueur). Aperçu admin avant fusion.
 */
export function findDuplicateChestItemGroups(): DuplicateChestItemGroup[] {
  const db = getReputationDb()
  const groups = db.prepare(`
    SELECT lower(trim(name)) as nname, category, subcategory
    FROM chest_items
    WHERE name IS NOT NULL AND trim(name) != ''
    GROUP BY lower(trim(name)), category, COALESCE(subcategory, '')
    HAVING COUNT(*) > 1
  `).all() as Array<{ nname: string, category: string, subcategory: string | null }>

  const getRows = db.prepare(`
    SELECT id, name, image, item_key as itemKey, cost, prerequisites,
      (SELECT COUNT(*) FROM user_chest_items uci WHERE uci.item_id = chest_items.id) as owners
    FROM chest_items
    WHERE lower(trim(name)) = ? AND category = ? AND COALESCE(subcategory, '') = COALESCE(?, '')
    ORDER BY id
  `)

  return groups.map((g) => {
    const rows = getRows.all(g.nname, g.category, g.subcategory) as Array<{ id: number, name: string, image: string | null, itemKey: string, cost: string | null, prerequisites: string | null, owners: number }>
    return {
      name: rows[0]?.name ?? g.nname,
      category: g.category,
      subcategory: g.subcategory,
      items: rows.map(r => ({ id: r.id, image: r.image, itemKey: r.itemKey, owners: r.owners, hasCost: !!r.cost, hasPrereqs: !!r.prerequisites }))
    }
  })
}

/**
 * Fusionne les doublons résiduels (cf. findDuplicateChestItemGroups) : garde la ligne
 * la plus ancienne (MIN id), comble ses champs manquants (coût, prérequis, image,
 * couleurs) depuis les doublons, réaiguille la possession (user_chest_items) et les
 * traductions (chest_item_translations, par item_key), puis supprime les doublons.
 */
export function mergeDuplicateChestItemGroups(): { groups: number, deleted: number } {
  const db = getReputationDb()
  const groups = db.prepare(`
    SELECT lower(trim(name)) as nname, category, subcategory, MIN(id) as keepId
    FROM chest_items
    WHERE name IS NOT NULL AND trim(name) != ''
    GROUP BY lower(trim(name)), category, COALESCE(subcategory, '')
    HAVING COUNT(*) > 1
  `).all() as Array<{ nname: string, category: string, subcategory: string | null, keepId: number }>
  if (groups.length === 0) return { groups: 0, deleted: 0 }

  type Row = { id: number, itemKey: string, image: string | null, cost: string | null, prerequisites: string | null, colors: string | null, colorsManual: number | null }
  const getKeep = db.prepare('SELECT id, item_key as itemKey, image, cost, prerequisites, colors, colors_manual as colorsManual FROM chest_items WHERE id = ?')
  const getDups = db.prepare(`
    SELECT id, item_key as itemKey, image, cost, prerequisites, colors, colors_manual as colorsManual
    FROM chest_items
    WHERE lower(trim(name)) = ? AND category = ? AND COALESCE(subcategory, '') = COALESCE(?, '') AND id != ?
    ORDER BY id
  `)
  const updateKeep = db.prepare('UPDATE chest_items SET cost = ?, prerequisites = ?, image = ?, colors = ?, colors_manual = ? WHERE id = ?')
  const remapOwnership = db.prepare('UPDATE OR IGNORE user_chest_items SET item_id = ? WHERE item_id = ?')
  const delOwnership = db.prepare('DELETE FROM user_chest_items WHERE item_id = ?')
  const remapTranslations = db.prepare('UPDATE OR IGNORE chest_item_translations SET item_key = ? WHERE item_key = ?')
  const delTranslations = db.prepare('DELETE FROM chest_item_translations WHERE item_key = ?')
  const delItem = db.prepare('DELETE FROM chest_items WHERE id = ?')

  let deleted = 0
  const tx = db.transaction(() => {
    for (const g of groups) {
      const keep = getKeep.get(g.keepId) as Row | undefined
      if (!keep) continue
      const dups = getDups.all(g.nname, g.category, g.subcategory, g.keepId) as Row[]

      // Comble les champs vides du keep avec le 1er doublon qui les porte.
      let cost = keep.cost, prereqs = keep.prerequisites, image = keep.image, colors = keep.colors
      let manual = keep.colorsManual ?? 0
      for (const d of dups) {
        if (!cost && d.cost) cost = d.cost
        if (!prereqs && d.prerequisites) prereqs = d.prerequisites
        if ((!image || image === '') && d.image) image = d.image
        if (!colors && d.colors) colors = d.colors
        if (d.colorsManual) manual = 1
      }
      updateKeep.run(cost, prereqs, image, colors, manual, g.keepId)

      for (const d of dups) {
        remapOwnership.run(g.keepId, d.id)
        delOwnership.run(d.id)
        if (d.itemKey !== keep.itemKey) {
          remapTranslations.run(keep.itemKey, d.itemKey)
          delTranslations.run(d.itemKey)
        }
        delItem.run(d.id)
        deleted++
      }
    }
  })
  tx()
  invalidatePrereqIndex()
  return { groups: groups.length, deleted }
}

function parseChestItem(raw: unknown): ParsedChestItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const uid = typeof o['#Name'] === 'string' ? o['#Name'] : null
  if (!uid) return null
  const tags = (o.Taxonomy as { Tags?: Array<{ '#Value'?: unknown }> } | undefined)?.Tags
  const subRaw = tags?.[0]?.['#Value']
  const image = typeof o.image === 'string' ? o.image : null
  return {
    uid,
    itemKey: chestItemKey(image, uid),
    subcategory: typeof subRaw === 'string' ? subRaw : null,
    name: typeof o.title === 'string' ? o.title : '',
    description: typeof o.subtitle === 'string' ? o.subtitle : null,
    image
  }
}

interface ChestTranslationValue { name: string, description: string | null }

/**
 * Extrait les traductions d'items (itemKey -> { name, description }) d'un payload de
 * coffre dans une langue donnée, pour alimenter chest_item_translations. L'itemKey est
 * indépendant de la langue (nom de fichier image), donc il sert de pont entre les
 * exports FR/EN/ES.
 */
function parseChestTranslations(chestData: unknown): Map<string, ChestTranslationValue> {
  const out = new Map<string, ChestTranslationValue>()
  if (!chestData || typeof chestData !== 'object') return out
  for (const category of Object.keys(chestData as Record<string, unknown>)) {
    const rawItems = (chestData as Record<string, unknown>)[category]
    if (!Array.isArray(rawItems)) continue
    for (const raw of rawItems) {
      const item = parseChestItem(raw)
      if (item && item.name) out.set(item.itemKey, { name: item.name, description: item.description })
    }
  }
  return out
}

/**
 * Calcule un sort_order pour chaque clé d'item d'un import (ordre de la catégorie).
 * Les items connus gardent leur sort_order ; les nouveaux items sont intercalés
 * (point médian) entre leurs voisins déjà connus.
 */
function computeChestSortOrders(keys: string[], existing: Map<string, number>): Map<string, number> {
  const result = new Map<string, number>()
  let lower: number | null = null
  let pending: string[] = []

  const flush = (upper: number | null) => {
    if (pending.length === 0) return
    if (lower === null && upper === null) {
      // catalogue vide : numérotation séquentielle
      pending.forEach((key, i) => result.set(key, i))
    } else if (lower === null && upper !== null) {
      // nouveaux items avant le premier connu : placés en dessous
      pending.forEach((key, i) => result.set(key, upper - (pending.length - i)))
    } else if (lower !== null && upper === null) {
      // nouveaux items après le dernier connu : ajoutés à la suite
      const base = lower
      pending.forEach((key, i) => result.set(key, base + (i + 1)))
    } else if (lower !== null && upper !== null) {
      // intercalation régulière entre deux connus
      const base = lower
      const gap = (upper - base) / (pending.length + 1)
      pending.forEach((key, i) => result.set(key, base + gap * (i + 1)))
    }
    pending = []
  }

  for (const key of keys) {
    const known = existing.get(key)
    if (known !== undefined) {
      flush(known)
      result.set(key, known)
      lower = known
    } else {
      pending.push(key)
    }
  }
  flush(null)
  return result
}

/**
 * Importe le coffre d'un utilisateur depuis /fr/api/profilev2/chest
 * (payload = { chestData: { <catégorie>: [items] }, categoryMap }).
 * Alimente le catalogue partagé (intercalation de l'ordre pour les nouveaux
 * items, refresh nom/desc/image FR — le site fait foi) puis remplace la possession
 * de l'utilisateur.
 *
 * `translations` (optionnel) porte les payloads de coffre EN/ES récupérés par le
 * même import : leurs noms sont stockés dans chest_item_translations (par item_key),
 * sans toucher au nom FR de base.
 */
export function importChestData(
  userId: number,
  payload: { chestData?: Record<string, unknown> },
  translations?: { en?: unknown, es?: unknown }
): { items: number, categories: number, newItems: Array<{ id: number, enTitle: string }> } {
  const chestData = payload?.chestData
  if (!chestData || typeof chestData !== 'object') {
    throw new Error('Données de coffre invalides')
  }

  // Pré-parser toutes les catégories AVANT de toucher à la possession : un coffre
  // vide ou illisible (réponse transitoire, compte vide) ne doit pas effacer le
  // coffre déjà importé de l'utilisateur.
  const parsed: Array<{ category: string, items: ParsedChestItem[] }> = []
  let totalItems = 0
  for (const category of Object.keys(chestData)) {
    const rawItems = (chestData as Record<string, unknown>)[category]
    if (!Array.isArray(rawItems)) continue
    const items = rawItems
      .map(parseChestItem)
      .filter((it): it is ParsedChestItem => it !== null)
    if (items.length === 0) continue
    parsed.push({ category, items })
    totalItems += items.length
  }

  if (totalItems === 0) {
    return { items: 0, categories: 0, newItems: [] as Array<{ id: number, enTitle: string }> }
  }

  const db = getReputationDb()

  // Unicité du catalogue sur item_key (identité d'item partagée entre joueurs).
  // uid (#Name) n'est posé qu'à la création, jamais mis à jour (par exemplaire).
  const getByItemKey = db.prepare('SELECT id FROM chest_items WHERE item_key = ?')
  const insertItem = db.prepare(`
    INSERT INTO chest_items (uid, item_key, category, subcategory, name, description, image, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // Refresh des champs (le site fait foi) sans écraser avec une valeur vide.
  // sort_order est repassé : valeur inchangée pour un item stable (même catégorie),
  // recalculé si l'item a changé de catégorie entre deux exports.
  const updateItem = db.prepare(`
    UPDATE chest_items SET
      category = ?,
      subcategory = ?,
      name = COALESCE(NULLIF(?, ''), name),
      description = COALESCE(NULLIF(?, ''), description),
      image = COALESCE(NULLIF(?, ''), image),
      sort_order = ?
    WHERE id = ?
  `)
  const getExistingByCategory = db.prepare('SELECT item_key as key, sort_order as sortOrder FROM chest_items WHERE category = ?')
  // Repli d'appariement : si la clé ne matche pas (image absente ou URL variable),
  // réutiliser une ligne existante de même nom + catégorie + sous-catégorie pour ne
  // pas créer de doublon (qui éclaterait la possession entre lignes). On vise la plus
  // ancienne (MIN id) si plusieurs subsistent encore.
  const getByNameInScope = db.prepare(`
    SELECT id, item_key as itemKey FROM chest_items
    WHERE lower(trim(name)) = lower(trim(?)) AND category = ? AND COALESCE(subcategory, '') = COALESCE(?, '')
    ORDER BY id LIMIT 1
  `)
  const insertOwnership = db.prepare('INSERT OR IGNORE INTO user_chest_items (user_id, item_id) VALUES (?, ?)')
  const deleteOwnership = db.prepare('DELETE FROM user_chest_items WHERE user_id = ?')

  // Traductions (nom + description) dans les langues secondaires (EN/ES), par item_key.
  const translationData: Array<{ locale: string, items: Map<string, ChestTranslationValue> }> = [
    { locale: 'en', items: parseChestTranslations((translations?.en as { chestData?: unknown } | undefined)?.chestData) },
    { locale: 'es', items: parseChestTranslations((translations?.es as { chestData?: unknown } | undefined)?.chestData) }
  ]

  // Nom EN par item_key : sert à retrouver la page wiki (anglaise) des items
  // nouvellement créés, pour les enrichir en coût/prérequis après l'import.
  const enByItemKey = new Map<string, string>()
  const enItems = translationData.find(t => t.locale === 'en')?.items
  if (enItems) {
    for (const [itemKey, value] of enItems) {
      if (value.name) enByItemKey.set(itemKey, value.name)
    }
  }
  // Items créés lors de cet import (catalogue partagé) : candidats à l'enrichissement wiki.
  const newItems: Array<{ id: number, enTitle: string }> = []
  // Clé d'import -> clé réellement stockée sur la ligne (diffèrent quand on a réutilisé
  // une ligne existante par nom). Sert à indexer les traductions sur la bonne ligne.
  const keyRemap = new Map<string, string>()

  const upsertTranslation = db.prepare(`
    INSERT INTO chest_item_translations (item_key, locale, name, description)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(item_key, locale) DO UPDATE SET name = excluded.name, description = excluded.description
  `)

  const run = db.transaction(() => {
    // Le coffre importé = possession courante : on remplace l'ensemble.
    deleteOwnership.run(userId)

    for (const { category, items } of parsed) {
      const existing = new Map<string, number>()
      for (const row of getExistingByCategory.all(category) as Array<{ key: string, sortOrder: number }>) {
        existing.set(row.key, row.sortOrder)
      }

      const orders = computeChestSortOrders(items.map(i => i.itemKey), existing)

      for (const item of items) {
        let row = getByItemKey.get(item.itemKey) as { id: number } | undefined
        // La traduction de cet item doit s'indexer sur la clé réellement stockée.
        let storedKey = item.itemKey
        // Pas de match par clé : réutiliser une ligne existante de même nom dans le
        // même périmètre plutôt que d'en créer une nouvelle (anti-doublon).
        if (!row && item.name) {
          const byName = getByNameInScope.get(item.name, category, item.subcategory) as { id: number, itemKey: string } | undefined
          if (byName) {
            row = { id: byName.id }
            storedKey = byName.itemKey
          }
        }
        keyRemap.set(item.itemKey, storedKey)
        let id: number
        if (row) {
          updateItem.run(
            category, item.subcategory, item.name, item.description, item.image,
            orders.get(item.itemKey) ?? 0, row.id
          )
          id = row.id
        } else {
          const res = insertItem.run(
            item.uid, item.itemKey, category, item.subcategory, item.name, item.description, item.image,
            orders.get(item.itemKey) ?? 0
          )
          id = Number(res.lastInsertRowid)
          // Item neuf : candidat à l'enrichissement wiki UNIQUEMENT si on a son nom EN.
          // La page wiki est anglaise ; un repli sur le nom FR ne matcherait jamais et
          // ne ferait que générer des requêtes sortantes inutiles.
          const enTitle = enByItemKey.get(item.itemKey)
          if (enTitle) newItems.push({ id, enTitle })
        }
        insertOwnership.run(userId, id)
      }
    }

    // Traductions EN/ES (nom + description) : upsert sur la clé réellement stockée
    // (via keyRemap) pour rester lié à la ligne réutilisée par nom le cas échéant.
    for (const { locale, items } of translationData) {
      for (const [itemKey, value] of items) {
        if (value.name) upsertTranslation.run(keyRemap.get(itemKey) || itemKey, locale, value.name, value.description)
      }
    }
  })
  run()

  return { items: totalItems, categories: parsed.length, newItems }
}

// Clé courte du wiki (champ *-level, ou allégeance d'événement) -> clé de faction du site.
const WIKI_FACTION_TO_KEY: Record<string, string> = {
  hoarder: 'GoldHoarders',
  merchant: 'MerchantAlliance',
  souls: 'OrderOfSouls',
  hunter: 'HuntersCall',
  seadog: 'SeaDogs',
  reaper: 'ReapersBones',
  athena: 'AthenasFortune',
  // Factions d'événement mondial (prérequis via `faction` + `allegiance`).
  flame: 'Flameheart',
  guardians: 'PirateLord'
}

interface EligibilityContext {
  // nom d'emblème normalisé (EN ET base) -> grade gagné par l'utilisateur
  grades: Map<string, number>
  // tous les noms d'emblèmes connus (EN + base), normalisés
  emblemNames: Set<string>
  // l'utilisateur a-t-il importé sa progression d'emblèmes ?
  hasImported: boolean
  // clé de faction (ex. AthenasFortune) -> niveau de réputation de l'utilisateur
  factionLevels: Map<string, number>
  // nom d'emblème normalisé (EN + base) -> nom dans la locale courante (pour l'affichage)
  localizedNames: Map<string, string>
  // nom d'emblème normalisé (EN + base) -> max_grade (pour masquer le grade des binaires)
  emblemMaxGrades: Map<string, number>
  // nom d'emblème normalisé (EN + base) -> id de l'emblème (pour ouvrir sa popup)
  emblemIds: Map<string, number>
}

// Contexte de l'utilisateur pour juger l'éligibilité des prérequis (commendations +
// niveaux de faction). Emblèmes indexés par nom EN ET par nom de base (selon la langue
// d'import), pour que le rapprochement avec le nom anglais du wiki marche dans les deux cas.
/**
 * Infos d'affichage par emblème, indexées par nom (EN + base, normalisés) : nom dans la
 * locale demandée (pour localiser une commendation à partir du nom anglais du wiki) et
 * max_grade (pour savoir si l'emblème a de vrais paliers de grade ou s'il est binaire).
 */
function buildEmblemDisplayInfo(db: Database.Database, locale: string): { localizedNames: Map<string, string>, maxGrades: Map<string, number>, ids: Map<string, number> } {
  const rows = db.prepare(`
    SELECT
      e.id as id,
      COALESCE(NULLIF(et.name, ''), e.name) as enName,
      e.name as baseName,
      COALESCE(NULLIF(loc.name, ''), e.name) as localizedName,
      e.max_grade as maxGrade
    FROM emblems e
    LEFT JOIN emblem_translations et ON et.emblem_id = e.id AND et.locale = 'en'
    LEFT JOIN emblem_translations loc ON loc.emblem_id = e.id AND loc.locale = ?
  `).all(locale) as Array<{ id: number, enName: string, baseName: string, localizedName: string, maxGrade: number }>
  const localizedNames = new Map<string, string>()
  const maxGrades = new Map<string, number>()
  const ids = new Map<string, number>()
  for (const r of rows) {
    for (const k of new Set([normalizeName(r.enName), normalizeName(r.baseName)])) {
      localizedNames.set(k, r.localizedName)
      maxGrades.set(k, r.maxGrade)
      ids.set(k, r.id)
    }
  }
  return { localizedNames, maxGrades, ids }
}

function getUserEligibilityContext(userId: number, locale = 'fr'): EligibilityContext {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT
      COALESCE(NULLIF(et.name, ''), e.name) as enName,
      e.name as baseName,
      ue.grade as grade,
      ue.completed as completed
    FROM emblems e
    LEFT JOIN emblem_translations et ON et.emblem_id = e.id AND et.locale = 'en'
    LEFT JOIN user_emblems ue ON ue.emblem_id = e.id AND ue.user_id = ?
  `).all(userId) as Array<{ enName: string, baseName: string, grade: number | null, completed: number | null }>
  const grades = new Map<string, number>()
  const emblemNames = new Set<string>()
  let hasImported = false
  for (const r of rows) {
    const keys = new Set([normalizeName(r.enName), normalizeName(r.baseName)])
    for (const k of keys) emblemNames.add(k)
    if (r.grade !== null) {
      hasImported = true
      // Emblèmes mono-grade / binaires : l'API renvoie Grade 0 même une fois obtenus.
      // Un emblème complété vaut au moins grade 1 (sinon un prérequis « grade 1 » ne
      // serait jamais satisfait pour ces emblèmes).
      const effGrade = (r.completed && r.grade === 0) ? 1 : r.grade
      for (const k of keys) {
        const prev = grades.get(k)
        if (prev == null || effGrade > prev) grades.set(k, effGrade)
      }
    }
  }
  const factionLevels = new Map<string, number>()
  const flRows = db.prepare('SELECT faction_key as key, level FROM user_faction_levels WHERE user_id = ?')
    .all(userId) as Array<{ key: string, level: number }>
  for (const r of flRows) factionLevels.set(r.key, r.level)
  const { localizedNames, maxGrades, ids } = buildEmblemDisplayInfo(db, locale)
  return { grades, emblemNames, hasImported, factionLevels, localizedNames, emblemMaxGrades: maxGrades, emblemIds: ids }
}

/**
 * Niveaux de faction de l'utilisateur (captés à l'import), indexés par clé de faction.
 * Objet vide tant que l'utilisateur n'a pas importé sa réputation (ou pour les factions
 * sans niveau, ex. campagnes type Aventures en mer).
 */
export function getUserFactionLevels(userId: number): Record<string, { level: number, distinctionLevel: number, progress: number }> {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT faction_key as key, level, distinction_level as distinctionLevel, progress
    FROM user_faction_levels WHERE user_id = ?
  `).all(userId) as Array<{ key: string, level: number, distinctionLevel: number, progress: number }>
  const out: Record<string, { level: number, distinctionLevel: number, progress: number }> = {}
  for (const r of rows) out[r.key] = { level: r.level, distinctionLevel: r.distinctionLevel, progress: r.progress }
  return out
}

interface ReputationEmblemTranslation { name: string | null, description: string | null }
export interface ReputationData {
  user: UserInfo | null
  factions: Array<FactionInfo & {
    level?: number
    translations: Record<string, FactionTranslation>
    campaigns: Array<CampaignInfo & {
      translations: Record<string, CampaignTranslation>
      emblems: Array<EmblemInfo & {
        progress: UserEmblemProgress | null
        translations: Record<string, ReputationEmblemTranslation>
      }>
    }>
  }>
}

/**
 * Catalogue des réputations (factions / campagnes / emblèmes). Avec `userId` : inclut
 * l'utilisateur, sa progression par emblème et les niveaux de faction. Sans (`null`) :
 * catalogue public (user null, progress null). Décision public/privé faite côté serveur
 * (à partir de la session), donc fiable en SSR — pas de dépendance au timing client.
 */
export function getReputationData(userId: number | null): ReputationData {
  const db = getReputationDb()
  const user = userId
    ? ((db.prepare('SELECT id, username, last_import_at as lastImportAt FROM users WHERE id = ?').get(userId) as UserInfo | undefined) ?? null)
    : null

  const factions = getAllFactions()
  const factionTranslations = getAllFactionTranslations()
  const campaignTranslations = getAllCampaignTranslations()
  const factionLevels = userId ? getUserFactionLevels(userId) : {}

  const allTranslations = db.prepare(`
    SELECT emblem_id, locale, name, description FROM emblem_translations
  `).all() as Array<{ emblem_id: number, locale: string, name: string | null, description: string | null }>
  const translationsByEmblem: Record<number, Record<string, ReputationEmblemTranslation>> = {}
  for (const t of allTranslations) {
    const byLocale = translationsByEmblem[t.emblem_id] ?? (translationsByEmblem[t.emblem_id] = {})
    byLocale[t.locale] = { name: t.name, description: t.description }
  }

  const getProgress = userId
    ? db.prepare('SELECT user_id as userId, value, threshold, grade, completed FROM user_emblems WHERE emblem_id = ? AND user_id = ?')
    : null

  const result: ReputationData = { user, factions: [] }

  for (const faction of factions) {
    const campaigns = getCampaignsByFaction(faction.id)
    const factionWithCampaigns: ReputationData['factions'][number] = {
      ...faction,
      level: userId ? factionLevels[faction.key]?.level : undefined,
      translations: factionTranslations[faction.id] || {},
      campaigns: []
    }

    for (const campaign of campaigns) {
      const emblemRows = db.prepare(`
        SELECT
          e.id, e.key, e.name, e.description, e.image, e.max_grade as maxGrade,
          e.campaign_id as campaignId,
          e.high_seas_only as highSeasOnly,
          (SELECT threshold FROM emblem_grade_thresholds WHERE emblem_id = e.id ORDER BY grade DESC LIMIT 1) as maxThreshold
        FROM emblems e
        WHERE e.campaign_id = ? AND e.validated = 1
        ORDER BY e.sort_order, e.id
      `).all(campaign.id) as Array<Omit<EmblemInfo, 'gradeThresholds' | 'factionKey' | 'campaignName' | 'highSeasOnly'> & { highSeasOnly: number }>

      const emblemIds = emblemRows.map(e => e.id)
      const allGradeThresholds = getAllGradeThresholdsForEmblems(emblemIds)

      const emblems = emblemRows.map((emblem) => {
        const progress = (userId && getProgress)
          ? ((getProgress.get(emblem.id, userId) as UserEmblemProgress | undefined) ?? null)
          : null
        return {
          ...emblem,
          factionKey: faction.key,
          campaignName: campaign.name,
          gradeThresholds: allGradeThresholds[emblem.id] || [],
          progress,
          translations: translationsByEmblem[emblem.id] || {},
          highSeasOnly: !!emblem.highSeasOnly
        }
      })

      factionWithCampaigns.campaigns.push({
        ...campaign,
        translations: campaignTranslations[campaign.id] || {},
        emblems
      })
    }

    result.factions.push(factionWithCampaigns)
  }

  return result
}

// Statut d'éligibilité d'un item vs la progression de l'utilisateur (commendations + factions).
function computeEligibility(prereqs: ChestItemPrereqs | null, ctx: EligibilityContext): ChestItemEligibility | null {
  if (!prereqs) return null
  // Garde-fou : des prérequis stockés malformés ne doivent pas faire planter le catalogue.
  const rawComms = Array.isArray(prereqs.commendations) ? prereqs.commendations : []
  const commendations = rawComms.map((c) => {
    const requiredGrade = typeof c.grade === 'number' ? c.grade : 1
    const key = normalizeName(c.name)
    // grade connu / emblème existant mais sans progression (0 si importé, sinon ?) /
    // aucun emblème correspondant (?).
    let userGrade: number | null
    if (ctx.grades.has(key)) userGrade = ctx.grades.get(key)!
    else if (ctx.emblemNames.has(key)) userGrade = ctx.hasImported ? 0 : null
    else userGrade = null
    return {
      // Nom localisé (selon la locale d'appel) ; repli sur le nom du wiki (anglais).
      name: ctx.localizedNames.get(key) || c.name,
      requiredGrade,
      userGrade,
      met: userGrade !== null && userGrade >= requiredGrade,
      // max_grade de l'emblème (null si inconnu) : permet de masquer le grade affiché
      // pour les emblèmes binaires (max_grade <= 1), où il suffit de l'avoir complété.
      maxGrade: ctx.emblemMaxGrades.get(key) ?? null,
      // id de l'emblème correspondant (null si inconnu) : pour ouvrir sa popup de détail.
      emblemId: ctx.emblemIds.get(key) ?? null
    }
  })

  const rawFl = (prereqs.factionLevels && typeof prereqs.factionLevels === 'object') ? prereqs.factionLevels : {}
  const factions = Object.entries(rawFl)
    .filter(([, required]) => typeof required === 'number' && required > 0)
    .map(([shortKey, required]) => {
      const requiredLevel = required as number
      const factionKey = WIKI_FACTION_TO_KEY[shortKey]
      // Niveau connu si l'utilisateur a (ré)importé sa réputation, sinon ? (jamais verrouillé à tort).
      const userLevel = factionKey ? (ctx.factionLevels.get(factionKey) ?? null) : null
      return { key: shortKey, requiredLevel, userLevel, met: userLevel !== null && userLevel >= requiredLevel }
    })

  // Conditions encore non vérifiables par les données du site.
  const hasUnverifiable = !!prereqs.legendary || !!prereqs.requires
  if (commendations.length === 0 && factions.length === 0 && !hasUnverifiable) return null

  // 'locked' : on SAIT qu'un prérequis (grade ou niveau connu) n'est pas atteint.
  const anyLocked = commendations.some(c => c.userGrade !== null && !c.met)
    || factions.some(f => f.userLevel !== null && !f.met)
  const hasCheckable = commendations.length > 0 || factions.length > 0
  const allMet = commendations.every(c => c.met) && factions.every(f => f.met)
  let status: ChestItemEligibility['status']
  if (anyLocked) status = 'locked'
  else if (hasCheckable && allMet && !hasUnverifiable) status = 'met'
  else status = 'unknown'
  return { status, commendations, factions }
}

/** Items du coffre possédés par un utilisateur, triés par catégorie puis ordre d'import. */
/**
 * Catalogue complet des items du coffre (tous ceux connus, importés par n'importe
 * quel utilisateur), avec un indicateur `owned` pour l'utilisateur donné.
 * Trié par catégorie (ordre du jeu) puis ordre d'import.
 */
export function getChestCatalogForUser(userId: number, locale = 'fr'): ChestItem[] {
  const db = getReputationDb()
  // Nom résolu selon la locale : FR = nom de base (chest_items.name), EN/ES via
  // chest_item_translations (repli sur le nom FR si pas de traduction). Pour 'fr'
  // (ou locale inconnue) la jointure ne matche rien et on garde ci.name.
  const rows = db.prepare(`
    SELECT
      ci.id, ci.uid, ci.category, ci.subcategory,
      COALESCE(NULLIF(t.name, ''), ci.name) as name,
      COALESCE(NULLIF(t.description, ''), ci.description) as description,
      ci.image,
      ci.sort_order as sortOrder, ci.colors, ci.cost, ci.prerequisites,
      CASE WHEN uci.user_id IS NOT NULL THEN 1 ELSE 0 END as owned
    FROM chest_items ci
    LEFT JOIN user_chest_items uci ON uci.item_id = ci.id AND uci.user_id = ?
    LEFT JOIN chest_item_translations t ON t.item_key = ci.item_key AND t.locale = ?
  `).all(userId, locale) as Array<{
    id: number
    uid: string
    category: string
    subcategory: string | null
    name: string
    description: string | null
    image: string | null
    sortOrder: number
    colors: string | null
    cost: string | null
    prerequisites: string | null
    owned: number
  }>

  rows.sort(compareChestRows)

  // Co-membres (de tous les groupes de l'utilisateur) possédant chaque item.
  const groupOwners = getChestGroupOwners(db, userId)
  // Contexte commendations de l'utilisateur (pour l'éligibilité des prérequis).
  // Inutile de faire la jointure emblèmes si aucun item du catalogue n'a de prérequis.
  const commCtx: EligibilityContext = rows.some(r => r.prerequisites)
    ? getUserEligibilityContext(userId, locale)
    : { grades: new Map<string, number>(), emblemNames: new Set<string>(), hasImported: false, factionLevels: new Map<string, number>(), localizedNames: new Map<string, string>(), emblemMaxGrades: new Map<string, number>(), emblemIds: new Map<string, number>() }

  return rows.map((r) => {
    const prerequisites = parseChestItemPrereqs(r.prerequisites)
    return {
      id: r.id,
      uid: r.uid,
      category: r.category,
      subcategory: r.subcategory,
      name: r.name,
      description: r.description,
      image: r.image,
      owned: r.owned === 1,
      colors: parseColors(r.colors),
      cost: parseChestItemCost(r.cost),
      prerequisites,
      eligibility: computeEligibility(prerequisites, commCtx),
      groupOwners: groupOwners.get(r.id) || []
    }
  })
}

/**
 * Catalogue public du coffre : tous les items connus, sans données liées à un
 * utilisateur (owned = false, groupOwners vides). Coûts + prérequis présents ;
 * l'éligibilité ne porte que les exigences (pas de progression utilisateur).
 */
export function getChestCatalogPublic(locale = 'fr'): ChestItem[] {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT
      ci.id, ci.uid, ci.category, ci.subcategory,
      COALESCE(NULLIF(t.name, ''), ci.name) as name,
      COALESCE(NULLIF(t.description, ''), ci.description) as description,
      ci.image, ci.sort_order as sortOrder, ci.colors, ci.cost, ci.prerequisites
    FROM chest_items ci
    LEFT JOIN chest_item_translations t ON t.item_key = ci.item_key AND t.locale = ?
  `).all(locale) as Array<{
    id: number
    uid: string
    category: string
    subcategory: string | null
    name: string
    description: string | null
    image: string | null
    sortOrder: number
    colors: string | null
    cost: string | null
    prerequisites: string | null
  }>
  rows.sort(compareChestRows)
  // Pas de progression utilisateur, mais on localise quand même le nom des commendations.
  const publicInfo = buildEmblemDisplayInfo(db, locale)
  const emptyCtx: EligibilityContext = { grades: new Map(), emblemNames: new Set(), hasImported: false, factionLevels: new Map(), localizedNames: publicInfo.localizedNames, emblemMaxGrades: publicInfo.maxGrades, emblemIds: publicInfo.ids }
  return rows.map((r) => {
    const prerequisites = parseChestItemPrereqs(r.prerequisites)
    return {
      id: r.id,
      uid: r.uid,
      category: r.category,
      subcategory: r.subcategory,
      name: r.name,
      description: r.description,
      image: r.image,
      owned: false,
      colors: parseColors(r.colors),
      cost: parseChestItemCost(r.cost),
      prerequisites,
      eligibility: computeEligibility(prerequisites, emptyCtx),
      groupOwners: []
    }
  })
}

// Index inverse « nom de commendation normalisé -> [{ itemId, grade requis }] », mis en
// cache (les prérequis ne changent qu'à l'import admin). Évite de re-scanner + re-parser
// tous les prérequis à chaque ouverture de popup. Invalidé par setChestItemPrereqs.
let prereqCommIndex: Map<string, Array<{ id: number, grade: number | null }>> | null = null
let prereqCommIndexAt = 0
const PREREQ_INDEX_TTL = 5 * 60 * 1000

function invalidatePrereqIndex(): void {
  prereqCommIndex = null
}

function getPrereqCommIndex(db: Database.Database): Map<string, Array<{ id: number, grade: number | null }>> {
  const now = Date.now()
  if (prereqCommIndex && now - prereqCommIndexAt < PREREQ_INDEX_TTL) return prereqCommIndex
  const rows = db.prepare(`
    SELECT id, prerequisites FROM chest_items WHERE prerequisites IS NOT NULL AND prerequisites != ''
  `).all() as Array<{ id: number, prerequisites: string | null }>
  const idx = new Map<string, Array<{ id: number, grade: number | null }>>()
  for (const r of rows) {
    const pr = parseChestItemPrereqs(r.prerequisites)
    if (!pr?.commendations) continue
    for (const c of pr.commendations) {
      const key = normalizeName(c.name)
      const arr = idx.get(key)
      if (arr) arr.push({ id: r.id, grade: c.grade ?? null })
      else idx.set(key, [{ id: r.id, grade: c.grade ?? null }])
    }
  }
  prereqCommIndex = idx
  prereqCommIndexAt = now
  return idx
}

/**
 * Vue inverse : objets du coffre dont l'emblème donné est un prérequis (commendation).
 * Rapproche le nom EN/base de l'emblème des commendations des prérequis ; noms d'objets
 * résolus selon la locale. Borné à 100 résultats.
 */
export function getChestItemsForEmblem(emblemId: number, locale = 'fr'): Array<{ id: number, name: string, image: string | null, grade: number | null }> {
  const db = getReputationDb()
  const e = db.prepare(`
    SELECT COALESCE(NULLIF(et.name, ''), em.name) as enName, em.name as baseName
    FROM emblems em
    LEFT JOIN emblem_translations et ON et.emblem_id = em.id AND et.locale = 'en'
    WHERE em.id = ?
  `).get(emblemId) as { enName: string, baseName: string } | undefined
  if (!e) return []

  const idx = getPrereqCommIndex(db)
  const gradeById = new Map<number, number | null>()
  for (const key of new Set([normalizeName(e.enName), normalizeName(e.baseName)])) {
    for (const m of idx.get(key) || []) {
      if (!gradeById.has(m.id)) gradeById.set(m.id, m.grade)
    }
  }
  if (gradeById.size === 0) return []
  const ids = [...gradeById.keys()].slice(0, 100)

  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT ci.id, COALESCE(NULLIF(t.name, ''), ci.name) as name, ci.image
    FROM chest_items ci
    LEFT JOIN chest_item_translations t ON t.item_key = ci.item_key AND t.locale = ?
    WHERE ci.id IN (${placeholders})
  `).all(locale, ...ids) as Array<{ id: number, name: string, image: string | null }>

  // Tri par grade requis croissant (les sans-grade en dernier), nom en départage.
  return rows
    .map(r => ({ id: r.id, name: r.name, image: r.image, grade: gradeById.get(r.id) ?? null }))
    .sort((a, b) => (a.grade ?? Number.MAX_SAFE_INTEGER) - (b.grade ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))
}

function parseColors(json: string | null): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// ---- Analyse des couleurs des items du coffre ----

export interface ChestAnalysisItem { id: number, image: string, category: string, subcategory: string | null }

/** Items du coffre à analyser (image présente, couleurs pas encore extraites). */
export function getChestItemsForColorAnalysis(limit: number): ChestAnalysisItem[] {
  const db = getReputationDb()
  return db.prepare(`
    SELECT id, image, category, subcategory FROM chest_items
    WHERE dominant_colors IS NULL AND image IS NOT NULL AND image != ''
    LIMIT ?
  `).all(limit) as ChestAnalysisItem[]
}

/** Clé de scope « catégorie::sous-catégorie » pour les signatures (sous-cat. vide = ''). */
export function chestScopeKey(category: string, subcategory: string | null): string {
  return `${category}::${subcategory ?? ''}`
}

/** Signature couleur (bacs à exclure) d'un scope, ou null si non construite. */
export function getChestColorSignature(scope: string): { bins: number[], sampleCount: number, builtAt: string } | null {
  const db = getReputationDb()
  const row = db.prepare('SELECT bins, sample_count, built_at FROM chest_color_signatures WHERE scope = ?')
    .get(scope) as { bins: string, sample_count: number, built_at: string } | undefined
  if (!row) return null
  let bins: number[] = []
  try {
    const a = JSON.parse(row.bins)
    if (Array.isArray(a)) bins = a.filter((n): n is number => typeof n === 'number')
  } catch { /* corrompu */ }
  return { bins, sampleCount: row.sample_count, builtAt: row.built_at }
}

/** Toutes les signatures, indexées par scope (pour la boucle d'analyse). */
export function getAllChestColorSignatures(): Map<string, Set<number>> {
  const db = getReputationDb()
  const rows = db.prepare('SELECT scope, bins FROM chest_color_signatures').all() as Array<{ scope: string, bins: string }>
  const map = new Map<string, Set<number>>()
  for (const r of rows) {
    try {
      const a = JSON.parse(r.bins)
      if (Array.isArray(a)) map.set(r.scope, new Set(a.filter((n): n is number => typeof n === 'number')))
    } catch { /* ignore */ }
  }
  return map
}

/** Enregistre (remplace) la signature couleur d'un scope. */
export function saveChestColorSignature(scope: string, bins: number[], sampleCount: number): void {
  const db = getReputationDb()
  db.prepare(`
    INSERT INTO chest_color_signatures (scope, bins, sample_count, built_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(scope) DO UPDATE SET bins = excluded.bins, sample_count = excluded.sample_count, built_at = CURRENT_TIMESTAMP
  `).run(scope, JSON.stringify(bins), sampleCount)
}

/** Items (avec image) d'un scope donné, pour construire/appliquer une signature. */
export function getChestItemsForScope(category: string, subcategory: string | null): Array<{ id: number, image: string, manual: boolean }> {
  const db = getReputationDb()
  const rows = subcategory === null
    ? db.prepare(`SELECT id, image, colors_manual FROM chest_items WHERE category = ? AND subcategory IS NULL AND image IS NOT NULL AND image != ''`).all(category)
    : db.prepare(`SELECT id, image, colors_manual FROM chest_items WHERE category = ? AND subcategory = ? AND image IS NOT NULL AND image != ''`).all(category, subcategory)
  return (rows as Array<{ id: number, image: string, colors_manual: number | null }>)
    .map(r => ({ id: r.id, image: r.image, manual: r.colors_manual === 1 }))
}

/** Scopes (catégorie/sous-catégorie) présents, avec l'état de leur signature. */
export function getChestScopes(): Array<{ category: string, subcategory: string | null, count: number, builtAt: string | null, sampleCount: number | null, binCount: number | null }> {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT category, subcategory, COUNT(*) as count
    FROM chest_items
    WHERE image IS NOT NULL AND image != ''
    GROUP BY category, subcategory
    ORDER BY category, subcategory
  `).all() as Array<{ category: string, subcategory: string | null, count: number }>
  return rows.map((r) => {
    const sig = getChestColorSignature(chestScopeKey(r.category, r.subcategory))
    return {
      category: r.category,
      subcategory: r.subcategory,
      count: r.count,
      builtAt: sig?.builtAt ?? null,
      sampleCount: sig?.sampleCount ?? null,
      binCount: sig ? sig.bins.length : null
    }
  })
}

// --- Coûts des items du coffre (récupérés du wiki Sea of Thieves) ---

export interface ChestItemCost { gold?: number, doubloons?: number, ancientCoins?: number }

function parseChestItemCost(raw: string | null): ChestItemCost | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as unknown
    return o && typeof o === 'object' ? o as ChestItemCost : null
  } catch {
    return null
  }
}

/**
 * Scopes (catégorie/sous-catégorie) avec le total d'items, combien ont déjà un coût,
 * et l'éventuel nom de Category: du wiki mémorisé pour ce scope.
 */
export function getChestCostScopes(): Array<{ category: string, subcategory: string | null, count: number, withCost: number, wikiCategory: string | null }> {
  const db = getReputationDb()
  return db.prepare(`
    SELECT ci.category as category, ci.subcategory as subcategory,
           COUNT(*) as count,
           SUM(CASE WHEN ci.cost IS NOT NULL AND ci.cost != '' THEN 1 ELSE 0 END) as withCost,
           m.wiki_category as wikiCategory
    FROM chest_items ci
    LEFT JOIN chest_cost_wiki_map m
      ON m.category = ci.category AND m.subcategory = COALESCE(ci.subcategory, '')
    GROUP BY ci.category, ci.subcategory
    ORDER BY ci.category, ci.subcategory
  `).all() as Array<{ category: string, subcategory: string | null, count: number, withCost: number, wikiCategory: string | null }>
}

/** Mémorise (ou efface si vide) le nom de Category: du wiki pour un scope. */
export function setChestCostWikiMap(category: string, subcategory: string | null, wikiCategory: string | null): void {
  const db = getReputationDb()
  const sub = subcategory ?? ''
  const wc = wikiCategory?.trim() || ''
  if (!wc) {
    db.prepare('DELETE FROM chest_cost_wiki_map WHERE category = ? AND subcategory = ?').run(category, sub)
    return
  }
  db.prepare(`
    INSERT INTO chest_cost_wiki_map (category, subcategory, wiki_category)
    VALUES (?, ?, ?)
    ON CONFLICT(category, subcategory) DO UPDATE SET wiki_category = excluded.wiki_category
  `).run(category, sub, wc)
}

/**
 * Items d'un scope avec leur nom EN (chest_item_translations, repli sur le nom FR) et
 * leur coût actuel — pour rapprocher du wiki par nom anglais.
 */
export function getChestScopeItemsForCost(category: string, subcategory: string | null): Array<{ id: number, name: string, enName: string | null, cost: ChestItemCost | null }> {
  const db = getReputationDb()
  const sql = `
    SELECT ci.id, ci.name, t.name as enName, ci.cost
    FROM chest_items ci
    LEFT JOIN chest_item_translations t ON t.item_key = ci.item_key AND t.locale = 'en'
    WHERE ci.category = ? AND ${subcategory === null ? 'ci.subcategory IS NULL' : 'ci.subcategory = ?'}
    ORDER BY ci.sort_order
  `
  const rows = (subcategory === null
    ? db.prepare(sql).all(category)
    : db.prepare(sql).all(category, subcategory)
  ) as Array<{ id: number, name: string, enName: string | null, cost: string | null }>
  return rows.map(r => ({ id: r.id, name: r.name, enName: r.enName, cost: parseChestItemCost(r.cost) }))
}

/** Écrit le coût d'un item (null/vide = efface). Renvoie true si l'item existe. */
export function setChestItemCost(id: number, cost: ChestItemCost | null): boolean {
  const db = getReputationDb()
  const value = cost && Object.keys(cost).length > 0 ? JSON.stringify(cost) : null
  const res = db.prepare('UPDATE chest_items SET cost = ? WHERE id = ?').run(value, id)
  return res.changes > 0
}

// Forme partagée avec le wiki : une seule définition structurelle (cf. WikiPrereqs).
export type ChestItemPrereqs = WikiPrereqs

function parseChestItemPrereqs(raw: string | null): ChestItemPrereqs | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as unknown
    return o && typeof o === 'object' ? o as ChestItemPrereqs : null
  } catch {
    return null
  }
}

/** Écrit les prérequis d'un item (null/vide = efface). Renvoie true si l'item existe. */
export function setChestItemPrereqs(id: number, prereqs: ChestItemPrereqs | null): boolean {
  const db = getReputationDb()
  const value = prereqs && Object.keys(prereqs).length > 0 ? JSON.stringify(prereqs) : null
  const res = db.prepare('UPDATE chest_items SET prerequisites = ? WHERE id = ?').run(value, id)
  invalidatePrereqIndex()
  return res.changes > 0
}

/** Recherche d'items du coffre par nom (avec leurs couleurs nommées actuelles). */
export function searchChestItemsByName(query: string, limit: number): Array<{ id: number, name: string, image: string | null, colors: string[], manual: boolean }> {
  const db = getReputationDb()
  // `%`/`_` du terme sont échappés pour rester littéraux (ESCAPE '\').
  const term = `%${query.replace(/[\\%_]/g, c => `\\${c}`)}%`
  const rows = db.prepare(`
    SELECT id, name, image, colors, colors_manual FROM chest_items
    WHERE name LIKE ? ESCAPE '\\' AND image IS NOT NULL AND image != ''
    ORDER BY name
    LIMIT ?
  `).all(term, limit) as Array<{ id: number, name: string, image: string | null, colors: string | null, colors_manual: number | null }>
  return rows.map(r => ({ id: r.id, name: r.name, image: r.image, colors: parseColors(r.colors), manual: r.colors_manual === 1 }))
}

export interface ChestItemTranslationRow {
  id: number
  itemKey: string
  name: string
  descFr: string | null
  image: string | null
  en: string | null
  es: string | null
  enDesc: string | null
  esDesc: string | null
}

/**
 * Recherche d'items du coffre par nom FR (nom de base) avec leurs traductions EN/ES
 * actuelles (nom + description), pour l'éditeur d'administration. Le FR sert de
 * référence (lecture seule côté admin) ; seules EN/ES sont éditables.
 */
export function searchChestItemTranslations(query: string, limit: number): ChestItemTranslationRow[] {
  const db = getReputationDb()
  // `%`/`_` du terme sont échappés pour rester littéraux (ESCAPE '\').
  const term = `%${query.replace(/[\\%_]/g, c => `\\${c}`)}%`
  return db.prepare(`
    SELECT
      ci.id, ci.item_key as itemKey, ci.name, ci.description as descFr, ci.image,
      en_t.name as en, es_t.name as es,
      en_t.description as enDesc, es_t.description as esDesc
    FROM chest_items ci
    LEFT JOIN chest_item_translations en_t ON en_t.item_key = ci.item_key AND en_t.locale = 'en'
    LEFT JOIN chest_item_translations es_t ON es_t.item_key = ci.item_key AND es_t.locale = 'es'
    WHERE ci.name LIKE ? ESCAPE '\\'
    ORDER BY ci.name
    LIMIT ?
  `).all(term, limit) as ChestItemTranslationRow[]
}

export interface ChestItemTranslationInput {
  itemKey: string
  translations: Array<{ locale: string, name?: string | null, description?: string | null }>
}

/**
 * Upsert des traductions d'items (EN/ES uniquement ; nom + description). Une ligne
 * sans aucun override (ni nom ni description) est supprimée. Nom vide mais description
 * présente : nom stocké vide → repli sur le nom FR à l'affichage.
 */
export function setChestItemTranslations(entries: ChestItemTranslationInput[]): void {
  const db = getReputationDb()
  const upsert = db.prepare(`
    INSERT INTO chest_item_translations (item_key, locale, name, description)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(item_key, locale) DO UPDATE SET name = excluded.name, description = excluded.description
  `)
  const del = db.prepare('DELETE FROM chest_item_translations WHERE item_key = ? AND locale = ?')

  const run = db.transaction(() => {
    for (const entry of entries) {
      const itemKey = entry.itemKey?.trim()
      if (!itemKey) continue
      for (const t of entry.translations) {
        // FR est la langue de base (chest_items.name/description) : non gérée ici.
        if (!t.locale || !['en', 'es'].includes(t.locale)) continue
        const name = t.name?.trim() || ''
        const description = t.description?.trim() || null
        if (!name && !description) {
          del.run(itemKey, t.locale)
        } else {
          upsert.run(itemKey, t.locale, name, description)
        }
      }
    }
  })
  run()
}

/** Image + scope d'un item du coffre par id (pour ré-analyser un item précis). */
export function getChestItemImageById(id: number): { id: number, image: string, category: string, subcategory: string | null } | undefined {
  const db = getReputationDb()
  return db.prepare(
    `SELECT id, image, category, subcategory FROM chest_items WHERE id = ? AND image IS NOT NULL AND image != ''`
  ).get(id) as { id: number, image: string, category: string, subcategory: string | null } | undefined
}

/**
 * Enregistre les RGB dominants bruts + les couleurs nommées d'un item (extraction
 * automatique). Lève le flag `colors_manual` : une ré-analyse écrase une éventuelle
 * édition manuelle précédente.
 */
export function saveChestItemColors(id: number, dominant: string[], named: string[]): void {
  const db = getReputationDb()
  db.prepare('UPDATE chest_items SET dominant_colors = ?, colors = ?, colors_manual = 0 WHERE id = ?')
    .run(JSON.stringify(dominant), JSON.stringify(named), id)
}

/**
 * Fixe à la main les couleurs nommées d'un item et le marque `colors_manual` (il sera
 * désormais ignoré par « Re-classer » / « Tout ré-analyser »). Les RGB dominants bruts
 * sont laissés tels quels. Renvoie false si l'item n'existe pas.
 */
export function setChestItemColorsManual(id: number, colors: string[]): boolean {
  const db = getReputationDb()
  const res = db.prepare('UPDATE chest_items SET colors = ?, colors_manual = 1 WHERE id = ?')
    .run(JSON.stringify(colors), id)
  return res.changes > 0
}

/** Compteurs d'avancement de l'analyse des couleurs. */
export function getChestColorStatus(): { analyzed: number, total: number } {
  const db = getReputationDb()
  const total = (db.prepare(
    `SELECT COUNT(*) as c FROM chest_items WHERE image IS NOT NULL AND image != ''`
  ).get() as { c: number }).c
  const analyzed = (db.prepare(
    `SELECT COUNT(*) as c FROM chest_items WHERE dominant_colors IS NOT NULL AND image IS NOT NULL AND image != ''`
  ).get() as { c: number }).c
  return { analyzed, total }
}

/**
 * Réinitialise les couleurs de tous les items (RGB dominants + noms) pour forcer une
 * ré-extraction complète. À utiliser quand l'algorithme d'extraction change (les RGB
 * stockés deviennent obsolètes : un simple re-classement ne suffit pas, il faut
 * re-télécharger les images). Renvoie le nombre d'items remis à analyser.
 */
export function resetChestItemColors(): number {
  const db = getReputationDb()
  // On épargne les items aux couleurs éditées à la main (colors_manual = 1).
  const res = db.prepare(
    `UPDATE chest_items SET dominant_colors = NULL, colors = NULL
     WHERE image IS NOT NULL AND image != '' AND (colors_manual IS NULL OR colors_manual = 0)`
  ).run()
  return res.changes
}

/**
 * Re-classe les couleurs nommées de tous les items à partir des RGB dominants déjà
 * stockés (sans re-télécharger les images). `classify` mappe des RGB hex -> noms.
 */
export function reclassifyChestColors(classify: (dominant: string[]) => string[]): number {
  const db = getReputationDb()
  // On épargne les items aux couleurs éditées à la main (colors_manual = 1).
  const rows = db.prepare(
    `SELECT id, dominant_colors FROM chest_items
     WHERE dominant_colors IS NOT NULL AND (colors_manual IS NULL OR colors_manual = 0)`
  ).all() as Array<{ id: number, dominant_colors: string }>
  const upd = db.prepare('UPDATE chest_items SET colors = ? WHERE id = ?')
  const tx = db.transaction(() => {
    for (const r of rows) {
      upd.run(JSON.stringify(classify(parseColors(r.dominant_colors))), r.id)
    }
  })
  tx()
  return rows.length
}

/**
 * Pour chaque item du coffre, les co-membres qui le possèdent, regroupés par
 * groupe partagé avec `userId` (l'utilisateur lui-même exclu). Un membre présent
 * dans plusieurs groupes partagés apparaît sous chacun.
 */
function getChestGroupOwners(db: Database.Database, userId: number): Map<number, Array<{ group: string, members: string[] }>> {
  const rows = db.prepare(`
    SELECT g.id as groupId, g.name as groupName, uci.item_id as itemId, u.username
    FROM group_members gmSelf
    JOIN groups g ON g.id = gmSelf.group_id
    JOIN group_members gm ON gm.group_id = g.id AND gm.user_id != gmSelf.user_id
    JOIN user_chest_items uci ON uci.user_id = gm.user_id
    JOIN users u ON u.id = gm.user_id
    WHERE gmSelf.user_id = ?
    ORDER BY g.name, u.username
  `).all(userId) as Array<{ groupId: number, groupName: string, itemId: number, username: string }>

  // itemId -> groupId -> { group, members } (Map interne pour préserver l'ordre par nom de groupe)
  const byItem = new Map<number, Map<number, { group: string, members: string[] }>>()
  for (const r of rows) {
    let groups = byItem.get(r.itemId)
    if (!groups) {
      groups = new Map()
      byItem.set(r.itemId, groups)
    }
    let entry = groups.get(r.groupId)
    if (!entry) {
      entry = { group: r.groupName, members: [] }
      groups.set(r.groupId, entry)
    }
    entry.members.push(r.username)
  }

  const result = new Map<number, Array<{ group: string, members: string[] }>>()
  for (const [itemId, groups] of byItem) {
    result.set(itemId, [...groups.values()])
  }
  return result
}

export interface ChestCatalogItem {
  // Identité stable de l'item, partagée entre joueurs (GUID du fichier image).
  // Pas le #Name (qui est par exemplaire/joueur).
  key: string
  category: string
  subcategory: string | null
  name: string
  description: string | null
  image: string | null
}

/**
 * Catalogue complet des items du coffre (non lié à un utilisateur), trié par
 * catégorie (ordre du jeu) puis ordre d'import. Pour les endpoints agent.
 */
export function getChestCatalog(): ChestCatalogItem[] {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT uid, item_key, category, subcategory, name, description, image, sort_order as sortOrder
    FROM chest_items
  `).all() as Array<{
    uid: string
    item_key: string | null
    category: string
    subcategory: string | null
    name: string
    description: string | null
    image: string | null
    sortOrder: number
  }>

  rows.sort(compareChestRows)

  return rows.map(r => ({
    key: r.item_key || r.uid,
    category: r.category,
    subcategory: r.subcategory,
    name: r.name,
    description: r.description,
    image: r.image
  }))
}

// ---- Traductions des libellés de catégories / sous-catégories du coffre ----

export interface ChestTaxonomyCategory {
  category: string
  subcategories: string[]
}

/**
 * Catégories et sous-catégories présentes dans le catalogue, dans l'ordre du jeu
 * (catégorie) puis alphabétique (sous-catégories).
 */
export function getChestTaxonomy(): ChestTaxonomyCategory[] {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT DISTINCT category, subcategory FROM chest_items
  `).all() as Array<{ category: string, subcategory: string | null }>

  const byCategory = new Map<string, Set<string>>()
  for (const row of rows) {
    let set = byCategory.get(row.category)
    if (!set) {
      set = new Set<string>()
      byCategory.set(row.category, set)
    }
    if (row.subcategory) set.add(row.subcategory)
  }

  return [...byCategory.keys()]
    .sort((a, b) => (chestCategoryRank(a) - chestCategoryRank(b)) || a.localeCompare(b))
    .map(category => ({
      category,
      subcategories: [...byCategory.get(category)!].sort((a, b) => a.localeCompare(b))
    }))
}

export interface ChestTaxonomyTranslations {
  categories: Record<string, Record<string, string | null>>
  subcategories: Record<string, Record<string, Record<string, string | null>>>
}

/** Toutes les traductions de taxonomie, indexées pour lookup (catégories + sous-catégories). */
export function getChestTaxonomyTranslations(): ChestTaxonomyTranslations {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT category, subcategory, locale, name FROM chest_taxonomy_translations
  `).all() as Array<{ category: string, subcategory: string, locale: string, name: string | null }>

  const result: ChestTaxonomyTranslations = { categories: {}, subcategories: {} }
  for (const r of rows) {
    if (r.subcategory === '') {
      let bucket = result.categories[r.category]
      if (!bucket) {
        bucket = {}
        result.categories[r.category] = bucket
      }
      bucket[r.locale] = r.name
    } else {
      let subMap = result.subcategories[r.category]
      if (!subMap) {
        subMap = {}
        result.subcategories[r.category] = subMap
      }
      let bucket = subMap[r.subcategory]
      if (!bucket) {
        bucket = {}
        subMap[r.subcategory] = bucket
      }
      bucket[r.locale] = r.name
    }
  }
  return result
}

export interface ChestTaxonomyTranslationInput {
  category: string
  subcategory?: string
  translations: Array<{ locale: string, name?: string | null }>
}

/** Upsert des traductions de taxonomie (FR/EN/ES). Une traduction vide est supprimée. */
export function setChestTaxonomyTranslations(entries: ChestTaxonomyTranslationInput[]): void {
  const db = getReputationDb()
  const upsert = db.prepare(`
    INSERT INTO chest_taxonomy_translations (category, subcategory, locale, name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(category, subcategory, locale) DO UPDATE SET name = excluded.name
  `)
  const del = db.prepare(`
    DELETE FROM chest_taxonomy_translations WHERE category = ? AND subcategory = ? AND locale = ?
  `)

  const run = db.transaction(() => {
    for (const entry of entries) {
      const category = entry.category?.trim()
      if (!category) continue
      const subcategory = entry.subcategory?.trim() || ''
      for (const t of entry.translations) {
        if (!t.locale || !['fr', 'en', 'es'].includes(t.locale)) continue
        const name = t.name?.trim() || null
        if (!name) {
          del.run(category, subcategory, t.locale)
        } else {
          upsert.run(category, subcategory, t.locale, name)
        }
      }
    }
  })
  run()
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
      e.high_seas_only as highSeasOnly,
      f.key as factionKey,
      c.name as campaignName,
      (SELECT threshold FROM emblem_grade_thresholds WHERE emblem_id = e.id ORDER BY grade DESC LIMIT 1) as maxThreshold
    FROM emblems e
    JOIN campaigns c ON e.campaign_id = c.id
    JOIN factions f ON c.faction_id = f.id
    WHERE f.key = ? AND e.validated = 1
    ORDER BY c.sort_order, c.id, e.sort_order, e.id
  `).all(factionKey) as Array<Omit<EmblemInfo, 'gradeThresholds' | 'highSeasOnly'> & { highSeasOnly: number }>

  // Récupérer tous les seuils de grades pour ces emblèmes
  const emblemIds = emblemRows.map(e => e.id)
  const allGradeThresholds = getAllGradeThresholdsForEmblems(emblemIds)

  return emblemRows.map(emblem => ({
    ...emblem,
    highSeasOnly: !!emblem.highSeasOnly,
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

export interface EmblemDetail {
  id: number
  name: string
  description: string
  image: string | null
  maxGrade: number
  highSeasOnly: boolean
  gradeThresholds: Array<{ grade: number, threshold: number }>
  progress: { value: number, threshold: number, grade: number, completed: boolean } | null
}

/**
 * Détail d'un emblème pour sa popup : nom/description localisés, image, paliers de grade,
 * et progression de l'utilisateur (null si non connecté ou sans progression importée).
 */
export function getEmblemDetailForUser(emblemId: number, userId: number | null, locale = 'fr'): EmblemDetail | null {
  const db = getReputationDb()
  const row = db.prepare(`
    SELECT
      e.id as id,
      COALESCE(NULLIF(et.name, ''), e.name) as name,
      COALESCE(NULLIF(et.description, ''), e.description) as description,
      e.image as image,
      e.max_grade as maxGrade,
      e.high_seas_only as highSeasOnly
    FROM emblems e
    LEFT JOIN emblem_translations et ON et.emblem_id = e.id AND et.locale = ?
    WHERE e.id = ?
  `).get(locale, emblemId) as { id: number, name: string, description: string | null, image: string | null, maxGrade: number, highSeasOnly: number } | undefined
  if (!row) return null
  const gradeThresholds = db.prepare(`
    SELECT grade, threshold FROM emblem_grade_thresholds WHERE emblem_id = ? ORDER BY grade
  `).all(emblemId) as Array<{ grade: number, threshold: number }>
  let progress: EmblemDetail['progress'] = null
  if (userId) {
    const p = db.prepare(`
      SELECT value, threshold, grade, completed FROM user_emblems WHERE emblem_id = ? AND user_id = ?
    `).get(emblemId, userId) as { value: number, threshold: number, grade: number, completed: number } | undefined
    if (p) progress = { value: p.value, threshold: p.threshold, grade: p.grade, completed: !!p.completed }
  }
  return { id: row.id, name: row.name, description: row.description ?? '', image: row.image, maxGrade: row.maxGrade, highSeasOnly: !!row.highSeasOnly, gradeThresholds, progress }
}

// Marqueur de chemin commun aux URLs d'images d'emblèmes (le GUID/fichier suit).
const EMBLEM_IMAGE_MARKER = '/Emblem/'

export interface EmblemImagePrefix { prefix: string, count: number, sampleImage: string }

/**
 * Préfixes distincts (domaine + segment de version) des URLs d'images d'emblèmes,
 * avec le nombre d'emblèmes et une image-exemple par préfixe. Permet à l'admin de
 * repérer visuellement les versions périmées (image cassée) vs la version courante.
 */
export function getEmblemImagePrefixes(): EmblemImagePrefix[] {
  const db = getReputationDb()
  const rows = db.prepare(`SELECT image FROM emblems WHERE image IS NOT NULL AND image != ''`).all() as Array<{ image: string }>
  const map = new Map<string, { count: number, sample: string }>()
  for (const r of rows) {
    const idx = r.image.indexOf(EMBLEM_IMAGE_MARKER)
    if (idx === -1) continue
    const prefix = r.image.slice(0, idx)
    const e = map.get(prefix)
    if (e) e.count++
    else map.set(prefix, { count: 1, sample: r.image })
  }
  return [...map.entries()]
    .map(([prefix, v]) => ({ prefix, count: v.count, sampleImage: v.sample }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Réécrit les URLs d'images d'emblèmes vers `targetPrefix` (domaine + version courants),
 * en conservant la partie « /Emblem/.../GUID.png ». dryRun = aperçu (rien écrit).
 */
export function refreshEmblemImagesToPrefix(targetPrefix: string, dryRun: boolean): { changed: number, total: number } {
  const db = getReputationDb()
  const clean = targetPrefix.replace(/\/+$/, '') // retire un éventuel slash final
  const rows = db.prepare(`SELECT id, image FROM emblems WHERE image IS NOT NULL AND image != ''`).all() as Array<{ id: number, image: string }>
  const updates: Array<{ id: number, url: string }> = []
  for (const r of rows) {
    const idx = r.image.indexOf(EMBLEM_IMAGE_MARKER)
    if (idx === -1) continue
    const newUrl = clean + r.image.slice(idx)
    if (newUrl !== r.image) updates.push({ id: r.id, url: newUrl })
  }
  if (!dryRun && updates.length) {
    const upd = db.prepare('UPDATE emblems SET image = ? WHERE id = ?')
    const tx = db.transaction(() => {
      for (const u of updates) upd.run(u.url, u.id)
    })
    tx()
  }
  return { changed: updates.length, total: rows.length }
}

export interface HighSeasSyncReport {
  totalEmblems: number
  matched: number // emblèmes rapprochés d'une commendation du wiki
  highSeasCount: number // parmi les rapprochés, ceux marqués High Seas only
  changed: number // emblèmes dont la valeur change réellement
  unmatched: number // emblèmes sans correspondance sur les pages wiki récupérées
  unmatchedNames: string[] // échantillon des emblèmes non rapprochés (diagnostic)
}

/**
 * Applique le flag « High Seas only » aux emblèmes à partir d'une map
 * `nom de commendation normalisé -> highSeasOnly` (construite depuis le wiki).
 * Rapproche par nom EN (ou nom de base) normalisé. Les emblèmes non rapprochés
 * sont laissés inchangés (couverture partielle = pas d'écrasement). dryRun = aperçu.
 */
export function applyEmblemHighSeasOnly(hsMap: Map<string, boolean>, dryRun: boolean): HighSeasSyncReport {
  const db = getReputationDb()
  const rows = db.prepare(`
    SELECT
      e.id as id,
      COALESCE(NULLIF(et.name, ''), e.name) as enName,
      e.name as baseName,
      e.high_seas_only as current
    FROM emblems e
    LEFT JOIN emblem_translations et ON et.emblem_id = e.id AND et.locale = 'en'
  `).all() as Array<{ id: number, enName: string, baseName: string, current: number }>

  let matched = 0
  let highSeasCount = 0
  const unmatchedNames: string[] = []
  const updates: Array<{ id: number, value: number }> = []
  for (const r of rows) {
    let found: boolean | undefined
    for (const k of new Set([normalizeName(r.enName), normalizeName(r.baseName)])) {
      if (hsMap.has(k)) {
        found = hsMap.get(k)
        break
      }
    }
    if (found === undefined) {
      if (unmatchedNames.length < 50) unmatchedNames.push(r.enName)
      continue
    }
    matched++
    const value = found ? 1 : 0
    if (value === 1) highSeasCount++
    if (value !== (r.current ? 1 : 0)) updates.push({ id: r.id, value })
  }

  if (!dryRun && updates.length) {
    const upd = db.prepare('UPDATE emblems SET high_seas_only = ? WHERE id = ?')
    const tx = db.transaction(() => {
      for (const u of updates) upd.run(u.value, u.id)
    })
    tx()
  }

  return {
    totalEmblems: rows.length,
    matched,
    highSeasCount,
    changed: updates.length,
    unmatched: rows.length - matched,
    unmatchedNames
  }
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
          e.high_seas_only as highSeasOnly,
          (SELECT threshold FROM emblem_grade_thresholds WHERE emblem_id = e.id ORDER BY grade DESC LIMIT 1) as maxThreshold
        FROM emblems e
        WHERE e.campaign_id = ? AND e.validated = 1
        ORDER BY e.sort_order, e.id
      `).all(campaign.id) as Array<Omit<EmblemInfo, 'gradeThresholds' | 'factionKey' | 'campaignName' | 'highSeasOnly'> & { highSeasOnly: number }>

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
          userProgress,
          highSeasOnly: !!emblem.highSeasOnly
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
  db.prepare('DELETE FROM user_faction_levels WHERE user_id = ?').run(userId)
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

    // 6. Supprimer les données de réputation et le coffre
    db.prepare('DELETE FROM user_emblems WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM user_faction_levels WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM user_chest_items WHERE user_id = ?').run(userId)

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
    const byLocale = translationsByEmblem[t.emblem_id] ?? (translationsByEmblem[t.emblem_id] = {})
    byLocale[t.locale] = { name: t.name, description: t.description }
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
          e.high_seas_only as highSeasOnly,
          (SELECT threshold FROM emblem_grade_thresholds WHERE emblem_id = e.id ORDER BY grade DESC LIMIT 1) as maxThreshold
        FROM emblems e
        WHERE e.campaign_id = ? AND e.validated = 1
        ORDER BY e.sort_order, e.id
      `).all(campaign.id) as Array<Omit<EmblemInfo, 'gradeThresholds' | 'factionKey' | 'campaignName' | 'highSeasOnly'> & { highSeasOnly: number }>

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
          translations: translationsByEmblem[emblem.id] || {},
          highSeasOnly: !!emblem.highSeasOnly
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
    const grades = result[row.emblemId] ?? (result[row.emblemId] = [])
    grades.push({ grade: row.grade, threshold: row.threshold })
  }
  return result
}
