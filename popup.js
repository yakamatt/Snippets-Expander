document.getElementById('refresh-btn').addEventListener('click', () => {
  const btn = document.getElementById('refresh-btn');
  const statusEl = document.getElementById('refresh-status');
  btn.disabled = true;
  statusEl.textContent = '⏳ Actualisation en cours...';
  chrome.runtime.sendMessage({ type: 'PULL_FROM_SHEET' }, (resp) => {
    btn.disabled = false;
    if (chrome.runtime.lastError) {
      statusEl.textContent = '❌ Erreur : ' + chrome.runtime.lastError.message;
      return;
    }
    if (resp && resp.ok) {
      statusEl.textContent = '✅ Données actualisées.';
    } else {
      statusEl.textContent = '❌ Erreur : ' + (resp && resp.error);
    }
  });
});

// Réglage "Intégration Aviso", dupliqué ici depuis la page Paramètres : c'est le seul réglage
// qu'on active/désactive au fil de la journée selon qu'on travaille ou non sur Aviso, d'où sa
// place dans le popup. Le content script écoute chrome.storage.onChanged et applique le
// changement immédiatement, sans rechargement de la page Aviso.
const avisoEl = document.getElementById('aviso-icon-enabled');

chrome.storage.sync.get(['syncSettings'], (res) => {
  avisoEl.checked = (res.syncSettings || {}).avisoIconEnabled !== false;
});

avisoEl.addEventListener('change', (e) => {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const merged = { ...(res.syncSettings || {}), avisoIconEnabled: e.target.checked };
    chrome.storage.sync.set({ syncSettings: merged });
  });
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});
