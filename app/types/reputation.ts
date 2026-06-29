// Types partagés pour les données de réputation

export interface GradeThreshold {
  grade: number
  threshold: number
}

export interface FactionTranslation {
  name: string | null
  motto: string | null
}

export interface FactionInfo {
  id: number
  key: string
  name: string
  motto: string
  translations?: Record<string, FactionTranslation>
  // Niveau de réputation de l'utilisateur pour cette faction (capté à l'import).
  // Absent en mode public et tant que l'utilisateur n'a pas importé sa progression.
  level?: number
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

export interface EmblemProgress {
  userId: number
  value: number
  threshold: number
  grade: number
  completed: boolean
}

export interface UserEmblemProgress extends EmblemProgress {
  username: string
}

export interface CampaignTranslation {
  name: string | null
  description: string | null
}

export interface CampaignInfo {
  id: number
  key: string
  name: string
  description: string
  factionId: number
  translations?: Record<string, CampaignTranslation>
}

export interface CampaignWithEmblems<T = EmblemProgress | null> extends CampaignInfo {
  emblems: Array<EmblemInfo & { progress: T }>
}

export interface CampaignWithUserEmblems extends CampaignInfo {
  emblems: Array<EmblemInfo & { userProgress: Record<number, UserEmblemProgress> }>
}

export interface FactionWithCampaigns<T = EmblemProgress | null> extends FactionInfo {
  campaigns: CampaignWithEmblems<T>[]
}

export interface FactionWithUserCampaigns extends FactionInfo {
  campaigns: CampaignWithUserEmblems[]
}

export interface UserInfo {
  id: number
  username: string
  lastImportAt: string | null
}

// Types pour les lignes de tableau
export interface BaseTableRow {
  id: number
  name: string
  description: string
  image: string
  maxGrade: number
  maxThreshold: number | null
  gradeThresholds: GradeThreshold[]
}

export interface SingleUserTableRow extends BaseTableRow {
  progress: string
  completed: boolean
  hasProgress: boolean
  // Valeurs numériques (pour la barre de progression des cards).
  value: number
  threshold: number
  grade: number
  // Commendation jouable uniquement en Haute Mer (High Seas).
  highSeasOnly: boolean
}

export interface MultiUserTableRow extends BaseTableRow {
  [key: string]: string | number | boolean | null | undefined | GradeThreshold[]
}
