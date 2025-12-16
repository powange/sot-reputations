<script setup lang="ts">
useSeoMeta({
  title: 'Tutoriel - Recuperer ses donnees de reputation Sea of Thieves',
  description: 'Guide etape par etape pour exporter vos donnees de reputation depuis Sea of Thieves'
})

const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl || 'https://reputations.sot.powange.com'

// Code du bookmarklet (non minifié pour lisibilité)
const bookmarkletCode = computed(() => {
  return `javascript:(function(){
  const SITE_URL = '${siteUrl}';

  // Créer le style de la modal
  const style = document.createElement('style');
  style.textContent = \`
    .sot-rep-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .sot-rep-modal {
      background: #1a1a2e;
      border: 2px solid #d4af37;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      color: #fff;
      text-align: center;
    }
    .sot-rep-modal h2 {
      color: #d4af37;
      margin: 0 0 8px 0;
      font-size: 24px;
    }
    .sot-rep-modal p {
      color: #aaa;
      margin: 0 0 20px 0;
      font-size: 14px;
    }
    .sot-rep-modal .stats {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 20px;
    }
    .sot-rep-modal .stat {
      text-align: center;
    }
    .sot-rep-modal .stat-value {
      font-size: 28px;
      font-weight: bold;
      color: #d4af37;
    }
    .sot-rep-modal .stat-label {
      font-size: 12px;
      color: #888;
    }
    .sot-rep-modal .buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sot-rep-modal button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
    }
    .sot-rep-modal button:hover {
      transform: scale(1.02);
    }
    .sot-rep-modal button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .sot-rep-modal .btn-primary {
      background: #d4af37;
      color: #1a1a2e;
    }
    .sot-rep-modal .btn-secondary {
      background: #333;
      color: #fff;
      border: 1px solid #555;
    }
    .sot-rep-modal .btn-close {
      background: transparent;
      color: #888;
      font-size: 14px;
    }
    .sot-rep-modal .success {
      color: #4ade80;
    }
    .sot-rep-modal .error {
      color: #f87171;
      font-size: 14px;
      margin-top: 12px;
    }
    .sot-rep-modal .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #fff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: sot-spin 1s linear infinite;
    }
    @keyframes sot-spin {
      to { transform: rotate(360deg); }
    }
  \`;
  document.head.appendChild(style);

  // Créer la modal
  const overlay = document.createElement('div');
  overlay.className = 'sot-rep-modal-overlay';
  overlay.innerHTML = \`
    <div class="sot-rep-modal">
      <h2>⚓ SoT Reputations</h2>
      <p>Chargement des donnees...</p>
      <div class="loading"></div>
    </div>
  \`;
  document.body.appendChild(overlay);

  const modal = overlay.querySelector('.sot-rep-modal');

  // Fermer en cliquant sur l'overlay
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      style.remove();
    }
  });

  // Compter les emblèmes
  function countEmblems(data) {
    let count = 0;
    for (const faction of Object.values(data)) {
      if (faction.Emblems && faction.Emblems.Emblems) {
        count += faction.Emblems.Emblems.length;
      }
      if (faction.Campaigns) {
        for (const campaign of Object.values(faction.Campaigns)) {
          if (campaign.Emblems) {
            count += campaign.Emblems.length;
          }
        }
      }
    }
    return count;
  }

  // Détecter la langue du site depuis l'URL (ex: /fr/, /de/, /es/)
  const langMatch = window.location.pathname.match(/^\\/([a-z]{2})\\//);
  const langPrefix = langMatch ? '/' + langMatch[1] : '';
  const apiUrl = 'https://www.seaofthieves.com' + langPrefix + '/api/profilev2/reputation';

  // Récupérer les données
  fetch(apiUrl, {
    credentials: 'include'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Non connecte' : 'Erreur ' + response.status);
    }
    return response.json();
  })
  .then(data => {
    const factionCount = Object.keys(data).length;
    const emblemCount = countEmblems(data);

    modal.innerHTML = \`
      <h2>⚓ SoT Reputations</h2>
      <p>Donnees recuperees avec succes !</p>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">\${factionCount}</div>
          <div class="stat-label">Factions</div>
        </div>
        <div class="stat">
          <div class="stat-value">\${emblemCount}</div>
          <div class="stat-label">Emblemes</div>
        </div>
      </div>
      <div class="buttons">
        <button class="btn-primary" id="sot-import-btn">
          📥 Importer sur le site
        </button>
        <button class="btn-secondary" id="sot-copy-btn">
          📋 Copier les donnees
        </button>
        <button class="btn-close" id="sot-close-btn">
          Fermer
        </button>
      </div>
      <div id="sot-message"></div>
    \`;

    const messageEl = modal.querySelector('#sot-message');
    const importBtn = modal.querySelector('#sot-import-btn');
    const copyBtn = modal.querySelector('#sot-copy-btn');
    const closeBtn = modal.querySelector('#sot-close-btn');

    // Bouton Importer
    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      importBtn.innerHTML = '<span class="loading"></span>';
      try {
        const response = await fetch(SITE_URL + '/api/import-temp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success && result.code) {
          window.location.href = SITE_URL + '/import/' + result.code;
        } else {
          throw new Error('Erreur serveur');
        }
      } catch (err) {
        messageEl.innerHTML = '<div class="error">Erreur: ' + err.message + '</div>';
        importBtn.disabled = false;
        importBtn.textContent = '📥 Importer sur le site';
      }
    });

    // Bouton Copier
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        messageEl.innerHTML = '<div class="success">✓ Donnees copiees dans le presse-papier !</div>';
      } catch (err) {
        // Fallback pour les navigateurs qui ne supportent pas clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = JSON.stringify(data, null, 2);
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        messageEl.innerHTML = '<div class="success">✓ Donnees copiees dans le presse-papier !</div>';
      }
    });

    // Bouton Fermer
    closeBtn.addEventListener('click', () => {
      overlay.remove();
      style.remove();
    });
  })
  .catch(error => {
    let message = 'Erreur lors de la recuperation des donnees.';
    if (error.message === 'Non connecte') {
      message = 'Vous devez etre connecte a Sea of Thieves.';
    }
    modal.innerHTML = \`
      <h2>⚓ SoT Reputations</h2>
      <p class="error">\${message}</p>
      <p>Assurez-vous d\\'etre connecte sur seaofthieves.com</p>
      <div class="buttons">
        <button class="btn-secondary" onclick="location.href='https://www.seaofthieves.com/profile/reputation'">
          🔑 Se connecter
        </button>
        <button class="btn-close" id="sot-close-btn">
          Fermer
        </button>
      </div>
    \`;
    modal.querySelector('#sot-close-btn').addEventListener('click', () => {
      overlay.remove();
      style.remove();
    });
  });
})();`
})

// Version minifiée pour le bookmarklet
const bookmarkletUrl = computed(() => {
  // Minification sûre : supprime d'abord les lignes de commentaires, puis minifie
  const minified = bookmarkletCode.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.startsWith('//')) // Supprime les lignes de commentaires
    .join(' ')
    .replace(/\s{2,}/g, ' ') // Réduit les espaces multiples
    .trim()
  return minified
})

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
                class="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium cursor-move"
                @click.prevent
              >
                <span>⚓</span>
                <span>SoT Reputations</span>
              </a>
              <span class="text-muted text-sm">
                ← Glissez vers votre barre de favoris
              </span>
            </div>

            <p class="text-sm text-muted mb-2">
              Ou copiez le code et creez un favori manuellement :
            </p>
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
