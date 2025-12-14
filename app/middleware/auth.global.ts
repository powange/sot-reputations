export default defineNuxtRouteMiddleware(async () => {
  const { fetchUser, isLoading } = useAuth()

  // Ne charger l'utilisateur qu'une seule fois
  if (isLoading.value) {
    await fetchUser()
  }
})
