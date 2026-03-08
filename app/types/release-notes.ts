export interface ReleaseNote {
  id: number
  version: string
  display_version: string | null
  date: string
  content: string | null
}
