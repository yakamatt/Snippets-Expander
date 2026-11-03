const BUILD_DATE = '2026-11-03'; // v2.19.0
const DEFAULT_GITHUB_URL = 'https://raw.githubusercontent.com/yakamatt/Snippets-Expander/main';
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1H2rBzMQzZk74Bk2Z_Mo8lXAdYea7Mi7WfzVruBahd_I/edit';

// Clausier Commun (Google Sheets) : plus affiché sur cette page depuis la v2.18.0, mais
// toujours chargé pour la zone de test.
let snippets = [];
// Clausier Personnel (snippets locaux).
let localSnippets = [];

function load() {
  chrome.storage.local.get(['snippets', 'localSnippets', 'lastSync', 'updateCheck', 'pinBannerDismissed', 'syncWarning'], (res) => {
    snippets = res.snippets || [];
    localSnippets = res.localSnippets || [];
    renderLocal();
    // Lien "Modifier le Clausier Personnel" du popup : la page s'ouvre sur options.html#clausier.
    if (location.hash === '#clausier') document.getElementById('clausier').scrollIntoView({ block: 'start' });
    renderVersionFooter(res.lastSync);
    renderUpdateBanner(res.updateCheck);
    renderSyncWarning(res.syncWarning);
    document.getElementById('pin-banner').hidden = !!res.pinBannerDismissed;
  });
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const s = res.syncSettings || {};
    document.getElementById('autosync-minutes').value = s.autoSyncMinutes ?? 60;
    document.getElementById('expansion-delay').value = s.expansionDelayMs ?? 500;
    document.getElementById('local-folder-path').value = s.localFolderPath || '';
    document.getElementById('auto-check-updates').checked = !!s.autoCheckUpdates;
    document.getElementById('sheet-url').value = s.sheetUrl || '';
    document.getElementById('webapp-url').value = s.webAppUrl || '';
    document.getElementById('open-sheet-link').href = s.sheetUrl || DEFAULT_SHEET_URL;
  });
  renderUpdateMode();
  loadImported();
}

// Suit les changements faits ailleurs : synchro du Clausier Commun en arrière-plan, snippet local
// créé ou modifié depuis Aviso pendant que cette page est ouverte.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.snippets) snippets = changes.snippets.newValue || [];
  if (changes.localSnippets) {
    localSnippets = changes.localSnippets.newValue || [];
    renderLocal();
  }
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Clausier Personnel (snippets locaux) ----------
// Stocké dans chrome.storage.local (clé localSnippets), comme les autres données de
// l'extension : il survit aux mises à jour, mais pas à une désinstallation, d'où l'export.
// Les fichiers (.xlsx, .csv) sont lus et écrits par clausier-fichiers.js.

const localBodyEl = document.getElementById('local-body');
const localSearchEl = document.getElementById('local-search');
const localStatusEl = document.getElementById('local-status');
// Déclencheur en cours de modification dans le tableau : la ligne s'affiche alors en édition, et
// le reste jusqu'à Enregistrer ou Annuler, même si la liste est redessinée entre-temps.
let localEnEdition = null;

function sauverLocal(liste) {
  return chrome.storage.local.set({ localSnippets: liste });
}

function renderLocal() {
  const filtre = (localSearchEl.value || '').toLowerCase();
  document.getElementById('local-count').textContent = localSnippets.length;
  document.getElementById('local-count-list').textContent = localSnippets.length;
  document.getElementById('local-clear').hidden = !localSnippets.length;
  localBodyEl.innerHTML = '';

  const lignes = localSnippets
    .filter(s => !filtre || s.trigger.toLowerCase().includes(filtre) || s.content.toLowerCase().includes(filtre))
    .sort((a, b) => a.trigger.localeCompare(b.trigger, 'fr', { numeric: true }));

  if (!lignes.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'hint';
    td.textContent = localSnippets.length
      ? 'Aucun snippet ne correspond à cette recherche.'
      : 'Aucun snippet personnel pour le moment. Ajoutez-en un ci-dessus, importez un fichier, ou utilisez le bouton "+" sur Aviso.';
    tr.appendChild(td);
    localBodyEl.appendChild(tr);
    return;
  }

  lignes.forEach(s => localBodyEl.appendChild(s.trigger === localEnEdition ? ligneEdition(s) : ligneLecture(s)));
}

