const BUILD_DATE = '2026-07-24'; // v1.9.1
const DEFAULT_GITHUB_URL = 'https://raw.githubusercontent.com/yakamatt/Snippets-Expander/main';
const DEFAULT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwlew8sAl_APmmZS5bpedGnSf6Ukn0Tvs3S93BGGwt6pwUMzg1uwfOWq91zEhTUVJG9/exec';

// Un snippet est synchronisé sauf si sa propriété `shared` vaut explicitement false (undefined =
// partagé, pour rester compatible avec les snippets créés avant l'ajout de ce champ).
function isShared(s) {
  return s.shared !== false;
}

let snippets = [];
const collapsedFolders = new Set();
// Déclencheur du snippet à mettre en avant (scroll + focus) au prochain rendu, positionné juste
// avant un save() suite à une création, une duplication ou un changement de dossier.
let pendingFocusTrigger = null;

const bodyEl = document.getElementById('snippets-body');
const countEl = document.getElementById('count');
const searchEl = document.getElementById('search');
const folderFilterEl = document.getElementById('folder-filter');
const localOnlyFilterEl = document.getElementById('local-only-filter');
const newFolderSelect = document.getElementById('new-folder-select');
const newFolderInput = document.getElementById('new-folder-input');
const newSharedToggle = document.getElementById('new-shared-toggle');
const newSharedToggleLabel = document.getElementById('new-shared-toggle-label');

newSharedToggle.addEventListener('change', () => {
  newSharedToggleLabel.textContent = newSharedToggle.checked ? 'Partagé' : 'Privé';
});

function load() {
  chrome.storage.local.get(['snippets', 'lastSync', 'updateCheck', 'pinBannerDismissed'], (res) => {
    snippets = res.snippets || [];
    // Migration : les versions précédentes rangeaient les snippets non partagés dans un dossier
    // réservé "Local" plutôt que via une propriété dédiée. On convertit une fois pour toutes vers
    // la propriété `shared`, et on vide ce dossier qui n'a plus de sens particulier.
    let migrated = false;
    snippets.forEach(s => {
      if (typeof s.shared !== 'boolean') {
        const wasLocalFolder = String(s.folder || '').trim().toLowerCase() === 'local';
        s.shared = !wasLocalFolder;
        if (wasLocalFolder) s.folder = '';
        migrated = true;
      }
    });
    if (migrated) chrome.storage.local.set({ snippets });
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
    document.getElementById('sync-delay').value = s.syncDelaySeconds ?? 5;
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
    scheduleSyncNow();
  });
}

// Toute modification (ajout, édition, suppression, changement de dossier...) programme un envoi
// vers Google Sheets après un court délai (réglable, "Paramètres avancés", 5s par défaut) : ça
// regroupe plusieurs modifications rapprochées en un seul envoi. Les snippets dont la propriété
// `shared` vaut false restent exclus de l'envoi (voir background.js pushToSheet).
// Le statut est écrit à la fois dans le panneau avancé (#sync-status) et dans une ligne toujours
// visible sous "Mes snippets" (#live-sync-status) : sans ça, un échec de synchro (ex: URL absente,
// erreur réseau) restait invisible pour qui n'ouvre jamais "Paramètres avancés", et donnait
// l'impression que la synchro "ne marche pas" sans jamais montrer pourquoi.
function setSyncStatus(msg) {
  ['sync-status', 'live-sync-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  });
}

let syncDebounceTimer = null;

function scheduleSyncNow() {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const delaySec = (res.syncSettings || {}).syncDelaySeconds ?? 5;
    if (syncDebounceTimer) { clearTimeout(syncDebounceTimer); syncDebounceTimer = null; }
    if (!delaySec) { syncNow(); return; }
    setSyncStatus(`⏳ Synchronisation dans ${delaySec}s...`);
    syncDebounceTimer = setTimeout(() => {
      syncDebounceTimer = null;
      syncNow();
    }, delaySec * 1000);
  });
}

// Filet de sécurité : si l'onglet Options est masqué (fermé, changé) avant la fin du délai,
// l'envoi est déclenché immédiatement plutôt que d'être silencieusement perdu.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
    syncNow();
  }
});

