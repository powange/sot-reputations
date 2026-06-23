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
  // N'attacher le contexte user (= lire la session) que pour les routes /api qui en
  // ont besoin. Lire la session réécrit le cookie nuxt-session à chaque requête ;
  // or @nuxt/image déclenche ~60 requêtes /_ipx en parallèle par page, dont la
  // réécriture concurrente du cookie faisait perdre la session (déconnexion à la
  // navigation). Les assets / images optimisées n'ont jamais besoin du user.
  if (!event.path.startsWith('/api/')) return

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
