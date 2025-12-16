<script setup lang="ts">
const { isAdmin, isAuthenticated } = useAuth()

useSeoMeta({
  title: 'Administration - SoT Reputations'
})

// Redirection si non admin
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value) {
      navigateTo('/')
    } else if (!isAdmin.value) {
      navigateTo('/')
    }
  }
})
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8">
      <UButton
        to="/"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Retour"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        Administration
      </h1>
      <p class="text-muted mt-2">
        Gestion du site
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <UCard
        as="NuxtLink"
        to="/admin/utilisateurs"
        class="hover:ring-2 hover:ring-primary transition-all"
      >
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-lg bg-primary/10">
            <UIcon name="i-lucide-users" class="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 class="font-semibold">Utilisateurs</h3>
            <p class="text-sm text-muted">Voir tous les utilisateurs et leurs groupes</p>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
