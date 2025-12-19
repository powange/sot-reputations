<script setup lang="ts">
const { t } = useI18n()
const { isAdmin, isAdminOrModerator, isAuthenticated } = useAuth()

useSeoMeta({
  title: () => `${t('admin.title')} - SoT Reputations`
})

// Redirection si non admin/moderateur
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value) {
      navigateTo('/')
    } else if (!isAdminOrModerator.value) {
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
        :label="$t('common.back')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        {{ $t('admin.title') }}
      </h1>
      <p class="text-muted mt-2">
        {{ $t('admin.subtitle') }}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <!-- Utilisateurs - Admin seulement -->
      <NuxtLink v-if="isAdmin" to="/admin/utilisateurs" class="block">
        <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
          <div class="flex items-center gap-4">
            <div class="p-3 rounded-lg bg-primary/10">
              <UIcon name="i-lucide-users" class="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold">{{ $t('admin.users.title') }}</h3>
              <p class="text-sm text-muted">{{ $t('admin.users.description') }}</p>
            </div>
          </div>
        </UCard>
      </NuxtLink>

      <!-- Factions - Admin et Moderateurs -->
      <NuxtLink to="/admin/factions" class="block">
        <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
          <div class="flex items-center gap-4">
            <div class="p-3 rounded-lg bg-primary/10">
              <UIcon name="i-lucide-flag" class="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold">{{ $t('admin.factions.title') }}</h3>
              <p class="text-sm text-muted">{{ $t('admin.factions.description') }}</p>
            </div>
          </div>
        </UCard>
      </NuxtLink>

      <!-- Base de donnees - Admin seulement -->
      <NuxtLink v-if="isAdmin" to="/admin/database" class="block">
        <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
          <div class="flex items-center gap-4">
            <div class="p-3 rounded-lg bg-warning/10">
              <UIcon name="i-lucide-database" class="w-6 h-6 text-warning" />
            </div>
            <div>
              <h3 class="font-semibold">{{ $t('admin.database.title') }}</h3>
              <p class="text-sm text-muted">{{ $t('admin.database.description') }}</p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </UContainer>
</template>