function ligneLecture(s) {
  const tr = document.createElement('tr');
  const triggerTd = document.createElement('td');
  triggerTd.className = 'trigger';
  const code = document.createElement('div');
  code.textContent = s.trigger;
  code.title = s.trigger;

  const modifier = document.createElement('button');
  modifier.className = 'link-btn row-action';
  modifier.textContent = 'Modifier';
  modifier.addEventListener('click', () => {
    localEnEdition = s.trigger;
    renderLocal();
  });

  const supprimer = document.createElement('button');
  supprimer.className = 'link-btn row-action';
  supprimer.textContent = 'Supprimer';
  supprimer.addEventListener('click', () => {
    if (!confirm(`Supprimer le snippet "${s.trigger}" du Clausier Personnel ?`)) return;
    sauverLocal(localSnippets.filter(x => x.trigger !== s.trigger));
  });
  triggerTd.append(code, modifier, supprimer);

  const contentTd = document.createElement('td');
  contentTd.className = 'content';
  contentTd.textContent = s.content;

  tr.append(triggerTd, contentTd);
  return tr;
}

function ligneEdition(s) {
  const tr = document.createElement('tr');
  const triggerTd = document.createElement('td');
  triggerTd.className = 'trigger';
  triggerTd.textContent = s.trigger;

  const contentTd = document.createElement('td');
  const textarea = document.createElement('textarea');
  textarea.className = 'local-edit';
  textarea.value = s.content;
  const actions = document.createElement('div');
  actions.className = 'button-row';
  const enregistrer = document.createElement('button');
  enregistrer.textContent = 'Enregistrer';
  enregistrer.addEventListener('click', () => {
    if (!textarea.value.trim()) {
      alert('Le contenu est vide. Pour retirer ce snippet, utilisez "Supprimer".');
      return;
    }
    localEnEdition = null;
    sauverLocal(localSnippets.map(x => x.trigger === s.trigger ? { ...x, content: normaliserContenu(textarea.value) } : x));
  });
  const annuler = document.createElement('button');
  annuler.className = 'secondary';
  annuler.textContent = 'Annuler';
  annuler.addEventListener('click', () => {
    localEnEdition = null;
    renderLocal();
  });
  actions.append(enregistrer, annuler);
  contentTd.append(textarea, actions);

  tr.append(triggerTd, contentTd);
  setTimeout(() => textarea.focus(), 0);
  return tr;
}

// La liste est repliée par défaut (le formulaire d'ajout, lui, reste visible) : elle s'ouvre
// d'elle-même dès qu'une recherche est saisie, sans quoi le filtre agirait sur une liste cachée.
localSearchEl.addEventListener('input', () => {
  if (localSearchEl.value) document.getElementById('local-details').open = true;
  renderLocal();
});

// Effacement complet, irréversible : le Clausier Personnel n'existe que dans ce navigateur. Le
// message le dit et rappelle l'export, seule sauvegarde possible.
document.getElementById('local-clear').addEventListener('click', () => {
  const nb = localSnippets.length;
  if (!nb) return;
  if (!confirm(`⚠️ Supprimer ${nb > 1 ? `les ${nb} snippets` : 'le snippet'} du Clausier Personnel ?\n\n` +
    'Cette suppression est définitive : ces snippets ne sont sauvegardés nulle part ailleurs que dans ce navigateur. ' +
    'Pensez à les exporter (.xlsx ou .csv) avant, si vous voulez pouvoir les retrouver.')) return;
  localEnEdition = null;
  sauverLocal([]).then(() => {
    localStatusEl.textContent = `🗑️ ${nb} snippet${nb > 1 ? 's' : ''} supprimé${nb > 1 ? 's' : ''} du Clausier Personnel.`;
  });
});

document.getElementById('local-add-btn').addEventListener('click', () => {
  const triggerEl = document.getElementById('local-new-trigger');
  const contentEl = document.getElementById('local-new-content');
  const trigger = normaliserDeclencheur(triggerEl.value);
  const content = normaliserContenu(contentEl.value);
  if (!trigger || !content.trim()) {
    localStatusEl.textContent = '❌ Renseignez un déclencheur et un contenu.';
    return;
  }
  const existant = localSnippets.find(s => s.trigger === trigger);
  if (existant && !confirm(`Le snippet "${trigger}" existe déjà dans le Clausier Personnel. Remplacer son contenu ?`)) return;
  const liste = existant
    ? localSnippets.map(s => s.trigger === trigger ? { ...s, content } : s)
    : [...localSnippets, { trigger, content }];
  sauverLocal(liste).then(() => {
    localStatusEl.textContent = `✅ Snippet "${trigger}" ${existant ? 'modifié' : 'ajouté'}.`;
    triggerEl.value = '';
    contentEl.value = '';
  });
});

