// Version du bookmarklet - doit correspondre à BOOKMARKLET_VERSION dans server/api/bookmarklet-version.get.ts
export const BOOKMARKLET_VERSION = 3

// Génère le code du bookmarklet (non minifié pour lisibilité)
export function generateBookmarkletCode(siteUrl: string): string {
  return `javascript:(function(){
  const SITE_URL = '${siteUrl}';
  const VERSION = ${BOOKMARKLET_VERSION};

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

  // Fonction pour fermer la modal
  function closeModal() {
    overlay.remove();
    style.remove();
  }

  // Vérifier si on est sur seaofthieves.com
  if (!window.location.hostname.includes('seaofthieves.com')) {
    modal.innerHTML = \`
      <h2>⚓ SoT Reputations</h2>
      <p>Ce bookmarklet doit etre execute depuis le site officiel Sea of Thieves.</p>
      <p style="color:#d4af37;font-size:13px;margin-top:12px;">Une fois sur le site, cliquez a nouveau sur le bookmarklet pour recuperer vos donnees.</p>
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
    return;
  }

  // Vérifier la version du bookmarklet
  fetch(SITE_URL + '/api/bookmarklet-version')
    .then(r => r.json())
    .then(data => {
      if (data.version > VERSION) {
        modal.innerHTML = \`
          <h2>⚓ SoT Reputations</h2>
          <p>Une nouvelle version du bookmarklet est disponible !</p>
          <p class="error">Vous devrez re-installer le bookmarklet depuis la page tutoriel.</p>
          <div class="buttons">
            <button class="btn-primary" id="sot-update-btn">
              🔄 Mettre a jour
            </button>
            <button class="btn-secondary" id="sot-continue-btn">
              Continuer quand meme
            </button>
            <button class="btn-close" id="sot-close-btn">
              Fermer
            </button>
          </div>
        \`;
        modal.querySelector('#sot-update-btn').addEventListener('click', () => {
          window.open(SITE_URL + '/tutoriel', '_blank');
          closeModal();
        });
        modal.querySelector('#sot-continue-btn').addEventListener('click', runBookmarklet);
        modal.querySelector('#sot-close-btn').addEventListener('click', closeModal);
      } else {
        runBookmarklet();
      }
    })
    .catch(() => {
      runBookmarklet();
    });

  function runBookmarklet() {
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
  }
})();`
}

// Minifie le code du bookmarklet
export function minifyBookmarkletCode(code: string): string {
  return code
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.startsWith('//'))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
