import { getMerrickQuest } from '../../../utils/merrick-db'

export default defineEventHandler((event) => {
  const quest = getMerrickQuest(getRouterParam(event, 'token') ?? '')
  if (!quest) {
    throw createError({ statusCode: 404, message: 'Liste introuvable' })
  }
  return quest
})
