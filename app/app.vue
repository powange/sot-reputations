<script setup lang="ts">
const { user, isAuthenticated, isAdminOrModerator, logout, loginWithMicrosoft, impersonatedBy, stopImpersonate } = useAuth()
const toast = useToast()
const { t, locale, locales, setLocale } = useI18n()

// Fin d'impersonation : retour au compte admin d'origine.
const stoppingImpersonation = ref(false)
async function handleStopImpersonate() {
  stoppingImpersonation.value = true
  try {
    await stopImpersonate()
    await navigateTo('/admin/utilisateurs')
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    stoppingImpersonation.value = false
  }
}

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
    { label: isAuthenticated.value ? t('nav.myReputations') : t('reputations.publicTitle'), to: '/reputations', icon: 'i-lucide-trophy', requiresAuth: false, requiresAdmin: false },
    { label: isAuthenticated.value ? t('nav.yourChest') : t('yourChest.publicTitle'), to: '/chest', icon: 'i-lucide-package', requiresAuth: false, requiresAdmin: false },
    { label: t('nav.myGroups'), to: '/', icon: 'i-lucide-users', requiresAuth: true, requiresAdmin: false },
    { label: t('nav.tutorial'), to: '/tutoriel', icon: 'i-lucide-help-circle', requiresAuth: false, requiresAdmin: false },
    { label: t('nav.releaseNotes'), to: '/release-notes', icon: 'i-lucide-scroll-text', requiresAuth: false, requiresAdmin: false },
    { label: t('nav.admin'), to: '/admin', icon: 'i-lucide-shield', requiresAuth: true, requiresAdmin: true }
  ]
  return items.filter((item) => {
    if (item.requiresAdmin && !isAdminOrModerator.value) return false
    if (item.requiresAuth && !isAuthenticated.value) return false
    return true
  })
})

// Sélecteur de langue
const availableLocales = computed(() => {
  return locales.value.filter(l => typeof l === 'object')
})

// Overlay de chargement pour les navigations longues : la fine barre du haut
// peut passer inaperçue, on affiche en plus un voile « Chargement… » si le
// changement de page dépasse ~350 ms (en deçà, on évite le clignotement).
const navLoading = ref(false)
if (import.meta.client) {
  const nuxtApp = useNuxtApp()
  let navTimer: ReturnType<typeof setTimeout> | null = null
  nuxtApp.hook('page:loading:start', () => {
    if (navTimer) clearTimeout(navTimer)
    navTimer = setTimeout(() => {
      navLoading.value = true
    }, 350)
  })
  nuxtApp.hook('page:loading:end', () => {
    if (navTimer) {
      clearTimeout(navTimer)
      navTimer = null
    }
    navLoading.value = false
  })
}

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
    <!-- Barre de chargement lors des changements de page -->
    <NuxtLoadingIndicator
      color="var(--ui-primary)"
      :height="4"
    />

    <!-- Easter egg: Konami code -->
    <SharkEasterEgg />

    <!-- Voile de chargement pour les navigations longues -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="navLoading"
        class="fixed inset-0 z-100 flex items-center justify-center bg-default/70 backdrop-blur-sm pointer-events-none"
      >
        <div class="flex flex-col items-center gap-3 rounded-xl bg-default px-6 py-5 shadow-lg ring ring-default">
          <UIcon
            name="i-lucide-loader-2"
            class="w-8 h-8 animate-spin text-primary"
          />
          <span class="text-sm text-muted">{{ t('common.loading') }}</span>
        </div>
      </div>
    </Transition>

    <!-- Bannière d'impersonation (admin connecté en tant qu'un autre utilisateur) -->
    <div
      v-if="impersonatedBy"
      class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm text-white dark:bg-amber-600"
    >
      <span class="flex items-center gap-1.5">
        <UIcon
          name="i-lucide-eye"
          class="w-4 h-4"
        />
        Connecté en tant que <strong>{{ user?.username }}</strong>
      </span>
      <UButton
        size="xs"
        color="neutral"
        variant="solid"
        icon="i-lucide-log-out"
        :loading="stoppingImpersonation"
        :label="`Revenir à ${impersonatedBy.username}`"
        @click="handleStopImpersonate"
      />
    </div>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-anchor"
            class="w-6 h-6 text-primary"
          />
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
          <UIcon
            :name="item.icon"
            class="w-4 h-4"
          />
          {{ item.label }}
        </ULink>
        <button
          v-if="!isAuthenticated"
          class="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
          @click="loginWithMicrosoft"
        >
          <UIcon
            name="i-lucide-log-in"
            class="w-4 h-4"
          />
          {{ t('nav.login') }}
        </button>
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
            <UIcon
              :name="item.icon"
              class="w-5 h-5"
            />
            {{ item.label }}
          </ULink>
          <button
            v-if="isAuthenticated"
            class="flex items-center gap-2 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            @click="handleLogout"
          >
            <UIcon
              name="i-lucide-log-out"
              class="w-5 h-5"
            />
            {{ t('nav.logout') }}
          </button>
          <button
            v-else
            class="flex items-center gap-2 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            @click="loginWithMicrosoft"
          >
            <UIcon
              name="i-lucide-log-in"
              class="w-5 h-5"
            />
            {{ t('nav.login') }}
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
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-globe"
            />
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
        <NuxtLink
          to="/mentions-legales"
          class="text-sm text-muted hover:text-foreground transition-colors"
        >
          {{ $t('legal.title') }}
        </NuxtLink>
      </template>
    </UFooter>
  </UApp>
</template>
