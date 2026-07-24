const BUILD_DATE = '2026-07-24'; // v1.4.0
const DEFAULT_GITHUB_URL = 'https://raw.githubusercontent.com/yakamatt/Snippets-Expander/main';
const DEFAULT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwlew8sAl_APmmZS5bpedGnSf6Ukn0Tvs3S93BGGwt6pwUMzg1uwfOWq91zEhTUVJG9/exec';
// Dossier réservé : jamais envoyé à Google Sheets. Tous les autres dossiers sont synchronisés.
const LOCAL_FOLDER_NAME = 'Local';
const AUTO_SYNC_DEBOUNCE_MS = 10000;

let snippets = [];
const collapsedFolders = new Set();
let draggedSnippet = null; // snippet actuellement glissé (drag & drop, changement de dossier)

const bodyEl = document.getElementById('snippets-body');
const countEl = document.getElementById('count');
const searchEl = document.getElementById('search');
const folderFilterEl = document.getElementById('folder-filter');
const newFolderSelect = document.getElementById('new-folder-select');
const newFolderInput = document.getElementById('new-folder-input');

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
    document.getElementById('webapp-url').value = s.webAppUrl || DEFAULT_WEBAPP_URL;
    document.getElementById('autosync').value = String(s.autoSyncMinutes || 0);
    document.getElementById('expansion-delay').value = s.expansionDelayMs ?? 500;
    document.getElementById('sync-priority').value = s.syncPriority || 'remote';
    document.getElementById('github-url').value = s.githubRepoUrl || DEFAULT_GITHUB_URL;
    document.getElementById('auto-check-updates').checked = !!s.autoCheckUpdates;
  });
  renderUpdateMode();
}

// Rafraîchit automatiquement le tableau si les snippets changent en arrière-plan (import à
// l'installation, synchro auto horaire, pull déclenché depuis un autre onglet...). Le contrôle
// JSON.stringify évite de se re-rendre inutilement sur l'écho de nos propres écritures (save()),
// ce qui perturberait sinon une édition en cours dans une cellule.
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

function save(cb) {
  chrome.storage.local.set({ snippets }, () => {
    if (cb) cb();
    scheduleAutoSync();
  });
}

// Toute modification (ajout, édition, suppression, changement de dossier...) programme un envoi
// vers Google Sheets 10s plus tard (debounce : la frappe suivante repousse le délai). Les snippets
// du dossier "Local" restent exclus de l'envoi (voir background.js pushToSheet).
let autoSyncTimer = null;
function scheduleAutoSync() {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    chrome.storage.sync.get(['syncSettings'], (res) => {
      if (!(res.syncSettings || {}).webAppUrl) return; // pas d'URL configurée : rien à synchroniser
      chrome.runtime.sendMessage({ type: 'PUSH_TO_SHEET' }, (resp) => {
        const statusEl = document.getElementById('sync-status');
        if (!statusEl) return;
        statusEl.textContent = resp && resp.ok
          ? '✅ Synchronisation automatique effectuée.'
          : '❌ Erreur de synchronisation automatique : ' + (resp && resp.error);
      });
    });
  }, AUTO_SYNC_DEBOUNCE_MS);
}

function getFolders() {
  const used = snippets.map(s => s.folder).filter(Boolean);
  // "Local" est toujours proposé, même si aucun snippet ne l'utilise encore
  return Array.from(new Set([...used, LOCAL_FOLDER_NAME])).sort((a, b) => a.localeCompare(b));
}

function isLocalFolder(name) {
  return String(name || '').trim().toLowerCase() === LOCAL_FOLDER_NAME.toLowerCase();
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

// ---------- Dossiers : selects ----------

// Remplit un <select> avec "Sans dossier" + la liste des dossiers ("Local" marqué 🔒) + "Nouveau dossier"
function populateFolderOptions(selectEl, selectedValue) {
  const folders = getFolders();
  selectEl.innerHTML = '<option value="">Sans dossier</option>' +
    folders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(isLocalFolder(f) ? f + ' 🔒' : f)}</option>`).join('') +
    '<option value="__new__">➕ Nouveau dossier...</option>';
  selectEl.value = (selectedValue && folders.includes(selectedValue)) ? selectedValue : '';
}

function renderFolderSelects() {
  const folders = getFolders();
  const currentFilter = folderFilterEl.value;
  folderFilterEl.innerHTML = '<option value="">Tous les dossiers</option>' +
    folders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(isLocalFolder(f) ? f + ' 🔒' : f)}</option>`).join('');
  folderFilterEl.value = folders.includes(currentFilter) ? currentFilter : '';

  const currentNewSelectValue = newFolderSelect.value;
  populateFolderOptions(newFolderSelect, currentNewSelectValue);
}

newFolderSelect.addEventListener('change', () => {
  newFolderInput.hidden = newFolderSelect.value !== '__new__';
  if (!newFolderInput.hidden) newFolderInput.focus();
});

// ---------- Tableau groupé par dossier ----------