// --- Import ---
// Rien n'est remplacé sans accord : à chaque déclencheur déjà présent avec un contenu différent,
// une fenêtre propose de remplacer ou d'ignorer, pour ce snippet seul ou pour tous les suivants.
// "Annuler l'import" (ou Échap) n'écrit rien du tout : l'enregistrement n'a lieu qu'à la fin.

const conflitDialog = document.getElementById('conflit-dialog');

function demanderConflit(trigger, actuel, nouveau, restantes) {
  return new Promise(resolve => {
    conflitDialog.returnValue = '';
    document.getElementById('conflit-trigger').textContent = trigger;
    document.getElementById('conflit-actuel').textContent = actuel;
    document.getElementById('conflit-nouveau').textContent = nouveau;
    document.getElementById('conflit-reste').textContent = restantes
      ? `Encore ${restantes} ligne${restantes > 1 ? 's' : ''} du fichier à traiter après celle-ci.`
      : 'Dernière ligne du fichier.';
    conflitDialog.addEventListener('close', () => resolve(conflitDialog.returnValue || 'annuler'), { once: true });
    conflitDialog.showModal();
  });
}

async function importerClausier(file) {
  localStatusEl.textContent = '⏳ Lecture du fichier...';
  let resultat;
  try {
    resultat = await lireFichierClausier(file);
  } catch (e) {
    localStatusEl.textContent = `❌ Import impossible : ${e.message}`;
    return;
  }
  const { snippets: entrants, ignorees } = resultat;
  if (!entrants.length) {
    localStatusEl.textContent = '❌ Aucun snippet trouvé. Le fichier doit avoir une colonne "declencheur" et une colonne "contenu" (voir le modèle vierge).';
    return;
  }

  const { localSnippets: actuels } = await chrome.storage.local.get(['localSnippets']);
  const liste = (actuels || []).slice();
  const index = new Map(liste.map((s, i) => [s.trigger, i]));
  let ajoutes = 0, remplaces = 0, conserves = 0, identiques = 0;
  let choixPourTous = null;

  for (let n = 0; n < entrants.length; n++) {
    const s = entrants[n];
    const i = index.get(s.trigger);
    if (i === undefined) {
      index.set(s.trigger, liste.length);
      liste.push(s);
      ajoutes++;
      continue;
    }
    if (liste[i].content === s.content) {
      identiques++;
      continue;
    }
    let choix = choixPourTous;
    if (!choix) {
      const reponse = await demanderConflit(s.trigger, liste[i].content, s.content, entrants.length - n - 1);
      if (reponse === 'annuler') {
        localStatusEl.textContent = 'Import annulé : le Clausier Personnel n\'a pas été modifié.';
        return;
      }
      choix = reponse.replace('-tout', '');
      if (reponse.endsWith('-tout')) choixPourTous = choix;
    }
    if (choix === 'remplacer') {
      liste[i] = { ...liste[i], content: s.content };
      remplaces++;
    } else {
      conserves++;
    }
  }

  await sauverLocal(liste);
  const parties = [`${ajoutes} ajouté${ajoutes > 1 ? 's' : ''}`];
  if (remplaces) parties.push(`${remplaces} remplacé${remplaces > 1 ? 's' : ''}`);
  if (conserves) parties.push(`${conserves} conservé${conserves > 1 ? 's' : ''} tel${conserves > 1 ? 's' : ''} quel${conserves > 1 ? 's' : ''}`);
  if (identiques) parties.push(`${identiques} déjà identique${identiques > 1 ? 's' : ''}`);
  if (ignorees) parties.push(`${ignorees} ligne${ignorees > 1 ? 's' : ''} sans déclencheur ou sans contenu ignorée${ignorees > 1 ? 's' : ''}`);
  localStatusEl.textContent = `✅ Import de ${file.name} : ${parties.join(', ')}.`;
}

document.getElementById('local-import-file').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // permet de réimporter le même fichier après correction
  if (file) importerClausier(file);
});

// --- Export ---

