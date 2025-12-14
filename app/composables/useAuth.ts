interface User {
  id: number
  username: string
}

export function useAuth() {
  const user = useState<User | null>('auth-user', () => null)
  const isAuthenticated = computed(() => !!user.value)
  const isLoading = useState('auth-loading', () => true)

  async function fetchUser() {
    try {
      const response = await $fetch<{ user: User | null }>('/api/auth/me')
      user.value = response.user
    } catch {
      user.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function login(username: string, password: string) {
    const response = await $fetch<{ success: boolean, user: User }>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    })
    user.value = response.user
    return response
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return {
    user: readonly(user),
    isAuthenticated,
    isLoading: readonly(isLoading),
    fetchUser,
    login,
    logout
  }
}
