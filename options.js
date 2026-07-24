const BUILD_DATE = '2026-07-24'; // v1.2.1
const DEFAULT_GITHUB_URL = 'https://raw.githubusercontent.com/yakamatt/Snippets-Expander/main';
const DEFAULT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwD5Qroaap9pF7nHdJG45FuonkRWocCPtEOIwNBnWSktBhfed9Eare74eXCPFPkl4G6/exec';

let snippets = [];
const collapsedFolders = new Set();

const bodyEl = document.getElementById('snippets-body');
const countEl = document.getElementById('count');
const searchEl = document.getElementById('search');
const folderFilterEl = document.getElementById('folder-filter');
const folderChipsEl = document.getElementById('folder-chips');
const newFolderSelect = document.getElementById('new-folder-select');
const newFolderInput = document.getElementById('new-folder-input');

function load() {
  chrome.storage.local.get(['snippets', 'lastSync', 'updateCheck'], (res) => {
    snippets = res.snippets || [];
    render();
    renderVersionFooter(res.lastSync);
    renderUpdateBanner(res.updateCheck);
  });
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const s = res.syncSettings || {};
    document.getElementById('webapp-url').value = s.webAppUrl || DEFAULT_WEBAPP_URL;
    document.getElementById('autosync').value = String(s.autoSyncMinutes || 0);
    document.getElementById('expansion-delay').value = s.expansionDelayMs ?? 500;
    document.getElementById('sync-priority').value = s.syncPriority || 'remote';
    document.getElementById('github-url').value = s.githubRepoUrl || DEFAULT_GITHUB_URL;
    document.getElementById('auto-check-updates').checked = !!s.autoCheckUpdates;
  });
  renderUpdateMode();
}

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

function save(cb) {
  chrome.storage.local.set({ snippets }, cb);
}

