<script setup lang="ts">
import { generateBookmarkletCode, minifyBookmarkletCode } from '~/utils/bookmarklet'

useSeoMeta({
  title: 'Tutoriel - Recuperer ses donnees de reputation Sea of Thieves',
  description: 'Guide etape par etape pour exporter vos donnees de reputation depuis Sea of Thieves'
})

const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl || 'https://reputations.sot.powange.com'

// Code du bookmarklet
const bookmarkletCode = computed(() => generateBookmarkletCode(siteUrl))
const bookmarkletUrl = computed(() => minifyBookmarkletCode(bookmarkletCode.value))

const toast = useToast()
const copied = ref(false)

async function copyBookmarklet() {
  try {
    await navigator.clipboard.writeText(bookmarkletUrl.value)
    copied.value = true
    toast.add({
      title: 'Copie !',
      description: 'Code du bookmarklet copie dans le presse-papier',
      color: 'success'
    })
    setTimeout(() => copied.value = false, 3000)
  } catch {
    toast.add({
      title: 'Erreur',
      description: 'Impossible de copier',
      color: 'error'
    })
  }
}

const activeTab = ref('bookmarklet')

// Gérer l'ancre dans l'URL pour ouvrir la bonne tab
onMounted(() => {
  const hash = window.location.hash.slice(1)
  if (hash === 'bookmarklet' || hash === 'manual') {
    activeTab.value = hash
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
        Comment recuperer ses donnees de reputation
      </h1>
      <p class="text-muted mt-2">
        Deux methodes pour exporter vos donnees depuis Sea of Thieves
      </p>
    </div>

    <!-- Avertissement -->
    <UAlert
      icon="i-lucide-shield-check"
      color="success"
      title="Vos donnees restent privees"
      class="mb-8"
    >
      <template #description>
        Ces methodes utilisent uniquement vos propres donnees depuis le site officiel.
        Aucun mot de passe ou cookie n'est partage.
      </template>
    </UAlert>

    <!-- Onglets -->
    <UTabs
      v-model="activeTab"
      :items="[
        { label: 'Bookmarklet (Recommande)', slot: 'bookmarklet', icon: 'i-lucide-bookmark' },
        { label: 'Methode manuelle', slot: 'manual', icon: 'i-lucide-code' }
      ]"
      class="mb-6"
    >
      <!-- Onglet Bookmarklet -->
      <template #bookmarklet>
        <div class="space-y-6 mt-6">
          <!-- Etape 1 -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 class="text-lg font-semibold">
                  Installer le bookmarklet
                </h3>
              </div>
            </template>

            <p class="mb-4">
              Faites glisser ce bouton vers votre barre de favoris :
            </p>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
              <a
                :href="bookmarkletUrl"
                draggable="true"
                class="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium cursor-grab active:cursor-grabbing select-none"
                @click.prevent
              >
                <span>⚓</span>
                <span>SoT Reputations</span>
              </a>
              <span class="text-muted text-sm">
                ← Glissez vers votre barre de favoris
              </span>
            </div>

            <UAlert
              icon="i-lucide-info"
              color="info"
              class="mb-4"
            >
              <template #title>Le glisse-depose ne fonctionne pas ?</template>
              <template #description>
                <ol class="list-decimal list-inside space-y-1 mt-2 text-sm">
                  <li>Cliquez sur "Copier le code" ci-dessous</li>
                  <li>Clic droit sur votre barre de favoris → "Ajouter une page" ou "Ajouter un favori"</li>
                  <li>Donnez un nom (ex: "SoT Reputations")</li>
                  <li>Collez le code dans le champ URL/Adresse</li>
                </ol>
              </template>
            </UAlert>

            <UButton
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? 'Copie !' : 'Copier le code'"
              variant="outline"
              size="sm"
              @click="copyBookmarklet"
            />
          </UCard>

          <!-- Etape 2 -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 class="text-lg font-semibold">
                  Aller sur Sea of Thieves
                </h3>
              </div>
            </template>

            <p class="mb-4">
              Rendez-vous sur la page de reputation du site officiel et connectez-vous avec votre compte Xbox.
            </p>

            <UButton
              href="https://www.seaofthieves.com/profile/reputation"
              target="_blank"
              icon="i-lucide-external-link"
              label="Ouvrir Sea of Thieves"
            />

            <UAlert
              icon="i-lucide-globe"
              color="warning"
              class="mt-4"
            >
              <template #title>
                Mettez le site en francais
              </template>
              <template #description>
                Le selecteur de langue se trouve en bas de page. C'est important pour que l'import fonctionne correctement.
              </template>
            </UAlert>
          </UCard>

          <!-- Etape 3 -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 class="text-lg font-semibold">
                  Cliquer sur le bookmarklet
                </h3>
              </div>
            </template>

            <p class="mb-4">
              Une fois connecte sur seaofthieves.com, cliquez sur le bookmarklet dans votre barre de favoris.
              Une fenetre s'affichera avec deux options :
            </p>

            <div class="grid sm:grid-cols-2 gap-4">
              <div class="p-4 bg-muted/50 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                  <UIcon name="i-lucide-download" class="w-5 h-5 text-primary" />
                  <span class="font-medium">Importer sur le site</span>
                </div>
                <p class="text-sm text-muted">
                  Envoie directement vos donnees sur notre site. Vous serez redirige pour finaliser l'import.
                </p>
              </div>

              <div class="p-4 bg-muted/50 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                  <UIcon name="i-lucide-clipboard" class="w-5 h-5 text-primary" />
                  <span class="font-medium">Copier les donnees</span>
                </div>
                <p class="text-sm text-muted">
                  Copie le JSON dans votre presse-papier pour l'importer manuellement plus tard.
                </p>
              </div>
            </div>
          </UCard>
        </div>
      </template>

      <!-- Onglet Methode manuelle -->
      <template #manual>
        <div class="space-y-6 mt-6">
          <UAlert
            icon="i-lucide-info"
            color="info"
          >
            <template #description>
              Cette methode est plus technique mais fonctionne sur tous les navigateurs.
            </template>
          </UAlert>

          <UCard>
            <template #header>
              <h3 class="font-semibold">
                Etapes detaillees
              </h3>
            </template>

            <ol class="space-y-4">
              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">1</span>
                <div>
                  <p class="font-medium">
                    Aller sur seaofthieves.com
                  </p>
                  <p class="text-sm text-muted">
                    Rendez-vous sur la
                    <a href="https://www.seaofthieves.com/profile/reputation" target="_blank" class="text-primary hover:underline">page de reputation</a>
                    et connectez-vous.
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">2</span>
                <div>
                  <p class="font-medium">
                    Mettre le site en francais
                  </p>
                  <p class="text-sm text-muted">
                    Selecteur de langue en bas de page.
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">3</span>
                <div>
                  <p class="font-medium">
                    Ouvrir les DevTools
                  </p>
                  <p class="text-sm text-muted">
                    Appuyez sur
                    <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">F12</kbd>
                    ou
                    <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+Shift+I</kbd>
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">4</span>
                <div>
                  <p class="font-medium">
                    Onglet Network
                  </p>
                  <p class="text-sm text-muted">
                    Cliquez sur l'onglet "Network" ou "Reseau".
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">5</span>
                <div>
                  <p class="font-medium">
                    Rafraichir la page
                  </p>
                  <p class="text-sm text-muted">
                    Appuyez sur
                    <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">F5</kbd>
                    pour recharger.
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">6</span>
                <div>
                  <p class="font-medium">
                    Filtrer par "reputation"
                  </p>
                  <p class="text-sm text-muted">
                    Tapez "reputation" dans la barre de recherche pour trouver la requete
                    <code class="bg-muted px-1 rounded text-xs">/api/profilev2/reputation</code>
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">7</span>
                <div>
                  <p class="font-medium">
                    Copier la reponse JSON
                  </p>
                  <p class="text-sm text-muted">
                    Cliquez sur la requete, allez dans l'onglet "Response" et copiez tout le contenu (Ctrl+A puis Ctrl+C).
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">8</span>
                <div>
                  <p class="font-medium">
                    Importer sur notre site
                  </p>
                  <p class="text-sm text-muted">
                    Retournez sur la page "Mes reputations" et collez le JSON dans le champ d'import.
                  </p>
                </div>
              </li>
            </ol>
          </UCard>

          <!-- Exemple de JSON -->
          <UCard>
            <template #header>
              <h3 class="font-semibold">
                Exemple de JSON attendu
              </h3>
            </template>

            <pre class="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto">{
  "AthenasFortune": {
    "Motto": "Les mers nous appartiennent",
    "Level": 501,
    "Emblems": { ... }
  },
  "GoldHoarders": { ... },
  ...
}</pre>
          </UCard>
        </div>
      </template>
    </UTabs>
  </UContainer>
</template>
