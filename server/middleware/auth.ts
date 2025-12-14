declare module 'h3' {
  interface H3EventContext {
    user?: {
      id: number
      username: string
      microsoftId?: string
    }
  }
}

export default defineEventHandler(async (event) => {
  // Récupérer la session nuxt-auth-utils et l'attacher au contexte
  const session = await getUserSession(event)
  if (session?.user) {
    event.context.user = session.user as {
      id: number
      username: string
      microsoftId?: string
    }
  }
})
