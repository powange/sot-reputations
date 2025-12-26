// Version du bookmarklet traductions
export const TRANSLATION_BOOKMARKLET_VERSION = 1

// Génère le code du bookmarklet pour les traductions (récupère FR, EN, ES)
export function generateTranslationBookmarkletCode(siteUrl: string): string {
  return `javascript:(function(){
  const SITE_URL = '${siteUrl}';
  const VERSION = ${TRANSLATION_BOOKMARKLET_VERSION};

  // Créer le style de la modal
  const style = document.createElement('style');
  style.textContent = \`
    .sot-trad-modal-overlay {
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
    .sot-trad-modal {
      background: #1a1a2e;
      border: 2px solid #d4af37;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      color: #fff;
      text-align: center;
    }
    .sot-trad-modal h2 {
      color: #d4af37;
      margin: 0 0 8px 0;
      font-size: 24px;
    }
    .sot-trad-modal p {
      color: #aaa;
      margin: 0 0 20px 0;
      font-size: 14px;
    }
    .sot-trad-modal .progress-container {
      margin: 20px 0;
    }
    .sot-trad-modal .progress-bar {
      height: 8px;
      background: #333;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .sot-trad-modal .progress-fill {
      height: 100%;
      background: #d4af37;
      transition: width 0.3s ease;
    }
    .sot-trad-modal .progress-steps {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .sot-trad-modal .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .sot-trad-modal .step-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: bold;
    }
    .sot-trad-modal .step-pending { background: #333; color: #666; }
    .sot-trad-modal .step-loading { background: #d4af37; color: #1a1a2e; }
    .sot-trad-modal .step-done { background: #4ade80; color: #1a1a2e; }
    .sot-trad-modal .step-error { background: #f87171; color: #1a1a2e; }
    .sot-trad-modal .step-label { color: #888; }
    .sot-trad-modal .stats {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin: 20px 0;
    }
    .sot-trad-modal .stat {
      text-align: center;
    }
    .sot-trad-modal .stat-value {
      font-size: 28px;
      font-weight: bold;
      color: #d4af37;
    }
    .sot-trad-modal .stat-label {
      font-size: 12px;
      color: #888;
    }
    .sot-trad-modal .buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sot-trad-modal button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
    }
    .sot-trad-modal button:hover {
      transform: scale(1.02);
    }
    .sot-trad-modal button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .sot-trad-modal .btn-primary {
      background: #d4af37;
      color: #1a1a2e;
    }
    .sot-trad-modal .btn-secondary {
      background: #333;
      color: #fff;
      border: 1px solid #555;
    }
    .sot-trad-modal .btn-close {
      background: transparent;
      color: #888;
      font-size: 14px;
    }
    .sot-trad-modal .success {
      color: #4ade80;
    }
    .sot-trad-modal .error {
      color: #f87171;
      font-size: 14px;
      margin-top: 12px;
    }
    .sot-trad-modal .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #fff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: sot-trad-spin 1s linear infinite;
    }
    @keyframes sot-trad-spin {
      to { transform: rotate(360deg); }
    }
  \`;
  document.head.appendChild(style);

  // Créer la modal
  const overlay = document.createElement('div');
  overlay.className = 'sot-trad-modal-overlay';
  overlay.innerHTML = \`
    <div class="sot-trad-modal">
      <h2>⚓ Import Traductions</h2>
      <p>Chargement...</p>
      <div class="loading"></div>
    </div>
  \`;
  document.body.appendChild(overlay);

  const modal = overlay.querySelector('.sot-trad-modal');

  // Fermer en cliquant sur l'overlay
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      style.remove();
    }
  });

  function closeModal() {
    overlay.remove();
    style.remove();
  }

  // Afficher si pas sur le bon site
  function showWrongSiteMessage() {
    modal.innerHTML = \`
      <h2>⚓ Import Traductions</h2>
      <p>Ce bookmarklet doit etre execute depuis le site officiel Sea of Thieves.</p>
      <div class="buttons">
        <button class="btn-primary" id="sot-goto-btn">
          🌐 Aller sur seaofthieves.com
        </button>
        <button class="btn-close" id="sot-close-btn">
          Fermer
        </button>
      </div>
    \`;
    modal.querySelector('#sot-goto-btn').addEventListener('click', () => {
      window.location.href = 'https://www.seaofthieves.com/profile/reputation';
    });
    modal.querySelector('#sot-close-btn').addEventListener('click', closeModal);
  }

  // Vérifier le site
  if (!window.location.hostname.includes('seaofthieves.com')) {
    showWrongSiteMessage();
    return;
  }

  // Langues à récupérer
  const languages = [
    { code: 'fr', name: 'Francais', prefix: '/fr' },
    { code: 'en', name: 'English', prefix: '' },
    { code: 'es', name: 'Espanol', prefix: '/es' }
  ];

  const results = {};
  let currentStep = 0;

  // Afficher la progression
  function updateProgress() {
    const progress = (currentStep / languages.length) * 100;
    modal.innerHTML = \`
      <h2>⚓ Import Traductions</h2>
      <p>Recuperation des donnees en cours...</p>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" style="width: \${progress}%"></div>
        </div>
        <div class="progress-steps">
          \${languages.map((lang, i) => \`
            <div class="step">
              <div class="step-icon \${i < currentStep ? 'step-done' : i === currentStep ? 'step-loading' : 'step-pending'}">
                \${i < currentStep ? '✓' : lang.code.toUpperCase()}
              </div>
              <span class="step-label">\${lang.name}</span>
            </div>
          \`).join('')}
        </div>
      </div>
    \`;
  }

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

  // Récupérer les données pour une langue
  async function fetchLanguage(lang) {
    const apiUrl = 'https://www.seaofthieves.com' + lang.prefix + '/api/profilev2/reputation';
    const response = await fetch(apiUrl, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Non connecte' : 'Erreur ' + response.status);
    }
    return response.json();
  }

  // Lancer la récupération
  async function fetchAllLanguages() {
    updateProgress();

    for (const lang of languages) {
      try {
        results[lang.code] = await fetchLanguage(lang);
        currentStep++;
        updateProgress();
      } catch (error) {
        // Afficher l'erreur
        modal.innerHTML = \`
          <h2>⚓ Import Traductions</h2>
          <p class="error">Erreur lors de la recuperation des donnees (\${lang.name})</p>
          <p>Assurez-vous d'etre connecte sur seaofthieves.com</p>
          <div class="buttons">
            <button class="btn-secondary" onclick="location.href='https://www.seaofthieves.com/profile/reputation'">
              🔑 Se connecter
            </button>
            <button class="btn-close" id="sot-close-btn">
              Fermer
            </button>
          </div>
        \`;
        modal.querySelector('#sot-close-btn').addEventListener('click', closeModal);
        return;
      }
    }

    // Toutes les données récupérées
    showResults();
  }

  // Afficher les résultats
  function showResults() {
    const emblemCount = countEmblems(results.fr);
    const factionCount = Object.keys(results.fr).length;

    modal.innerHTML = \`
      <h2>⚓ Import Traductions</h2>
      <p class="success">✓ Donnees recuperees avec succes !</p>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">3</div>
          <div class="stat-label">Langues</div>
        </div>
        <div class="stat">
          <div class="stat-value">\${factionCount}</div>
          <div class="stat-label">Factions</div>
        </div>
        <div class="stat">
          <div class="stat-value">\${emblemCount}</div>
          <div class="stat-label">Accomplissements</div>
        </div>
      </div>
      <div class="buttons">
        <button class="btn-primary" id="sot-import-btn">
          📥 Importer les traductions
        </button>
        <button class="btn-close" id="sot-close-btn">
          Fermer
        </button>
      </div>
      <div id="sot-message"></div>
    \`;

    const messageEl = modal.querySelector('#sot-message');
    const importBtn = modal.querySelector('#sot-import-btn');
    const closeBtn = modal.querySelector('#sot-close-btn');

    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      importBtn.innerHTML = '<span class="loading"></span>';
      try {
        const response = await fetch(SITE_URL + '/api/admin/import-translations-temp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(results)
        });
        const result = await response.json();
        if (result.success && result.code) {
          window.location.href = SITE_URL + '/admin/traductions?import=' + result.code;
        } else {
          throw new Error(result.message || 'Erreur serveur');
        }
      } catch (err) {
        messageEl.innerHTML = '<div class="error">Erreur: ' + err.message + '</div>';
        importBtn.disabled = false;
        importBtn.textContent = '📥 Importer les traductions';
      }
    });

    closeBtn.addEventListener('click', closeModal);
  }

  fetchAllLanguages();
})();`
}

// Minifie le code du bookmarklet
export function minifyTranslationBookmarkletCode(code: string): string {
  return code
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.startsWith('//'))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
