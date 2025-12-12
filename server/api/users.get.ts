import { getAllUsers } from '../utils/reputation-db'

export default defineEventHandler(() => {
  return getAllUsers()
})
