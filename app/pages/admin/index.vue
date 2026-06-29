<script setup lang="ts">
const { t } = useI18n()
const { isAdmin, isAdminOrModerator, isAuthenticated, saveRedirectUrl } = useAuth()

useSeoMeta({
  title: () => `${t('admin.title')} - SoT Reputations`
})

// Redirection si non admin/moderateur
watchEffect(() => {
  if (import.meta.client) {
    if (!isAuthenticated.value) {
      saveRedirectUrl()
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

    <div class="space-y-10">
      <!-- Connexion - Admin seulement -->
      <section v-if="isAdmin">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted mb-3 flex items-center gap-2">
          <UIcon
            name="i-lucide-log-in"
            class="w-4 h-4"
          />
          Connexion
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Utilisateurs -->
          <NuxtLink
            to="/admin/utilisateurs"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-users"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">{{ $t('admin.users.title') }}</h3>
                  <p class="text-sm text-muted">{{ $t('admin.users.description') }}</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Jetons d'API -->
          <NuxtLink
            to="/admin/api-tokens"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-key-round"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">Jetons d'API</h3>
                  <p class="text-sm text-muted">Gérer les accès des agents externes (IA)</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>

      <!-- Factions et accomplissements - Admin et Moderateurs -->
      <section>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted mb-3 flex items-center gap-2">
          <UIcon
            name="i-lucide-flag"
            class="w-4 h-4"
          />
          Factions et accomplissements
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Factions -->
          <NuxtLink
            to="/admin/factions"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-flag"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">{{ $t('admin.factions.title') }}</h3>
                  <p class="text-sm text-muted">{{ $t('admin.factions.description') }}</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Édition des factions -->
          <NuxtLink
            to="/admin/factions-edition"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-pencil"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">Éditer les factions</h3>
                  <p class="text-sm text-muted">Nom, devise et traductions (EN/ES) des factions</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Traductions -->
          <NuxtLink
            to="/admin/traductions"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-languages"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">Traductions</h3>
                  <p class="text-sm text-muted">Traduire les accomplissements</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Synchro wiki des emblèmes (High Seas only) -->
          <NuxtLink
            v-if="isAdmin"
            to="/admin/wiki-emblems"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-waves"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">Synchro wiki des emblèmes</h3>
                  <p class="text-sm text-muted">Récupérer le flag « High Seas only » des commendations depuis le wiki</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>

      <!-- Coffres - Admin et Moderateurs -->
      <section>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted mb-3 flex items-center gap-2">
          <UIcon
            name="i-lucide-box"
            class="w-4 h-4"
          />
          Coffres
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Catégories du coffre -->
          <NuxtLink
            to="/admin/chest-taxonomy"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-tags"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">Catégories du coffre</h3>
                  <p class="text-sm text-muted">Traduire les catégories et sous-catégories d'objets</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Couleurs du coffre -->
          <NuxtLink
            to="/admin/chest-colors"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-palette"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">Couleurs du coffre</h3>
                  <p class="text-sm text-muted">Extraire les couleurs principales des objets</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Coûts du coffre -->
          <NuxtLink
            to="/admin/chest-costs"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-coins"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">Données wiki du coffre</h3>
                  <p class="text-sm text-muted">Récupérer les données des objets depuis le wiki Sea of Thieves (coûts, prérequis)</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>

          <!-- Traductions des objets -->
          <NuxtLink
            to="/admin/chest-item-translations"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-languages"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">Traductions des objets</h3>
                  <p class="text-sm text-muted">Corriger les noms EN / ES des objets du coffre</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>

      <!-- Notes de version - Admin seulement -->
      <section v-if="isAdmin">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted mb-3 flex items-center gap-2">
          <UIcon
            name="i-lucide-scroll-text"
            class="w-4 h-4"
          />
          Notes de version
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Notes de version -->
          <NuxtLink
            to="/admin/release-notes"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-primary/10">
                  <UIcon
                    name="i-lucide-scroll-text"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">Notes de version</h3>
                  <p class="text-sm text-muted">Importer les notes de mise à jour depuis le site SoT</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>

      <!-- Système - Admin seulement -->
      <section v-if="isAdmin">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted mb-3 flex items-center gap-2">
          <UIcon
            name="i-lucide-settings"
            class="w-4 h-4"
          />
          Système
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Base de donnees -->
          <NuxtLink
            to="/admin/database"
            class="block"
          >
            <UCard class="hover:ring-2 hover:ring-primary transition-all cursor-pointer h-full">
              <div class="flex items-center gap-4">
                <div class="p-3 rounded-lg bg-warning/10">
                  <UIcon
                    name="i-lucide-database"
                    class="w-6 h-6 text-warning"
                  />
                </div>
                <div>
                  <h3 class="font-semibold">{{ $t('admin.database.title') }}</h3>
                  <p class="text-sm text-muted">{{ $t('admin.database.description') }}</p>
                </div>
              </div>
            </UCard>
          </NuxtLink>
        </div>
      </section>
    </div>
  </UContainer>
</template>
