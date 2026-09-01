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
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1H2rBzMQzZk74Bk2Z_Mo8lXAdYea7Mi7WfzVruBahd_I/edit';

chrome.storage.sync.get(['syncSettings'], (res) => {
  const s = res.syncSettings || {};
  avisoEl.checked = s.avisoIconEnabled !== false;
  // Le tableau visé est configurable (Paramètres avancés) : le lien suit ce réglage.
  document.getElementById('open-sheet-link').href = s.sheetUrl || DEFAULT_SHEET_URL;
});

avisoEl.addEventListener('change', (e) => {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const merged = { ...(res.syncSettings || {}), avisoIconEnabled: e.target.checked };
    chrome.storage.sync.set({ syncSettings: merged });
  });
});

// ---------- DatAviso : import des données de dossier ----------
// Chaque import REMPLACE entièrement les données précédentes : le texte importé fait foi, ce qui
// évite de laisser traîner des articles d'un dossier précédent qui réapparaîtraient dans Aviso.

const importTextEl = document.getElementById('import-text');
const importStatusEl = document.getElementById('import-status');
const importCountEl = document.getElementById('import-count');

function renderImportCount() {
  chrome.storage.local.get(['importedArticles', 'importedMeta'], (res) => {
    const articles = res.importedArticles || [];
    document.getElementById('import-clear').hidden = !articles.length;
    if (!articles.length) {
      importCountEl.textContent = 'Aucune donnée DatAviso pour le moment.';
      return;
    }
    const meta = res.importedMeta || {};
    const quand = meta.importedAt ? new Date(meta.importedAt).toLocaleDateString() : '';
    const source = meta.source ? ` depuis ${meta.source}` : '';
    importCountEl.textContent =
      `${articles.length} article${articles.length > 1 ? 's' : ''} importé${articles.length > 1 ? 's' : ''}` +
      (quand ? ` le ${quand}${source}` : '') + '.';
  });
}

function runImport(text, source) {
  const articles = parseImportedData(text);
  if (!articles.length) {
    importStatusEl.textContent = '❌ Aucun article détecté. Chaque bloc doit commencer par une ligne du type "GN 12 — Titre".';
    return;
  }
  chrome.storage.local.set({
    importedArticles: articles,
    importedMeta: { importedAt: new Date().toISOString(), source, count: articles.length }
  }, () => {
    const codes = articles.slice(0, 3).map(a => a.code).join(', ');
    importStatusEl.textContent =
      `✅ ${articles.length} article${articles.length > 1 ? 's' : ''} importé${articles.length > 1 ? 's' : ''} (${codes}${articles.length > 3 ? '…' : ''}).`;
    importTextEl.value = '';
    renderImportCount();
  });
}

document.getElementById('import-btn').addEventListener('click', () => {
  const text = importTextEl.value.trim();
  if (!text) {
    importStatusEl.textContent = '❌ Collez d\'abord le texte à importer.';
    return;
  }
  runImport(text, 'le presse-papiers');
});

// Effacement complet, confirmé : les données DatAviso ne se retrouvent pas d'un clic, il faut
// réimporter le texte source.
document.getElementById('import-clear').addEventListener('click', () => {
  chrome.storage.local.get(['importedArticles'], (res) => {
    const nb = (res.importedArticles || []).length;
    if (!nb) return;
    if (!confirm(`Effacer les ${nb} article${nb > 1 ? 's' : ''} DatAviso ?`)) return;
    chrome.storage.local.set({ importedArticles: [], importedMeta: null }, () => {
      importStatusEl.textContent = '🗑️ Données DatAviso effacées.';
      renderImportCount();
    });
  });
});

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => runImport(String(reader.result), file.name);
  reader.onerror = () => { importStatusEl.textContent = '❌ Lecture du fichier impossible.'; };
  reader.readAsText(file, 'utf-8');
  e.target.value = ''; // permet de réimporter le même fichier après correction
});

renderImportCount();

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});