function nomFichierExport(extension) {
  const jour = new Date().toISOString().slice(0, 10);
  return `clausier-personnel-${jour}.${extension}`;
}

function exporterClausier(format) {
  if (!localSnippets.length) {
    localStatusEl.textContent = 'Le Clausier Personnel est vide : rien à exporter. Le modèle vierge sert à préparer un import.';
    return;
  }
  const liste = localSnippets.slice().sort((a, b) => a.trigger.localeCompare(b.trigger, 'fr', { numeric: true }));
  telechargerFichier(format === 'xlsx' ? clausierVersXlsx(liste) : clausierVersCsv(liste), nomFichierExport(format));
  localStatusEl.textContent = `📤 ${liste.length} snippet${liste.length > 1 ? 's' : ''} exporté${liste.length > 1 ? 's' : ''} en .${format}.`;
}

document.getElementById('local-export-xlsx').addEventListener('click', () => exporterClausier('xlsx'));
document.getElementById('local-export-csv').addEventListener('click', () => exporterClausier('csv'));
document.getElementById('local-template-xlsx').addEventListener('click', () =>
  telechargerFichier(clausierVersXlsx([]), 'clausier-personnel-modele.xlsx'));
document.getElementById('local-template-csv').addEventListener('click', () =>
  telechargerFichier(clausierVersCsv([]), 'clausier-personnel-modele.csv'));

// ---------- DatAviso AI (données de dossier importées) ----------
// Aperçu ligne par ligne (un champ = une ligne) des données importées depuis le popup.
// Suppression article par article, ou en bloc. Le tableau est replié par défaut (il peut
// compter des centaines de lignes) et s'ouvre de lui-même dès qu'une recherche est saisie.

let importedArticles = [];

const importedBodyEl = document.getElementById('imported-body');
const importedCountEl = document.getElementById('imported-count');
const importedSearchEl = document.getElementById('imported-search');

function loadImported() {
  chrome.storage.local.get(['importedArticles', 'importedMeta'], (res) => {
    importedArticles = res.importedArticles || [];
    renderImported();
    renderImportedMeta(res.importedMeta);
  });
}

const importedMetaEl = document.getElementById('imported-meta');
const IMPORTED_META_DEFAUT = importedMetaEl.textContent; // texte d'aide d'avant tout import

function renderImportedMeta(meta) {
  const quand = meta && meta.importedAt && importedArticles.length ? new Date(meta.importedAt).toLocaleString() : null;
  importedMetaEl.textContent = quand
    ? `Dernier import DatAviso AI : ${quand}${meta.source ? ` (${meta.source})` : ''}. ` +
      `Sur Aviso, une icône verte apparaît sur les lignes dont le Référentiel figure ci-dessous et ajoute ces champs dans "Dispositions réalisées" — sans le titre de l'article.`
    : IMPORTED_META_DEFAUT;
}

function renderImported() {
  const filter = (importedSearchEl.value || '').toLowerCase();
  importedCountEl.textContent = importedArticles.length;
  document.getElementById('imported-clear').hidden = !importedArticles.length;
  importedBodyEl.innerHTML = '';

  const rows = importedArticles.filter(a => {
    if (!filter) return true;
    return a.code.toLowerCase().includes(filter) ||
           (a.titre || '').toLowerCase().includes(filter) ||
           a.champs.some(c => (c.label + ' ' + c.valeur).toLowerCase().includes(filter));
  });

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'hint';
    td.textContent = importedArticles.length
      ? 'Aucun article ne correspond à cette recherche.'
      : 'Aucune donnée DatAviso AI. Utilisez le popup de l\'icône pour importer un fichier .txt.';
    tr.appendChild(td);
    importedBodyEl.appendChild(tr);
    return;
  }

  rows.forEach(article => {
    const tr = document.createElement('tr');

    const codeTd = document.createElement('td');
    codeTd.className = 'trigger';
    const codeLine = document.createElement('div');
    codeLine.textContent = article.code;
    const delBtn = document.createElement('button');
    delBtn.className = 'link-btn imported-del';
    delBtn.textContent = 'Supprimer';
    delBtn.addEventListener('click', () => {
      importedArticles = importedArticles.filter(a => a !== article);
      chrome.storage.local.set({ importedArticles }, renderImported);
    });
    codeTd.append(codeLine, delBtn);

    // Le titre de l'article est affiché ici pour se repérer, mais jamais inséré dans Aviso.
    const champsTd = document.createElement('td');
    champsTd.className = 'content';
    if (article.titre) {
      const titre = document.createElement('div');
      titre.className = 'imported-titre';
      titre.textContent = article.titre;
      champsTd.appendChild(titre);
    }
    article.champs.forEach(c => {
      const line = document.createElement('div');
      line.className = 'imported-champ';
      // Une ligne conservée sans libellé (non reconnue comme "Libellé : valeur") s'affiche telle
      // quelle, sans deux-points orphelins.
      if (c.label) {
        const label = document.createElement('span');
        label.className = 'imported-label';
        label.textContent = c.label + ' : ';
        line.appendChild(label);
      }
      line.appendChild(document.createTextNode(c.valeur));
      champsTd.appendChild(line);
    });

    tr.append(codeTd, champsTd);
    importedBodyEl.appendChild(tr);
  });
}

