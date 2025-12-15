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

    <UAlert
      icon="i-lucide-construction"
      color="warning"
      title="En construction"
    >
      <template #description>
        Les fonctionnalites d'administration seront ajoutees prochainement.
      </template>
    </UAlert>
  </UContainer>
</template>
