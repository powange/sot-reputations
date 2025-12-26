<script setup lang="ts">
const { user, isAuthenticated, isAdminOrModerator, logout } = useAuth()
const toast = useToast()
const { t, locale, locales, setLocale } = useI18n()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
  ],
  htmlAttrs: {
    lang: locale
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

const navItems = computed(() => {
  const items = [
    { label: t('nav.myReputations'), to: '/mes-reputations', icon: 'i-lucide-trophy', requiresAuth: true, requiresAdmin: false },
    { label: t('nav.myGroups'), to: '/', icon: 'i-lucide-users', requiresAuth: true, requiresAdmin: false },
    { label: t('nav.tutorial'), to: '/tutoriel', icon: 'i-lucide-help-circle', requiresAuth: false, requiresAdmin: false },
    { label: t('nav.admin'), to: '/admin', icon: 'i-lucide-shield', requiresAuth: true, requiresAdmin: true }
  ]
  return items.filter(item => {
    if (item.requiresAdmin && !isAdminOrModerator.value) return false
    if (item.requiresAuth && !isAuthenticated.value) return false
    return true
  })
})

// Sélecteur de langue
const availableLocales = computed(() => {
  return locales.value.filter(l => typeof l === 'object')
})

async function handleLogout() {
  await logout()
  toast.add({
    title: t('nav.logout'),
    description: t('common.goodbye'),
    color: 'info'
  })
  navigateTo('/')
}
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
          <button
            v-if="isAuthenticated"
            class="flex items-center gap-2 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            @click="handleLogout"
          >
            <UIcon name="i-lucide-log-out" class="w-5 h-5" />
            {{ t('nav.logout') }}
          </button>
        </nav>
      </template>

      <template #right>
        <div class="flex items-center gap-2">
          <template v-if="isAuthenticated">
            <span class="text-sm text-muted hidden sm:inline">{{ user?.username }}</span>
            <UButton
              icon="i-lucide-log-out"
              variant="ghost"
              size="sm"
              :title="t('nav.logout')"
              @click="handleLogout"
            />
          </template>
          <UColorModeSwitch color="info" />
          <UDropdownMenu
            :items="availableLocales.map(l => ({ label: l.name, onSelect: () => setLocale(l.code) }))"
          >
            <UButton variant="ghost" size="sm" icon="i-lucide-globe" />
          </UDropdownMenu>
        </div>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          SoT Reputations
        </p>
      </template>
      <template #right>
        <NuxtLink to="/mentions-legales" class="text-sm text-muted hover:text-foreground transition-colors">
          {{ $t('legal.title') }}
        </NuxtLink>
      </template>
    </UFooter>
  </UApp>
</template>
