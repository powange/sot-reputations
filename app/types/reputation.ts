// Types partagés pour les données de réputation

export interface GradeThreshold {
  grade: number
  threshold: number
}

export interface FactionInfo {
  id: number
  key: string
  name: string
  motto: string
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

export interface CampaignInfo {
  id: number
  key: string
  name: string
  description: string
  factionId: number
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
}

export interface MultiUserTableRow extends BaseTableRow {
  [key: string]: string | number | boolean | null | undefined | GradeThreshold[]
}
