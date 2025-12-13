<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
  ],
  htmlAttrs: {
    lang: 'fr'
  }
})

const title = 'Reputations Sea of Thieves'
const description = 'Comparez votre progression de reputation avec les autres pirates de Sea of Thieves.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

const navItems = [
  { label: 'Reputations', to: '/', icon: 'i-lucide-trophy' },
  { label: 'Tutoriel', to: '/tutoriel', icon: 'i-lucide-help-circle' }
]
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink to="/" class="flex items-center gap-2">
          <UIcon name="i-lucide-anchor" class="w-6 h-6 text-primary" />
          <span class="font-pirate text-xl">SoT Reputations</span>
        </NuxtLink>
      </template>

      <nav class="hidden md:flex items-center gap-4">
        <ULink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          active-class="text-primary"
          inactive-class="text-muted hover:text-foreground"
          class="flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <UIcon :name="item.icon" class="w-4 h-4" />
          {{ item.label }}
        </ULink>
      </nav>

      <template #body>
        <nav class="flex flex-col gap-2 p-4">
          <ULink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            active-class="text-primary"
            inactive-class="text-muted hover:text-foreground"
            class="flex items-center gap-2 py-2 text-sm font-medium transition-colors"
          >
            <UIcon :name="item.icon" class="w-5 h-5" />
            {{ item.label }}
          </ULink>
        </nav>
      </template>

      <template #right>
        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          SoT Reputations - Outil de suivi des progressions
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