importedSearchEl.addEventListener('input', () => {
  if (importedSearchEl.value) document.getElementById('imported-details').open = true;
  renderImported();
});

// Même import que dans le popup (popup.js, runImport) : chaque import REMPLACE entièrement les
// données précédentes, le fichier faisant foi pour le dossier en cours.
const importedStatusEl = document.getElementById('imported-status');

document.getElementById('imported-file').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // permet de réimporter le même fichier après correction
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => { importedStatusEl.textContent = '❌ Lecture du fichier impossible.'; };
  reader.onload = () => {
    const articles = parseImportedData(String(reader.result));
    if (!articles.length) {
      importedStatusEl.textContent = '❌ Aucun article détecté. Chaque bloc doit commencer par une ligne d\'en-tête du type "GN 12 — Titre".';
      return;
    }
    const meta = { importedAt: new Date().toISOString(), source: file.name, count: articles.length };
    chrome.storage.local.set({ importedArticles: articles, importedMeta: meta }, () => {
      importedArticles = articles;
      renderImported();
      renderImportedMeta(meta);
      const codes = articles.slice(0, 3).map(a => a.code).join(', ');
      importedStatusEl.textContent =
        `✅ ${articles.length} article${articles.length > 1 ? 's' : ''} importé${articles.length > 1 ? 's' : ''} (${codes}${articles.length > 3 ? '…' : ''}).`;
    });
  };
  reader.readAsText(file, 'utf-8');
});

document.getElementById('imported-clear').addEventListener('click', () => {
  const nb = importedArticles.length;
  if (!nb) return;
  if (!confirm(`Effacer ${nb > 1 ? `les ${nb} articles` : "l'article"} DatAviso AI ?`)) return;
  importedArticles = [];
  chrome.storage.local.set({ importedArticles: [], importedMeta: null }, () => {
    renderImported();
    renderImportedMeta(null);
    importedStatusEl.textContent = '🗑️ Données DatAviso AI effacées.';
  });
});

// Un import fait depuis le popup doit se voir immédiatement si cette page est déjà ouverte.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.importedArticles) loadImported(); // relit aussi la date d'import
});

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

// Les deux adresses du tableau de référence. Enregistrées telles quelles après une validation
// de forme : une URL mal formée est signalée immédiatement plutôt que de faire échouer
// silencieusement la prochaine synchro.
function validerUrl(valeur, motAttendu) {
  const v = valeur.trim();
  if (!v) return null;
  let u;
  try { u = new URL(v); } catch { return 'adresse invalide'; }
  if (u.protocol !== 'https:') return 'l\'adresse doit commencer par https://';
  if (!u.hostname.endsWith('google.com')) return 'ce n\'est pas une adresse Google';
  // Seul hôte de script autorisé dans host_permissions (manifest.json) : une autre adresse
  // serait enregistrée, mais chaque synchro échouerait faute de permission.
  if (motAttendu === '/exec' && u.hostname !== 'script.google.com') return 'l\'adresse doit commencer par https://script.google.com/';
  if (motAttendu && !v.includes(motAttendu)) return `l'adresse devrait contenir "${motAttendu}"`;
  return null;
}

function brancherChampUrl(id, cle, motAttendu, apresEnregistrement) {
  document.getElementById(id).addEventListener('change', (e) => {
    const statusEl = document.getElementById('sheet-url-status');
    const valeur = e.target.value.trim();
    const erreur = validerUrl(valeur, motAttendu);
    if (erreur) {
      statusEl.textContent = `❌ ${erreur}`;
      return;
    }
    updateSyncSettings({ [cle]: valeur }, () => {
      statusEl.textContent = valeur ? '✅ Adresse enregistrée.' : '✅ Adresse effacée (valeur par défaut utilisée).';
      if (apresEnregistrement) apresEnregistrement(valeur);
    });
  });
}

