const BUILD_DATE = '2026-08-02'; // v2.1.0
const DEFAULT_GITHUB_URL = 'https://raw.githubusercontent.com/yakamatt/Snippets-Expander/main';

let snippets = [];
const collapsedFolders = new Set();

const bodyEl = document.getElementById('snippets-body');
const countEl = document.getElementById('count');
const searchEl = document.getElementById('search');
const folderFilterEl = document.getElementById('folder-filter');

function load() {
  chrome.storage.local.get(['snippets', 'lastSync', 'updateCheck', 'pinBannerDismissed'], (res) => {
    snippets = res.snippets || [];
    render();
    renderVersionFooter(res.lastSync);
    renderUpdateBanner(res.updateCheck);
    document.getElementById('pin-banner').hidden = !!res.pinBannerDismissed;
  });
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const s = res.syncSettings || {};
    document.getElementById('autosync-minutes').value = s.autoSyncMinutes ?? 60;
    document.getElementById('expansion-delay').value = s.expansionDelayMs ?? 500;
    document.getElementById('github-url').value = s.githubRepoUrl || DEFAULT_GITHUB_URL;
    document.getElementById('auto-check-updates').checked = !!s.autoCheckUpdates;
  });
  renderUpdateMode();
}

// Rafraîchit automatiquement le tableau si les snippets changent en arrière-plan (synchro auto
// horaire, mise à jour déclenchée depuis un autre onglet...).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.snippets) return;
  const incoming = changes.snippets.newValue || [];
  if (JSON.stringify(incoming) === JSON.stringify(snippets)) return;
  snippets = incoming;
  render();
});

document.getElementById('pin-banner-dismiss').addEventListener('click', () => {
  document.getElementById('pin-banner').hidden = true;
  chrome.storage.local.set({ pinBannerDismissed: true });
});

// Le flux de mise à jour manuel (URL GitHub raw + téléchargement zip) n'a de sens qu'en mode
// développeur ("non empaquetée") : une fois publiée sur le Chrome Web Store, Chrome met à jour
// l'extension tout seul, silencieusement.
function renderUpdateMode() {
  const devBlock = document.getElementById('update-block-dev');
  const storeBlock = document.getElementById('update-block-store');
  if (!chrome.management || !chrome.management.getSelf) {
    devBlock.hidden = false; // API indisponible (contexte de test) : on affiche le mode dev par défaut
    return;
  }
  chrome.management.getSelf((info) => {
    const isDev = info.installType === 'development';
    devBlock.hidden = !isDev;
    storeBlock.hidden = isDev;
    if (!isDev) {
      document.getElementById('update-status-store').textContent =
        `Version installée : v${chrome.runtime.getManifest().version}`;
    }
  });
}

// ---------- Mise à jour des données depuis Google Sheets (bouton principal, en haut de page) ----------

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
      load();
      statusEl.textContent = '✅ Données actualisées.';
    } else {
      statusEl.textContent = '❌ Erreur : ' + (resp && resp.error);
    }
  });
});

function getFolders() {
  const used = snippets.map(s => s.folder).filter(Boolean);
  return Array.from(new Set(used)).sort((a, b) => a.localeCompare(b));
}

// Couleur pastel déterministe à partir du nom du dossier, piochée dans une palette de teintes
// choisies pour rester harmonieuses sur le fond chaud de l'extension (plutôt qu'un arc-en-ciel brut).
// Ces couleurs sont posées en style inline (une par dossier) : elles doivent donc s'adapter elles-mêmes
// au thème sombre, la cascade CSS ne pouvant pas les intercepter.
const FOLDER_HUES = [38, 16, 350, 300, 255, 185, 100, 55];
function isDarkMode() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function folderColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = FOLDER_HUES[Math.abs(hash) % FOLDER_HUES.length];
  return isDarkMode()
    ? { bg: `hsl(${hue}, 28%, 22%)`, text: `hsl(${hue}, 55%, 78%)` }
    : { bg: `hsl(${hue}, 45%, 91%)`, text: `hsl(${hue}, 45%, 30%)` };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderFolderFilter() {
  const folders = getFolders();
  const currentFilter = folderFilterEl.value;
  folderFilterEl.innerHTML = '<option value="">Tous les dossiers</option>' +
    folders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
  folderFilterEl.value = folders.includes(currentFilter) ? currentFilter : '';
}

