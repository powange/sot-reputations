export function useAuth() {
  const { loggedIn, user, clear, fetch: fetchSession } = useUserSession()

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

  // Impersonation (admin) : l'admin d'origine si on est en train d'en impersonner un autre.
  const impersonatedBy = computed(() => {
    const u = user.value as { impersonatedBy?: { id: number, username: string } } | null
    return u?.impersonatedBy ?? null
  })

  async function impersonate(userId: number) {
    await $fetch('/api/admin/impersonate', { method: 'POST', body: { userId } })
    await fetchSession()
  }

  async function stopImpersonate() {
    await $fetch('/api/auth/stop-impersonate', { method: 'POST' })
    await fetchSession()
  }

  return {
    user: computed(() => user.value as { id: number, username: string, microsoftId?: string, isAdmin?: boolean, isModerator?: boolean, impersonatedBy?: { id: number, username: string } } | null),
    impersonatedBy,
    impersonate,
    stopImpersonate,
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