function getFolders() {
  return Array.from(new Set(snippets.map(s => s.folder).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

// Couleur pastel déterministe à partir du nom du dossier
function folderColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { bg: `hsl(${hue}, 70%, 93%)`, text: `hsl(${hue}, 55%, 32%)` };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Dossiers : chips + selects ----------

function renderFolderChips() {
  const folders = getFolders();
  folderChipsEl.innerHTML = '';

  if (!folders.length) {
    const empty = document.createElement('span');
    empty.className = 'folder-chip empty-state';
    empty.textContent = 'Aucun dossier pour l\'instant';
    folderChipsEl.appendChild(empty);
    return;
  }

  folders.forEach(folder => {
    const count = snippets.filter(s => s.folder === folder).length;
    const color = folderColor(folder);
    const chip = document.createElement('span');
    chip.className = 'folder-chip';
    chip.style.background = color.bg;
    chip.style.color = color.text;

    const label = document.createElement('span');
    label.textContent = folder;
    chip.appendChild(label);

    const countSpan = document.createElement('span');
    countSpan.className = 'chip-count';
    countSpan.textContent = `(${count})`;
    chip.appendChild(countSpan);

    const renameBtn = document.createElement('button');
    renameBtn.textContent = '✏️';
    renameBtn.title = 'Renommer le dossier';
    renameBtn.addEventListener('click', () => {
      const newName = prompt(`Renommer le dossier "${folder}" en :`, folder);
      if (!newName || newName.trim() === '' || newName.trim() === folder) return;
      snippets.forEach(s => { if (s.folder === folder) s.folder = newName.trim(); });
      save(render);
    });
    chip.appendChild(renameBtn);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.title = 'Dissocier ce dossier (les snippets ne sont pas supprimés)';
    removeBtn.addEventListener('click', () => {
      if (!confirm(`Retirer le dossier "${folder}" ? Les ${count} snippet(s) concerné(s) seront déplacés vers "Sans dossier".`)) return;
      snippets.forEach(s => { if (s.folder === folder) s.folder = ''; });
      save(render);
    });
    chip.appendChild(removeBtn);

    folderChipsEl.appendChild(chip);
  });
}

function renderFolderSelects() {
  const folders = getFolders();
  const currentFilter = folderFilterEl.value;
  folderFilterEl.innerHTML = '<option value="">Tous les dossiers</option>' +
    folders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
  folderFilterEl.value = folders.includes(currentFilter) ? currentFilter : '';

  const currentNewSelectValue = newFolderSelect.value;
  newFolderSelect.innerHTML = '<option value="">Sans dossier</option>' +
    folders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('') +
    '<option value="__new__">➕ Nouveau dossier...</option>';
  if (folders.includes(currentNewSelectValue)) newFolderSelect.value = currentNewSelectValue;
}

newFolderSelect.addEventListener('change', () => {
  newFolderInput.hidden = newFolderSelect.value !== '__new__';
  if (!newFolderInput.hidden) newFolderInput.focus();
});

// ---------- Tableau groupé par dossier ----------

function render() {
  const filter = (searchEl.value || '').toLowerCase();
  const folderFilter = folderFilterEl.value;

  renderFolderChips();
  renderFolderSelects();

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
    const color = folderName ? folderColor(folderName) : { bg: '#f3f4f6', text: '#6b7280' };
    headerTr.style.background = color.bg;
    headerTr.style.color = color.text;

    const headerTd = document.createElement('td');
    headerTd.colSpan = 3;
    headerTd.innerHTML = `<span class="chevron">▾</span>${escapeHtml(folderName || 'Sans dossier')} (${groupRows.length})`;
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
  const isLocked = s.origin === 'synced';
  const tr = document.createElement('tr');

  const triggerTd = document.createElement('td');
  triggerTd.className = 'trigger' + (isLocked ? ' locked' : '');
  triggerTd.textContent = s.trigger;
  makeEditable(triggerTd, s, 'trigger', false, isLocked);

  const contentTd = document.createElement('td');
  contentTd.className = 'content' + (isLocked ? ' locked' : '');
  contentTd.textContent = s.content;
  makeEditable(contentTd, s, 'content', true, isLocked);

  const actionTd = document.createElement('td');
  actionTd.className = 'action-cell';
  const originBadge = document.createElement('span');
  originBadge.className = 'origin-badge ' + (isLocked ? 'origin-synced' : 'origin-local');
  originBadge.textContent = isLocked ? 'synced' : 'local';
  actionTd.appendChild(originBadge);
  actionTd.appendChild(document.createTextNode(' '));

  if (isLocked) {
    const note = document.createElement('div');
    note.className = 'locked-note';
    note.textContent = '⚠️ Modifiable, mais la modification sera appliquée à tous les utilisateurs via Google Sheets (non annulable).';
    actionTd.appendChild(note);

    const dupBtn = document.createElement('button');
    dupBtn.className = 'dup';
    dupBtn.textContent = 'Dupliquer en local';
    dupBtn.addEventListener('click', () => {
      const copy = { ...s, origin: 'local', trigger: s.trigger + '-copie' };
      snippets.push(copy);
      save(render);
    });
    actionTd.appendChild(dupBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'del';
  delBtn.textContent = 'Supprimer';
  delBtn.addEventListener('click', () => {
    snippets = snippets.filter(x => x !== s);
    save(render);
  });
  actionTd.appendChild(delBtn);

  tr.append(triggerTd, contentTd, actionTd);
  bodyEl.appendChild(tr);
}

function makeEditable(td, snippet, field, multiline, isSynced) {
  td.setAttribute('contenteditable', 'true');
  td.addEventListener('blur', () => {
    const newValue = multiline ? td.innerText.replace(/\r/g, '') : td.textContent.trim();
    if (snippet[field] === newValue) return;
    if (field === 'trigger' && !newValue) { td.textContent = snippet.trigger; return; }
    if (isSynced) {
      const confirmed = confirm(
        '⚠️ Ce snippet est synchronisé depuis Google Sheets.\n\n' +
        'Modifier cette valeur l\'enverra immédiatement dans le Sheet partagé et s\'appliquera à TOUS les utilisateurs ' +
        '(le Sheet est entièrement réécrit avec l\'ensemble de vos snippets locaux actuels, pas seulement celui-ci).\n\n' +
        'Cette action est irréversible. Continuer ?'
      );
      if (!confirmed) { td.textContent = snippet[field]; return; }
    }
    snippet[field] = newValue;
    save(() => {
      if (isSynced) pushSyncedEdit();
    });
  });
  td.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); td.blur(); }
  });
}

function pushSyncedEdit() {
  chrome.runtime.sendMessage({ type: 'PUSH_TO_SHEET' }, (resp) => {
    const statusEl = document.getElementById('sync-status');
    if (resp && resp.ok) {
      if (statusEl) statusEl.textContent = '✅ Modification envoyée vers Google Sheets (appliquée à tous les utilisateurs).';
    } else {
      alert('❌ Erreur lors de l\'envoi vers Google Sheets : ' + (resp && resp.error));
    }
  });
}

searchEl.addEventListener('input', render);
folderFilterEl.addEventListener('change', render);

document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const trigger = document.getElementById('new-trigger').value.trim();
  const content = document.getElementById('new-content').value;
  let folder = newFolderSelect.value;
  if (folder === '__new__') folder = newFolderInput.value.trim();
  if (!trigger || !content) return;

  snippets = snippets.filter(s => !(s.trigger === trigger && s.origin !== 'synced'));
  snippets.push({ trigger, content, folder, origin: 'local' });
  save(() => {
    render();
    e.target.reset();
    newFolderInput.hidden = true;
  });
});