// ---------- Tableau groupé par dossier (lecture seule) ----------

function render() {
  const filter = (searchEl.value || '').toLowerCase();
  const folderFilter = folderFilterEl.value;

  renderFolderFilter();

  const rows = snippets.filter(s => {
    if (folderFilter && s.folder !== folderFilter) return false;
    if (!filter) return true;
    return s.trigger.toLowerCase().includes(filter) ||
           s.content.toLowerCase().includes(filter);
  });

  countEl.textContent = snippets.length;
  bodyEl.innerHTML = '';

  const folders = getFolders();
  const groupOrder = ['', ...folders]; // "Sans dossier" en premier

  groupOrder.forEach(folderName => {
    const groupRows = rows.filter(s => (s.folder || '') === folderName);
    if (!groupRows.length) return;

    const headerTr = document.createElement('tr');
    headerTr.className = 'folder-group-header';
    const isCollapsed = collapsedFolders.has(folderName);
    if (isCollapsed) headerTr.classList.add('collapsed');
    const color = folderName
      ? folderColor(folderName)
      : (isDarkMode() ? { bg: '#2a241a', text: '#a79a85' } : { bg: '#efe8db', text: '#77694f' });
    headerTr.style.background = color.bg;
    headerTr.style.color = color.text;

    // Le flex est posé sur un wrapper interne, pas directement sur le <td> : un display:flex
    // sur un <td colspan> casse le calcul de largeur de table-layout:fixed (Chrome le réduit
    // à la largeur de la seule 1re colonne au lieu de sommer les colonnes couvertes).
    const headerTd = document.createElement('td');
    headerTd.colSpan = 2;
    const headerRow = document.createElement('div');
    headerRow.className = 'folder-group-td';
    headerRow.innerHTML = `<span class="chevron">▾</span>${escapeHtml(folderName || 'Sans dossier')} (${groupRows.length})`;
    headerTd.appendChild(headerRow);

    headerTr.appendChild(headerTd);
    headerTr.addEventListener('click', () => {
      if (collapsedFolders.has(folderName)) collapsedFolders.delete(folderName);
      else collapsedFolders.add(folderName);
      render();
    });
    bodyEl.appendChild(headerTr);

    if (isCollapsed) return;

    groupRows.forEach(s => renderSnippetRow(s));
  });
}

function renderSnippetRow(s) {
  const tr = document.createElement('tr');

  const triggerTd = document.createElement('td');
  triggerTd.className = 'trigger';
  triggerTd.textContent = s.trigger;

  const contentTd = document.createElement('td');
  contentTd.className = 'content';
  contentTd.textContent = s.content;

  tr.append(triggerTd, contentTd);
  bodyEl.appendChild(tr);
}

searchEl.addEventListener('input', render);
folderFilterEl.addEventListener('change', render);

// --- Paramètres avancés ---

document.getElementById('autosync-minutes').addEventListener('change', (e) => {
  const autoSyncMinutes = parseInt(e.target.value, 10);
  updateSyncSettings({ autoSyncMinutes: Number.isFinite(autoSyncMinutes) ? autoSyncMinutes : 60 });
});

document.getElementById('toggle-advanced').addEventListener('click', () => {
  const panel = document.getElementById('advanced-panel');
  panel.hidden = !panel.hidden;
  document.getElementById('toggle-advanced').textContent = panel.hidden ? '⚙️ Paramètres avancés ▾' : '⚙️ Paramètres avancés ▴';
});

