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

  // Connexion via Microsoft/Xbox
  function loginWithMicrosoft() {
    window.location.href = '/auth/microsoft'
  }

  return {
    user: computed(() => user.value as { id: number, username: string, microsoftId?: string } | null),
    isAuthenticated,
    isLoading: readonly(isLoading),
    fetchUser,
    login,
    logout,
    loginWithMicrosoft
  }
}
