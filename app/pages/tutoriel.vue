<script setup lang="ts">
useSeoMeta({
  title: 'Tutoriel - Recuperer ses donnees de reputation Sea of Thieves',
  description: 'Guide etape par etape pour exporter vos donnees de reputation depuis Sea of Thieves'
})

const steps = [
  {
    title: 'Mettre le site en francais',
    description: 'Rendez-vous sur le site Sea of Thieves. En bas de page, cliquez sur le selecteur de langue et choisissez "Francais". C\'est obligatoire pour que l\'import fonctionne.',
    link: 'https://www.seaofthieves.com/profile/reputation',
    linkLabel: 'Ouvrir Sea of Thieves'
  },
  {
    title: 'Se connecter',
    description: 'Connectez-vous avec votre compte Microsoft/Xbox si ce n\'est pas deja fait.'
  },
  {
    title: 'Ouvrir les outils developpeur',
    description: 'Une fois sur la page de reputation, ouvrez les DevTools de votre navigateur.',
    shortcut: 'F12 ou Ctrl+Shift+I (Windows) / Cmd+Option+I (Mac)'
  },
  {
    title: 'Aller dans l\'onglet Network (Reseau)',
    description: 'Cliquez sur l\'onglet "Network" ou "Reseau" dans les DevTools.'
  },
  {
    title: 'Rafraichir la page',
    description: 'Appuyez sur F5 pour recharger la page. Vous verrez apparaitre des requetes dans la liste.'
  },
  {
    title: 'Trouver la requete "reputation"',
    description: 'Dans la barre de filtre, tapez "reputation" pour trouver la requete API. Cliquez dessus.'
  },
  {
    title: 'Copier la reponse JSON',
    description: 'Allez dans l\'onglet "Response" (Reponse) et copiez tout le contenu JSON (Ctrl+A puis Ctrl+C).'
  },
  {
    title: 'Importer sur notre site',
    description: 'Retournez sur notre page Reputation, cliquez sur "Importer mes donnees" et collez le JSON.'
  }
]

