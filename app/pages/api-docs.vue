<script setup lang="ts">
// Documentation publique de l'API des agents (/api-docs ; /api y redirige).
useSeoMeta({
  title: 'API - SoT Reputations',
  description: 'Documentation de l\'API de SoT Reputations : authentification par jeton, formats JSON et Markdown, points d\'accès et exemples de réponses.'
})
</script>

<template>
  <UContainer class="py-8 max-w-5xl">
    <div class="mb-6">
      <h1 class="text-4xl font-pirate">
        API
      </h1>
      <p class="text-muted mt-2">
        Notes de version, recommandations de réputation et objets du coffre, en lecture seule, pour
        vos outils et agents IA.
      </p>
    </div>
    <UCard>
      <AgentApiDocs token-hint />
    </UCard>
  </UContainer>
</template>