brancherChampUrl('sheet-url', 'sheetUrl', '/spreadsheets/', (v) => {
  document.getElementById('open-sheet-link').href = v || DEFAULT_SHEET_URL;
});
brancherChampUrl('webapp-url', 'webAppUrl', '/exec');

document.getElementById('local-folder-path').addEventListener('change', (e) => {
  updateSyncSettings({ localFolderPath: e.target.value.trim() });
});

document.getElementById('auto-check-updates').addEventListener('change', (e) => {
  updateSyncSettings({ autoCheckUpdates: e.target.checked });
});

document.getElementById('check-update-btn').addEventListener('click', () => {
  document.getElementById('update-status').textContent = '⏳ Vérification en cours...';
  chrome.runtime.sendMessage({ type: 'CHECK_FOR_UPDATES' }, (resp) => {
    if (resp && resp.ok) {
      document.getElementById('update-status').textContent = resp.isNewer
        ? `⬆️ Nouvelle version disponible : ${resp.remoteVersion} (actuelle : ${resp.localVersion})`
        : `✅ Vous êtes à jour (v${resp.localVersion}).`;
      if (resp.isNewer) populateUpdateSteps(resp.remoteVersion); else hideUpdateSteps();
      chrome.storage.local.get(['updateCheck'], (r) => renderUpdateBanner(r.updateCheck));
    } else {
      hideUpdateSteps();
      document.getElementById('update-status').textContent = '❌ Erreur : ' + (resp && resp.error);
    }
  });
});

// Construit l'URL de téléchargement du zip à partir du dépôt GitHub fixé dans le code
// (https://raw.githubusercontent.com/USER/REPO/BRANCH -> zip via codeload.github.com)
function getRepoZipUrl() {
  const m = DEFAULT_GITHUB_URL.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  const [, user, repo, branch] = m;
  return `https://codeload.github.com/${user}/${repo}/zip/refs/heads/${branch}`;
}

// Convertit un chemin local (Unix ou Windows) en URL file:// cliquable. Chrome ouvre ce type de
// lien en listant le contenu du dossier, ce qui permet de le retrouver en un clic plutôt que de
// se souvenir de son emplacement exact.
function pathToFileUrl(path) {
  const normalized = path.trim().replace(/\\/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : '/' + normalized;
  return 'file://' + encodeURI(withLeadingSlash);
}

// Affiche la marche à suivre détaillée pour mettre à jour manuellement l'extension (mode
// développeur uniquement, voir renderUpdateMode) : lien de téléchargement direct du zip,
// puis les étapes pour le remplacer et recharger l'extension.
function populateUpdateSteps(remoteVersion) {
  const zipUrl = getRepoZipUrl();
  const downloadLink = document.getElementById('update-download-link');
  if (zipUrl) {
    downloadLink.href = zipUrl;
    downloadLink.textContent = `⬇️ Télécharger le zip de la version ${remoteVersion}`;
  } else {
    downloadLink.removeAttribute('href');
    downloadLink.textContent = '⬇️ URL du dépôt GitHub invalide, téléchargement indisponible';
  }

  const folderStep = document.getElementById('update-folder-step');
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const path = ((res.syncSettings || {}).localFolderPath || '').trim();
    folderStep.innerHTML = path
      ? `Remplacez les fichiers dans <a href="${escapeHtml(pathToFileUrl(path))}" target="_blank" rel="noopener noreferrer">le dossier de l'extension</a> (ne créez pas un nouveau dossier)`
      : `Remplacez les fichiers dans le <strong>même dossier</strong> que celui actuellement chargé dans Chrome (ne créez pas un nouveau dossier). <em>Astuce : renseignez son chemin ci-dessus pour obtenir un lien direct ici la prochaine fois.</em>`;
  });

  document.getElementById('update-steps').hidden = false;
}

function hideUpdateSteps() {
  document.getElementById('update-steps').hidden = true;
}

// Chrome bloque la navigation directe vers chrome:// depuis un lien classique (<a href>) ;
// chrome.tabs.create() y est en revanche autorisé depuis le script d'une page d'extension.
document.getElementById('open-extensions-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/' });
});