// --- Export / Import CSV (compatible Excel) ---

function csvEscape(field) {
  const str = String(field ?? '');
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function toCSV(list) {
  const header = 'trigger,content,folder';
  const lines = list.map(s => [s.trigger, s.content, s.folder || ''].map(csvEscape).join(','));
  return [header, ...lines].join('\r\n');
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignore */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length && r.some(c => c !== ''));
}

document.getElementById('export-csv').addEventListener('click', () => {
  const csv = toCSV(snippets);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'snippets.csv';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-csv').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCSV(reader.result);
    if (!rows.length) return;
    const header = rows[0].map(h => h.trim().toLowerCase());
    const triggerIdx = header.indexOf('trigger');
    const contentIdx = header.indexOf('content');
    const folderIdx = header.indexOf('folder');
    const dataRows = triggerIdx === -1 ? rows : rows.slice(1);

    const imported = dataRows.map(r => ({
      trigger: triggerIdx === -1 ? r[0] : r[triggerIdx],
      content: triggerIdx === -1 ? r[1] : r[contentIdx],
      folder: (folderIdx === -1 ? '' : r[folderIdx]) || '',
      origin: 'local'
    })).filter(s => s.trigger && s.content);

    const map = new Map(snippets.map(s => [s.trigger, s]));
    imported.forEach(s => map.set(s.trigger, s));
    snippets = Array.from(map.values());

    save(() => {
      render();
      document.getElementById('import-status').textContent = `✅ ${imported.length} snippet(s) importé(s).`;
    });
  };
  reader.readAsText(file, 'UTF-8');
});

// --- Synchro Google Sheets ---

document.getElementById('save-settings').addEventListener('click', () => {
  const webAppUrl = document.getElementById('webapp-url').value.trim();
  const autosyncEl = document.getElementById('autosync');
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const wasEmpty = !(res.syncSettings || {}).webAppUrl;
    let autoSyncMinutes = parseInt(autosyncEl.value, 10);
    // Première configuration de l'URL Google Sheets : active la synchro auto toutes les heures par défaut
    if (webAppUrl && wasEmpty && autoSyncMinutes === 0) {
      autoSyncMinutes = 60;
      autosyncEl.value = '60';
    }
    updateSyncSettings({ webAppUrl, autoSyncMinutes }, () => {
      document.getElementById('sync-status').textContent = '✅ Paramètres enregistrés.';
    });
  });
});

document.getElementById('pull-btn').addEventListener('click', () => {
  document.getElementById('sync-status').textContent = '⏳ Récupération en cours...';
  chrome.runtime.sendMessage({ type: 'PULL_FROM_SHEET' }, (resp) => {
    if (resp && resp.ok) {
      load();
      document.getElementById('sync-status').textContent = '✅ Snippets fusionnés avec Google Sheets (rien n\'a été perdu localement).';
    } else {
      document.getElementById('sync-status').textContent = '❌ Erreur : ' + (resp && resp.error);
    }
  });
});

document.getElementById('push-btn').addEventListener('click', () => {
  const confirmed = confirm(
    '⚠️ ATTENTION : cette action va écraser TOUT le contenu du Google Sheet partagé avec vos données locales actuelles.\n\n' +
    'Toute modification apportée par d\'autres personnes directement sur le Sheet (ou non encore récupérée) sera perdue.\n\n' +
    'Continuer ?'
  );
  if (!confirmed) return;
  document.getElementById('update-status').textContent = '⏳ Envoi en cours...';
  chrome.runtime.sendMessage({ type: 'PUSH_TO_SHEET' }, (resp) => {
    if (resp && resp.ok) {
      document.getElementById('update-status').textContent = '✅ Snippets envoyés vers Google Sheets.';
    } else {
      document.getElementById('update-status').textContent = '❌ Erreur : ' + (resp && resp.error);
    }
  });
});

// --- Paramètres avancés ---

document.getElementById('toggle-advanced').addEventListener('click', () => {
  const panel = document.getElementById('advanced-panel');
  panel.hidden = !panel.hidden;
  document.getElementById('toggle-advanced').textContent = panel.hidden ? '⚙️ Paramètres avancés ▾' : '⚙️ Paramètres avancés ▴';
});

document.getElementById('expansion-delay').addEventListener('change', (e) => {
  updateSyncSettings({ expansionDelayMs: parseInt(e.target.value, 10) || 0 });
});

document.getElementById('sync-priority').addEventListener('change', (e) => {
  updateSyncSettings({ syncPriority: e.target.value });
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
  const syncTxt = lastSync ? `Dernière synchro : ${new Date(lastSync).toLocaleString()}` : 'Aucune synchro effectuée';
  footer.textContent = `Snippet Expander v${version} — build du ${BUILD_DATE} — ${syncTxt}`;
}

load();