function render() {
  const filter = (searchEl.value || '').toLowerCase();
  const folderFilter = folderFilterEl.value;

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

    const isLocal = isLocalFolder(folderName);
    const headerTr = document.createElement('tr');
    headerTr.className = 'folder-group-header';
    const isCollapsed = collapsedFolders.has(folderName);
    if (isCollapsed) headerTr.classList.add('collapsed');
    const color = folderName && !isLocal
      ? folderColor(folderName)
      : (isDarkMode() ? { bg: '#2a241a', text: '#a79a85' } : { bg: '#efe8db', text: '#77694f' });
    headerTr.style.background = color.bg;
    headerTr.style.color = color.text;

    // Le flex est posé sur un wrapper interne, pas directement sur le <td> : un display:flex
    // sur un <td colspan> casse le calcul de largeur de table-layout:fixed (Chrome le réduit
    // à la largeur de la seule 1re colonne au lieu de sommer les 3 colonnes couvertes).
    const headerTd = document.createElement('td');
    headerTd.colSpan = 3;
    const headerRow = document.createElement('div');
    headerRow.className = 'folder-group-td';
    headerTd.appendChild(headerRow);

    const label = document.createElement('span');
    label.className = 'folder-group-label';
    const suffix = isLocal ? ' 🔒 non synchronisé' : '';
    label.innerHTML = `<span class="chevron">▾</span>${escapeHtml(folderName || 'Sans dossier')} (${groupRows.length})${suffix}`;
    headerRow.appendChild(label);

    const actions = document.createElement('span');
    actions.className = 'folder-group-actions';

    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.title = `Ajouter un snippet dans "${folderName || 'Sans dossier'}"`;
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      quickAddToFolder(folderName);
    });
    actions.appendChild(addBtn);

    if (folderName) {
      const renameBtn = document.createElement('button');
      renameBtn.textContent = '✏️';
      renameBtn.title = 'Renommer le dossier';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt(`Renommer le dossier "${folderName}" en :`, folderName);
        if (!newName || newName.trim() === '' || newName.trim() === folderName) return;
        snippets.forEach(s => { if (s.folder === folderName) s.folder = newName.trim(); });
        save(render);
      });
      actions.appendChild(renameBtn);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '🗑️';
      removeBtn.title = 'Supprimer ce dossier (les snippets ne sont pas supprimés)';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Supprimer le dossier "${folderName}" ? Les ${groupRows.length} snippet(s) concerné(s) seront déplacés vers "Sans dossier".`)) return;
        snippets.forEach(s => { if (s.folder === folderName) s.folder = ''; });
        save(render);
      });
      actions.appendChild(removeBtn);
    }

    headerRow.appendChild(actions);

    headerTr.appendChild(headerTd);
    headerTr.addEventListener('click', () => {
      if (collapsedFolders.has(folderName)) collapsedFolders.delete(folderName);
      else collapsedFolders.add(folderName);
      render();
    });
    makeDropTarget(headerTr, folderName);
    bodyEl.appendChild(headerTr);

    if (isCollapsed) return;

    groupRows.forEach(s => renderSnippetRow(s));
  });
}

// Rend un élément (en-tête de groupe ou ligne de snippet) capable de recevoir un snippet glissé
// par sa poignée, pour le déplacer vers le dossier `folderName`.
function makeDropTarget(el, folderName) {
  el.addEventListener('dragover', (e) => {
    if (!draggedSnippet) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drop-target');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop-target');
    if (!draggedSnippet) return;
    if ((draggedSnippet.folder || '') !== folderName) {
      draggedSnippet.folder = folderName;
      save(render);
    }
    draggedSnippet = null;
  });
}

function renderSnippetRow(s) {
  const isLocked = s.origin === 'synced';
  const isLocal = isLocalFolder(s.folder);
  const tr = document.createElement('tr');

  const triggerTd = document.createElement('td');
  triggerTd.className = 'trigger' + (isLocked ? ' locked' : '');
  triggerTd.textContent = s.trigger;
  makeEditable(triggerTd, s, 'trigger', false);

  const contentTd = document.createElement('td');
  contentTd.className = 'content' + (isLocked ? ' locked' : '');
  contentTd.textContent = s.content;
  makeEditable(contentTd, s, 'content', true);

  const actionTd = document.createElement('td');
  actionTd.className = 'action-cell';
  const originBadge = document.createElement('span');
  originBadge.className = 'origin-badge ' + (isLocked ? 'origin-synced' : 'origin-local');
  originBadge.textContent = isLocked ? 'synced' : 'local';
  actionTd.appendChild(originBadge);
  actionTd.appendChild(document.createTextNode(' '));

  const syncIndicator = document.createElement('span');
  syncIndicator.className = 'sync-indicator';
  if (isLocal) {
    syncIndicator.textContent = '🔒 non synchronisé';
    syncIndicator.title = 'Dossier "Local" : jamais envoyé à Google Sheets.';
  } else {
    syncIndicator.textContent = '☁ sync ~10s';
    syncIndicator.title = 'Toute modification est synchronisée vers Google Sheets (~10s après la dernière frappe), pour tous les utilisateurs.';
  }
  actionTd.appendChild(syncIndicator);

  // Glisser cette poignée vers un en-tête de dossier (ou une autre ligne) pour déplacer ce
  // snippet — seule la poignée est "draggable", jamais les cellules éditables, pour ne pas
  // perturber la sélection de texte ni l'édition directe du déclencheur/contenu.
  const dragHandle = document.createElement('span');
  dragHandle.className = 'drag-handle';
  dragHandle.textContent = '⠿';
  dragHandle.title = 'Glisser vers un dossier pour y déplacer ce snippet';
  dragHandle.draggable = true;
  dragHandle.addEventListener('dragstart', (e) => {
    draggedSnippet = s;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', s.trigger);
    tr.classList.add('dragging');
  });
  dragHandle.addEventListener('dragend', () => {
    draggedSnippet = null;
    tr.classList.remove('dragging');
  });
  actionTd.appendChild(dragHandle);
  makeDropTarget(tr, s.folder || '');

  if (isLocked) {
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

function makeEditable(td, snippet, field, multiline) {
  td.setAttribute('contenteditable', 'true');
  td.addEventListener('blur', () => {
    const newValue = multiline ? td.innerText.replace(/\r/g, '') : td.textContent.trim();
    if (snippet[field] === newValue) return;
    if (field === 'trigger' && !newValue) { td.textContent = snippet.trigger; return; }
    snippet[field] = newValue;
    save();
  });
  td.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); td.blur(); }
  });
}

searchEl.addEventListener('input', render);
folderFilterEl.addEventListener('change', render);

// Pré-remplit le formulaire d'ajout avec le dossier concerné et y amène l'utilisateur
function quickAddToFolder(folderName) {
  populateFolderOptions(newFolderSelect, folderName || '');
  newFolderInput.hidden = true;
  document.getElementById('add-snippet-table').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('new-trigger').focus();
}

document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const trigger = document.getElementById('new-trigger').value.trim();
  const content = document.getElementById('new-content').value;
  let folder = newFolderSelect.value;
  if (folder === '__new__') folder = newFolderInput.value.trim();
  if (!trigger || !content) return;

  // Vérifie l'unicité du déclencheur : un conflit avec un snippet synchronisé est autorisé,
  // mais l'utilisateur doit savoir que sa version locale prendra le dessus sur celle en ligne.
  const conflict = snippets.find(s => s.trigger === trigger && s.origin === 'synced');
  if (conflict) {
    const confirmed = confirm(
      `⚠️ Le déclencheur "${trigger}" existe déjà dans la version synchronisée (Google Sheets).\n\n` +
      'Votre snippet local sera prioritaire : c\'est lui qui s\'affichera à la place de la version en ligne pour ce déclencheur.\n\n' +
      'Continuer ?'
    );
    if (!confirmed) return;
  }

  snippets = snippets.filter(s => !(s.trigger === trigger && s.origin !== 'synced'));
  snippets.push({ trigger, content, folder, origin: 'local' });
  save(() => {
    render();
    e.target.reset();
    newFolderInput.hidden = true;
  });
});

// --- Export / Import XLSX (via SheetJS, voir lib/xlsx.full.min.js) ---

document.getElementById('export-xlsx').addEventListener('click', () => {
  const rows = snippets.map(s => ({ trigger: s.trigger, content: s.content, folder: s.folder || '' }));
  const ws = XLSX.utils.json_to_sheet(rows, { header: ['trigger', 'content', 'folder'] });

  // La bibliothèque XLSX gratuite (SheetJS Community) ne peut pas écrire de style de cellule
  // (wrap text, gras...) : elle est silencieusement ignorée à l'export. Les sauts de ligne réels
  // sont en revanche bien conservés dans la valeur — il suffit d'une ligne assez haute pour les
  // rendre visibles à l'ouverture, d'où le calcul de hauteur ci-dessous (propriété de feuille,
  // pas un style de cellule, donc bien écrite par la version gratuite).
  ws['!cols'] = [{ wch: 24 }, { wch: 70 }, { wch: 18 }];
  const LINE_HEIGHT_PX = 15;
  const MIN_ROW_PX = 20;
  ws['!rows'] = [{ hpx: MIN_ROW_PX }, ...rows.map(r => {
    const lineCount = (String(r.content).match(/\n/g) || []).length + 1;
    return { hpx: Math.max(MIN_ROW_PX, lineCount * LINE_HEIGHT_PX) };
  })];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Snippets');
  XLSX.writeFile(wb, 'snippets.xlsx');
});

document.getElementById('import-xlsx').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = new Uint8Array(reader.result);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const imported = rows.map(r => ({
      trigger: String(r.trigger ?? r.Trigger ?? '').trim(),
      content: String(r.content ?? r.Content ?? ''),
      folder: String(r.folder ?? r.Folder ?? '').trim(),
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
  reader.readAsArrayBuffer(file);
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
