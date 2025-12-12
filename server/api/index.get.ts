import { getFullReputationData } from '../utils/reputation-db'

export default defineEventHandler(() => {
  return getFullReputationData()
})