const currentStep = ref(0)

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}
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
        Suivez ce guide etape par etape pour exporter vos donnees depuis Sea of Thieves
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
        Ce tutoriel vous montre comment copier vos propres donnees depuis le site officiel.
        Aucun mot de passe ou cookie n'est requis - vous copiez simplement le JSON affiche par le site.
      </template>
    </UAlert>

    <!-- Progression -->
    <div class="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
      <button
        v-for="(step, index) in steps"
        :key="index"
        class="flex items-center gap-2 shrink-0"
        @click="currentStep = index"
      >
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
          :class="index === currentStep ? 'bg-primary text-white' : index < currentStep ? 'bg-success text-white' : 'bg-gray-200 dark:bg-gray-700'"
        >
          <UIcon
            v-if="index < currentStep"
            name="i-lucide-check"
            class="w-4 h-4"
          />
          <span v-else>{{ index + 1 }}</span>
        </div>
        <div
          v-if="index < steps.length - 1"
          class="w-8 h-0.5"
          :class="index < currentStep ? 'bg-success' : 'bg-gray-200 dark:bg-gray-700'"
        />
      </button>
    </div>

    <!-- Etape courante -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
            {{ currentStep + 1 }}
          </div>
          <h2 class="text-xl font-semibold">
            {{ steps[currentStep].title }}
          </h2>
        </div>
      </template>

      <p class="text-lg mb-4">
        {{ steps[currentStep].description }}
      </p>

      <!-- Lien externe si disponible -->
      <UButton
        v-if="steps[currentStep].link"
        :href="steps[currentStep].link"
        target="_blank"
        icon="i-lucide-external-link"
        :label="steps[currentStep].linkLabel"
        class="mb-4"
      />

      <!-- Raccourci clavier si disponible -->
      <div
        v-if="steps[currentStep].shortcut"
        class="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"
      >
        <UIcon
          name="i-lucide-keyboard"
          class="w-5 h-5 text-muted"
        />
        <code class="text-sm">{{ steps[currentStep].shortcut }}</code>
      </div>

      <!-- Images/GIFs selon l'etape -->
      <div
        v-if="currentStep === 0"
        class="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"
      >
        <p class="text-sm text-muted mb-2">
          Le selecteur de langue se trouve en bas de page :
        </p>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-globe"
            class="w-4 h-4"
          />
          <span class="text-sm">English</span>
          <UIcon
            name="i-lucide-chevron-right"
            class="w-4 h-4"
          />
          <span class="text-sm font-medium text-primary">Francais</span>
        </div>
      </div>

      <div
        v-if="currentStep === 2"
        class="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"
      >
        <p class="text-sm text-muted mb-2">
          Exemple sur Chrome/Edge :
        </p>
        <div class="flex gap-4 flex-wrap">
          <div class="flex items-center gap-2">
            <kbd class="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">F12</kbd>
            <span class="text-sm">Raccourci rapide</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">ou Menu</span>
            <UIcon
              name="i-lucide-chevron-right"
              class="w-4 h-4"
            />
            <span class="text-sm">Plus d'outils</span>
            <UIcon
              name="i-lucide-chevron-right"
              class="w-4 h-4"
            />
            <span class="text-sm">Outils de developpement</span>
          </div>
        </div>
      </div>

      <div
        v-if="currentStep === 3"
        class="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"
      >
        <p class="text-sm text-muted mb-2">
          L'onglet Network ressemble a ceci :
        </p>
        <div class="flex gap-2 border-b border-gray-300 dark:border-gray-600 pb-2">
          <span class="px-3 py-1 text-sm text-muted">Elements</span>
          <span class="px-3 py-1 text-sm text-muted">Console</span>
          <span class="px-3 py-1 text-sm bg-primary text-white rounded">Network</span>
          <span class="px-3 py-1 text-sm text-muted">Sources</span>
        </div>
      </div>

      <div
        v-if="currentStep === 5"
        class="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"
      >
        <p class="text-sm text-muted mb-2">
          Filtrez les requetes :
        </p>
        <div class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-3 py-2">
          <UIcon
            name="i-lucide-search"
            class="w-4 h-4 text-muted"
          />
          <span class="text-sm">reputation</span>
        </div>
        <p class="text-sm text-muted mt-2">
          Vous devriez voir une requete vers <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">/api/profilev2/reputation</code>
        </p>
      </div>

      <div
        v-if="currentStep === 6"
        class="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"
      >
        <p class="text-sm text-muted mb-2">
          Le JSON ressemble a ceci :
        </p>
        <pre class="text-xs bg-gray-200 dark:bg-gray-700 p-3 rounded overflow-x-auto">{
  "AthenasFortune": {
    "Motto": "Les mers nous appartiennent",
    "Level": 501,
    "Emblems": { ... }
  },
  "GoldHoarders": { ... },
  ...
}</pre>
      </div>

      <template #footer>
        <div class="flex justify-between">
          <UButton
            :disabled="currentStep === 0"
            variant="outline"
            icon="i-lucide-arrow-left"
            label="Precedent"
            @click="prevStep"
          />
          <UButton
            v-if="currentStep < steps.length - 1"
            icon="i-lucide-arrow-right"
            trailing
            label="Suivant"
            @click="nextStep"
          />
          <UButton
            v-else
            to="/"
            icon="i-lucide-upload"
            label="Importer mes donnees"
            color="success"
          />
        </div>
      </template>
    </UCard>

    <!-- Resume des etapes -->
    <UCard>
      <template #header>
        <h3 class="font-semibold">
          Resume rapide
        </h3>
      </template>
      <ol class="list-decimal list-inside space-y-2 text-sm">
        <li>
          Allez sur
          <a
            href="https://www.seaofthieves.com/profile/reputation"
            target="_blank"
            class="text-primary hover:underline"
          >seaofthieves.com/profile/reputation</a>
        </li>
        <li><strong class="text-warning">Mettez le site en francais</strong> (selecteur en bas de page)</li>
        <li>Connectez-vous avec votre compte Microsoft/Xbox</li>
        <li>Ouvrez les DevTools (<kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">F12</kbd>)</li>
        <li>Onglet <strong>Network</strong></li>
        <li>Rafraichissez la page (<kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">F5</kbd>)</li>
        <li>Filtrez par "reputation"</li>
        <li>Cliquez sur la requete, onglet <strong>Response</strong></li>
        <li>Copiez tout le JSON</li>
        <li>Collez sur notre page d'import</li>
      </ol>
    </UCard>
  </UContainer>
</template>
