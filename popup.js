const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1H2rBzMQzZk74Bk2Z_Mo8lXAdYea7Mi7WfzVruBahd_I/edit';

// Clausier Commun : le tableau visé est configurable (Paramètres avancés), le lien suit ce réglage.
chrome.storage.sync.get(['syncSettings'], (res) => {
  const s = res.syncSettings || {};
  document.getElementById('open-sheet-link').href = s.sheetUrl || DEFAULT_SHEET_URL;
});

// Clausier Personnel : géré dans la page Paramètres, ouverte directement sur sa section.
// chrome.runtime.openOptionsPage() ne transmet pas d'ancre, d'où l'ouverture par URL.
document.getElementById('open-clausier').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options.html#clausier') });
  window.close();
});

// ---------- DatAviso AI : import des données de dossier ----------
// Chaque import REMPLACE entièrement les données précédentes : le fichier importé fait foi, ce
// qui évite de laisser traîner des articles d'un dossier précédent qui réapparaîtraient dans Aviso.

const importStatusEl = document.getElementById('import-status');
const importCountEl = document.getElementById('import-count');

function renderImportCount() {
  chrome.storage.local.get(['importedArticles', 'importedMeta'], (res) => {
    const articles = res.importedArticles || [];
    document.getElementById('import-clear').hidden = !articles.length;
    if (!articles.length) {
      importCountEl.textContent = 'Aucune donnée DatAviso AI pour le moment.';
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
    renderImportCount();
  });
}

// Effacement complet, confirmé : les données DatAviso AI ne se retrouvent pas d'un clic, il faut
// réimporter le fichier source.
document.getElementById('import-clear').addEventListener('click', () => {
  chrome.storage.local.get(['importedArticles'], (res) => {
    const nb = (res.importedArticles || []).length;
    if (!nb) return;
    if (!confirm(`Effacer les ${nb} article${nb > 1 ? 's' : ''} DatAviso AI ?`)) return;
    chrome.storage.local.set({ importedArticles: [], importedMeta: null }, () => {
      importStatusEl.textContent = '🗑️ Données DatAviso AI effacées.';
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

// ---------- Partage ----------
// Code commun avec le tutoriel : partage.js.
brancherPartage(
  document.getElementById('share-copy'),
  document.getElementById('share-mail'),
  document.getElementById('share-status')
);

document.getElementById('open-tutoriel').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('tutoriel.html') });
  window.close();
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});
