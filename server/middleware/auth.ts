import { getSessionFromEvent } from '../utils/session'

declare module 'h3' {
  interface H3EventContext {
    user?: {
      id: number
      username: string
    }
  }
}

export default defineEventHandler((event) => {
  // Attache l'utilisateur au contexte si une session valide existe
  const user = getSessionFromEvent(event)
  if (user) {
    event.context.user = user
  }
})
