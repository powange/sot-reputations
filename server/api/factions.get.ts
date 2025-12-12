import { getAllFactions } from '../utils/reputation-db'

export default defineEventHandler(() => {
  return getAllFactions()
})