function syncNow() {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    if (!(res.syncSettings || {}).webAppUrl) {
      setSyncStatus('⚠️ Aucune URL Google Sheets configurée : ce snippet reste local uniquement (Paramètres avancés > Partage & synchro).');
      console.warn('[Snippet Expander] Synchro ignorée : aucune URL Google Sheets configurée (syncSettings.webAppUrl).');
      return;
    }
    chrome.runtime.sendMessage({ type: 'PUSH_TO_SHEET' }, (resp) => {
      if (chrome.runtime.lastError) {
        setSyncStatus('❌ Erreur de synchronisation : ' + chrome.runtime.lastError.message);
        console.error('[Snippet Expander] Erreur de messagerie lors de la synchro :', chrome.runtime.lastError.message);
        return;
      }
      if (resp && resp.ok) {
        setSyncStatus('✅ Synchronisation automatique effectuée.');
      } else {
        setSyncStatus('❌ Erreur de synchronisation automatique : ' + (resp && resp.error));
        console.error('[Snippet Expander] Échec de la synchro (PUSH_TO_SHEET) :', resp && resp.error);
      }
    });
  });
}

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

// ---------- Dossiers : selects ----------

// Remplit un <select> avec "Sans dossier" + la liste des dossiers + "Nouveau dossier"
function populateFolderOptions(selectEl, selectedValue) {
  const folders = getFolders();
  selectEl.innerHTML = '<option value="">Sans dossier</option>' +
    folders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('') +
    '<option value="__new__">➕ Nouveau dossier...</option>';
  selectEl.value = (selectedValue && folders.includes(selectedValue)) ? selectedValue : '';
}

function renderFolderSelects() {
  const folders = getFolders();
  const currentFilter = folderFilterEl.value;
  folderFilterEl.innerHTML = '<option value="">Tous les dossiers</option>' +
    folders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
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
  const localOnly = localOnlyFilterEl.checked;

  renderFolderSelects();

  const rows = snippets.filter(s => {
    if (localOnly && isShared(s)) return false;
    if (folderFilter && s.folder !== folderFilter) return false;
    if (!filter) return true;
    return s.trigger.toLowerCase().includes(filter) ||
           s.content.toLowerCase().includes(filter);
  });

  countEl.textContent = snippets.length;
  bodyEl.innerHTML = '';

  // Le dossier du snippet à mettre en avant doit être déplié, sans quoi sa ligne ne serait pas
  // construite du tout (voir la mise en avant en fin de fonction).
  if (pendingFocusTrigger) {
    const focusTarget = snippets.find(sn => sn.trigger === pendingFocusTrigger);
    if (focusTarget) collapsedFolders.delete(focusTarget.folder || '');
  }

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
    // à la largeur de la seule 1re colonne au lieu de sommer les 3 colonnes couvertes).
    const headerTd = document.createElement('td');
    headerTd.colSpan = 3;
    const headerRow = document.createElement('div');
    headerRow.className = 'folder-group-td';
    headerTd.appendChild(headerRow);

    const label = document.createElement('span');
    label.className = 'folder-group-label';
    label.innerHTML = `<span class="chevron">▾</span>${escapeHtml(folderName || 'Sans dossier')} (${groupRows.length})`;
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
    bodyEl.appendChild(headerTr);

    if (isCollapsed) return;

    groupRows.forEach(s => renderSnippetRow(s));
  });

  // Met en avant le snippet créé/dupliqué/déplacé lors de la dernière action (scroll + focus) :
  // le tableau étant entièrement reconstruit à chaque rendu, tout focus précédent est de toute façon perdu.
  if (pendingFocusTrigger) {
    const targetRow = Array.from(bodyEl.querySelectorAll('tr')).find(tr => {
      const td = tr.querySelector('td.trigger');
      return td && td.textContent === pendingFocusTrigger;
    });
    if (targetRow) {
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const triggerTd = targetRow.querySelector('td.trigger');
      if (triggerTd) triggerTd.focus();
    }
    pendingFocusTrigger = null;
  }
}

// Copie indépendante d'un snippet, marquée "privé" (shared:false) : n'affecte jamais l'original.
// Utilisée à la fois par le passage Partagé → Privé de l'interrupteur et par le bouton
// "Dupliquer en privé" des snippets synchronisés.
function duplicateAsPrivate(s) {
  const copy = { ...s, origin: 'local', shared: false, trigger: s.trigger + '-privé' };
  snippets.push(copy);
  pendingFocusTrigger = copy.trigger;
  save(render);
}

