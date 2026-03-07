export function useAuth() {
  const { loggedIn, user, session, clear, fetch: fetchSession } = useUserSession()

  const isLoading = useState('auth-loading', () => false)

  const isAuthenticated = computed(() => loggedIn.value)

  async function fetchUser() {
    isLoading.value = true
    try {
      await fetchSession()
    } finally {
      isLoading.value = false
    }
  }

  async function login(username: string, password: string) {
    const response = await $fetch<{ success: boolean, user: { id: number, username: string } }>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    })
    // Recharger la session après login
    await fetchSession()
    return response
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
  }

  // Sauvegarder l'URL courante pour y revenir après connexion
  function saveRedirectUrl() {
    const route = useRoute()
    if (route.fullPath !== '/') {
      const cookie = useCookie('redirectTo', { maxAge: 300 })
      cookie.value = route.fullPath
    }
  }

  // Consommer l'URL de redirection après connexion
  function consumeRedirectUrl(): string {
    const cookie = useCookie('redirectTo')
    const url = cookie.value || '/'
    cookie.value = null
    return url
  }

  // Connexion via Microsoft/Xbox
  function loginWithMicrosoft() {
    window.location.href = '/auth/microsoft'
  }

  const isAdmin = computed(() => {
    const u = user.value as { isAdmin?: boolean } | null
    return u?.isAdmin === true
  })

  const isModerator = computed(() => {
    const u = user.value as { isModerator?: boolean } | null
    return u?.isModerator === true
  })

  const isAdminOrModerator = computed(() => isAdmin.value || isModerator.value)

  return {
    user: computed(() => user.value as { id: number, username: string, microsoftId?: string, isAdmin?: boolean, isModerator?: boolean } | null),
    isAuthenticated,
    isAdmin,
    isModerator,
    isAdminOrModerator,
    isLoading: readonly(isLoading),
    fetchUser,
    login,
    logout,
    loginWithMicrosoft,
    saveRedirectUrl,
    consumeRedirectUrl
  }
}