document.getElementById('expansion-delay').addEventListener('change', (e) => {
  updateSyncSettings({ expansionDelayMs: parseInt(e.target.value, 10) || 0 });
});

document.getElementById('save-github').addEventListener('click', () => {
  updateSyncSettings({
    githubRepoUrl: document.getElementById('github-url').value.trim().replace(/\/$/, ''),
    autoCheckUpdates: document.getElementById('auto-check-updates').checked
  }, () => {
    document.getElementById('update-status').textContent = '✅ Paramètres GitHub enregistrés.';
  });
});

document.getElementById('check-update-btn').addEventListener('click', () => {
  document.getElementById('update-status').textContent = '⏳ Vérification en cours...';
  chrome.runtime.sendMessage({ type: 'CHECK_FOR_UPDATES' }, (resp) => {
    const downloadBtn = document.getElementById('download-update-btn');
    if (resp && resp.ok) {
      document.getElementById('update-status').textContent = resp.isNewer
        ? `⬆️ Nouvelle version disponible : ${resp.remoteVersion} (actuelle : ${resp.localVersion})`
        : `✅ Vous êtes à jour (v${resp.localVersion}).`;
      downloadBtn.hidden = !resp.isNewer;
      chrome.storage.local.get(['updateCheck'], (r) => renderUpdateBanner(r.updateCheck));
    } else {
      downloadBtn.hidden = true;
      document.getElementById('update-status').textContent = '❌ Erreur : ' + (resp && resp.error);
    }
  });
});

// Construit l'URL de téléchargement du zip à partir de l'URL raw GitHub configurée
// (https://raw.githubusercontent.com/USER/REPO/BRANCH -> zip via codeload.github.com)
function getRepoZipUrl() {
  const raw = document.getElementById('github-url').value.trim();
  const m = raw.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  const [, user, repo, branch] = m;
  return `https://codeload.github.com/${user}/${repo}/zip/refs/heads/${branch}`;
}

function triggerUpdateDownload() {
  const zipUrl = getRepoZipUrl();
  if (!zipUrl) {
    document.getElementById('update-status').textContent = '❌ URL du dépôt GitHub invalide, impossible de générer le lien de téléchargement.';
    return;
  }
  window.open(zipUrl, '_blank');
  document.getElementById('update-status').textContent =
    '⬇️ Téléchargement lancé. Décompressez le zip, remplacez les fichiers dans le dossier de l\'extension, puis cliquez sur "Actualiser" dans chrome://extensions.';
}

document.getElementById('download-update-btn').addEventListener('click', triggerUpdateDownload);
document.getElementById('update-banner-btn').addEventListener('click', triggerUpdateDownload);

function updateSyncSettings(patch, cb) {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const merged = { ...(res.syncSettings || {}), ...patch };
    chrome.storage.sync.set({ syncSettings: merged }, () => {
      chrome.runtime.sendMessage({ type: 'RESCHEDULE_ALARM' });
      if (cb) cb();
    });
  });
}

function renderUpdateBanner(updateCheck) {
  const banner = document.getElementById('update-banner');
  const downloadBtn = document.getElementById('download-update-btn');
  if (updateCheck && updateCheck.isNewer) {
    banner.hidden = false;
    document.getElementById('update-banner-text').innerHTML =
      `⬆️ Nouvelle version disponible : <strong>${escapeHtml(updateCheck.remoteVersion)}</strong> (actuelle : ${escapeHtml(updateCheck.localVersion)})`;
    downloadBtn.hidden = false;
  } else {
    banner.hidden = true;
    downloadBtn.hidden = true;
  }
}

function renderVersionFooter(lastSync) {
  const version = chrome.runtime.getManifest().version;
  const footer = document.getElementById('version-footer');
  const syncTxt = lastSync ? `Dernière mise à jour : ${new Date(lastSync).toLocaleString()}` : 'Aucune mise à jour effectuée';
  footer.textContent = `Snippet Expander v${version} — build du ${BUILD_DATE} — ${syncTxt}`;
}

load();