function renderSnippetRow(s) {
  const isLocked = s.origin === 'synced';
  const shared = isShared(s);
  const tr = document.createElement('tr');
  // Toute ligne "privé" a une apparence propre (texte atténué), quelle que soit son origine :
  // dès qu'un snippet redevient "partagé", ce rendu recalcule ses classes et son apparence
  // redevient identique à celle des autres snippets partagés, sans rien de plus à faire.
  if (!shared) tr.classList.add('snippet-private');

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

  // Interrupteur Partagé/Privé : Privé → Partagé modifie ce snippet sur place (il rejoint la
  // synchro Google Sheets) ; Partagé → Privé ne touche pas à l'original, il crée une copie privée
  // indépendante (voir duplicateAsPrivate, aussi utilisée par le bouton "Dupliquer en privé").
  const syncToggleWrap = document.createElement('label');
  syncToggleWrap.className = 'sync-toggle';
  const syncToggleInput = document.createElement('input');
  syncToggleInput.type = 'checkbox';
  syncToggleInput.checked = shared;
  const syncToggleText = document.createElement('span');
  syncToggleText.className = 'sync-toggle-label';
  syncToggleText.textContent = shared ? 'Partagé' : 'Privé';
  syncToggleWrap.title = shared
    ? 'Partagé : envoyé immédiatement à Google Sheets, visible et modifiable par toute l\'équipe.'
    : 'Privé : jamais envoyé à Google Sheets, reste uniquement sur cet appareil.';

  syncToggleInput.addEventListener('change', () => {
    if (syncToggleInput.checked) {
      // Privé → Partagé : modifie ce snippet sur place, pas de copie
      const confirmed = confirm(
        '⚠️ Ce snippet ne sera plus privé : il va être envoyé immédiatement à Google Sheets, ' +
        'visible et modifiable par toute l\'équipe.\n\n' +
        'Continuer ?'
      );
      if (!confirmed) { syncToggleInput.checked = false; return; }
      s.shared = true;
      save(render);
    } else {
      // Partagé → Privé : ne modifie pas l'original, crée une copie indépendante marquée "privé"
      const confirmed = confirm(
        '⚠️ Ce snippet va être dupliqué en version privée : la copie restera uniquement sur cet ' +
        'appareil et ne sera jamais envoyée à Google Sheets. Ce snippet-ci (partagé) n\'est pas modifié.\n\n' +
        'Continuer ?'
      );
      if (!confirmed) { syncToggleInput.checked = true; return; }
      duplicateAsPrivate(s);
    }
  });

  syncToggleWrap.appendChild(syncToggleInput);
  syncToggleWrap.appendChild(syncToggleText);
  actionTd.appendChild(syncToggleWrap);

  // Icône dédiée pour changer de dossier : au clic, se transforme en sélecteur (réutilise la
  // même liste que le formulaire d'ajout), pour ne jamais avoir un <select> toujours visible
  // sur chaque ligne ni interférer avec l'édition directe du déclencheur/contenu.
  const folderBtn = document.createElement('button');
  folderBtn.className = 'folder-btn';
  folderBtn.textContent = '📁';
  folderBtn.title = 'Changer de dossier';
  folderBtn.addEventListener('click', () => {
    const select = document.createElement('select');
    select.className = 'row-folder-select';
    populateFolderOptions(select, s.folder || '');
    select.addEventListener('change', () => {
      if (select.value === '__new__') {
        const newName = prompt('Nom du nouveau dossier :', '');
        if (!newName || !newName.trim()) { render(); return; }
        s.folder = newName.trim();
      } else {
        s.folder = select.value;
      }
      pendingFocusTrigger = s.trigger;
      save(render);
    });
    select.addEventListener('blur', () => render());
    folderBtn.replaceWith(select);
    select.focus();
  });
  actionTd.appendChild(folderBtn);

  if (isLocked) {
    const dupBtn = document.createElement('button');
    dupBtn.className = 'dup';
    dupBtn.textContent = 'Dupliquer en privé';
    dupBtn.addEventListener('click', () => duplicateAsPrivate(s));
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
localOnlyFilterEl.addEventListener('change', render);

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
  snippets.push({ trigger, content, folder, origin: 'local', shared: newSharedToggle.checked });
  pendingFocusTrigger = trigger;
  save(() => {
    render();
    e.target.reset();
    newFolderInput.hidden = true;
    newSharedToggleLabel.textContent = 'Privé';
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
      origin: 'local',
      shared: true
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

document.getElementById('sync-delay').addEventListener('change', (e) => {
  updateSyncSettings({ syncDelaySeconds: parseInt(e.target.value, 10) || 0 });
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