document.getElementById('update-banner-btn').addEventListener('click', () => {
  document.getElementById('advanced-panel').hidden = false;
  document.getElementById('toggle-advanced').textContent = '⚙️ Paramètres avancés ▴';
  document.getElementById('update-block-dev').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

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
  if (updateCheck && updateCheck.isNewer) {
    banner.hidden = false;
    document.getElementById('update-banner-text').innerHTML =
      `⬆️ Nouvelle version disponible : <strong>${escapeHtml(updateCheck.remoteVersion)}</strong> (actuelle : ${escapeHtml(updateCheck.localVersion)})`;
    populateUpdateSteps(updateCheck.remoteVersion);
  } else {
    banner.hidden = true;
  }
}

// Signale qu'une synchro a été refusée parce que le tableau distant était vide : les snippets
// locaux sont alors la dernière copie existante, il faut le dire clairement plutôt que de
// laisser croire à une simple erreur réseau.
function renderSyncWarning(warning) {
  const el = document.getElementById('sync-warning');
  if (!warning || !warning.message) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = `⚠️ ${warning.message}`;
}

function renderVersionFooter(lastSync) {
  const version = chrome.runtime.getManifest().version;
  const footer = document.getElementById('version-footer');
  const syncTxt = lastSync ? `Dernière mise à jour : ${new Date(lastSync).toLocaleString()}` : 'Aucune mise à jour effectuée';
  footer.textContent = `Snippet Expander v${version} — build du ${BUILD_DATE} — ${syncTxt}`;
}

// ---------- Zone de test ----------
// Reproduit en simplifié l'expansion de content.js (déclencheur le plus long en cas de
// conflit, {date}/{time}/{cursor}, temporisation configurable) directement sur ce textarea.
// Nécessaire car les scripts de contenu ne s'exécutent jamais sur les pages de l'extension
// elle-même : ce n'est donc pas le vrai content.js qui tourne ici, mais un équivalent local
// testé contre les snippets réellement chargés, pour un aperçu fidèle — y compris la priorité du
// Clausier Personnel sur le Clausier Commun à déclencheur égal (rebuildActiveSnippets).
let testTimeoutId = null;

function testActiveSnippets() {
  const locaux = new Set(localSnippets.map(s => s.trigger));
  return localSnippets.concat(snippets.filter(s => !locaux.has(s.trigger)));
}

function testResolveContent(text) {
  const now = new Date();
  return text
    .replace(/\{date\}/gi, now.toLocaleDateString())
    .replace(/\{time\}/gi, now.toLocaleTimeString())
    .replace(/\{cursor\}/gi, '');
}

function testFindMatch(actifs, before) {
  return actifs
    .slice()
    .sort((a, b) => b.trigger.length - a.trigger.length)
    .find(s => before.endsWith(s.trigger));
}

document.getElementById('test-area').addEventListener('input', (e) => {
  const el = e.target;
  const start = el.selectionStart;
  const actifs = testActiveSnippets();
  if (start == null || start === 0 || !actifs.length) return;
  const maxTriggerLen = actifs.reduce((m, s) => Math.max(m, s.trigger.length), 1);
  const before = el.value.substring(Math.max(0, start - maxTriggerLen), start);
  const match = testFindMatch(actifs, before);
  if (!match) return;

  if (testTimeoutId) clearTimeout(testTimeoutId);
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const delay = (res.syncSettings || {}).expansionDelayMs ?? 500;
    testTimeoutId = setTimeout(() => {
      testTimeoutId = null;
      // Revérifie le contexte juste avant d'agir : la frappe a pu continuer entre-temps et invalider le match.
      const start2 = el.selectionStart;
      if (start2 == null) return;
      const before2 = el.value.substring(Math.max(0, start2 - maxTriggerLen), start2);
      if (!before2.endsWith(match.trigger)) return;

      const cursorMarker = match.content.search(/\{cursor\}/i);
      const replacement = testResolveContent(match.content);
      const triggerStart = start2 - match.trigger.length;
      el.value = el.value.substring(0, triggerStart) + replacement + el.value.substring(start2);

      const newPos = cursorMarker >= 0
        ? triggerStart + testResolveContent(match.content.substring(0, cursorMarker)).length
        : triggerStart + replacement.length;
      el.setSelectionRange(newPos, newPos);
    }, delay);
  });
});

load();
