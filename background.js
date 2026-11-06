// background.js — récupération du Clausier Commun, sauvegarde du Clausier Personnel, tutoriel, vérification de mise à jour

const SYNC_ALARM = 'snippet-sync';
const UPDATE_ALARM = 'snippet-update-check';
const DEFAULT_GITHUB_URL = 'https://raw.githubusercontent.com/yakamatt/Snippets-Expander/main';
const DEFAULT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwlew8sAl_APmmZS5bpedGnSf6Ukn0Tvs3S93BGGwt6pwUMzg1uwfOWq91zEhTUVJG9/exec';
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1H2rBzMQzZk74Bk2Z_Mo8lXAdYea7Mi7WfzVruBahd_I/edit';

chrome.runtime.onInstalled.addListener((details) => {
  // Tout est enchaîné séquentiellement (await) dans une seule chaîne asynchrone : sur une
  // installation fraîche, on ne doit ouvrir les paramètres qu'une fois l'import terminé, sans
  // quoi la page Options se charge (et lit le storage) avant la fin du fetch réseau de
  // pullFromSheet(), et affiche "Mes snippets (0)" même si l'import réussit juste après.
  (async () => {
    const { syncSettings } = await chrome.storage.sync.get(['syncSettings']);
    const isFreshInstall = details.reason === 'install' && !syncSettings;

    const defaults = {
      webAppUrl: DEFAULT_WEBAPP_URL,
      sheetUrl: DEFAULT_SHEET_URL,
      autoSyncMinutes: 60,
      expansionDelayMs: 500,
      autoCheckUpdates: true,
      sauvegardeClausier: true
    };
    const merged = { ...defaults, ...(syncSettings || {}) };
    // La synchro auto toutes les heures est active par défaut : si elle est encore désactivée
    // (valeur héritée d'avant l'introduction de ce défaut), on la (ré)active à chaque installation/mise à jour.
    if (!merged.autoSyncMinutes) merged.autoSyncMinutes = 60;
    await chrome.storage.sync.set({ syncSettings: merged });

    const { snippets } = await chrome.storage.local.get(['snippets']);
    if (!snippets) await chrome.storage.local.set({ snippets: [] });

    if (isFreshInstall) {
      // Première installation : importe les snippets partagés AVANT d'ouvrir les paramètres
      // (pour inciter à épingler l'extension), afin que la page affiche déjà les snippets dès son ouverture.
      await pullFromSheet().catch(() => {});
    }

    // Tutoriel : à la première installation, et à la mise à jour pour qui ne l'a pas encore vu
    // dans sa version actuelle (tous les utilisateurs d'avant la v2.21.0). Il remplace
    // l'ouverture des Paramètres et invite lui-même à épingler l'extension.
    if (details.reason === 'install' || details.reason === 'update') {
      await ouvrirTutorielSiNouveau();
    }

    // Première sauvegarde du Clausier Personnel dès l'installation de la mise à jour, sans
    // attendre l'alarme : c'est elle qui récupère les snippets locaux déjà existants.
    await sauvegarderClausierPersonnel()
      .catch(e => console.error('[Snippet Expander] Sauvegarde du Clausier Personnel :', e.message));

    scheduleAlarms();
  })();
});

chrome.runtime.onStartup.addListener(scheduleAlarms);

// Note : pas de listener chrome.action.onClicked ici — un "default_popup" est déclaré dans le
// manifest (popup.html), donc Chrome affiche directement le popup au clic sur l'icône et
// n'émet jamais cet événement.

function scheduleAlarms() {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const settings = res.syncSettings || {};
    chrome.alarms.clear(SYNC_ALARM);
    if (settings.autoSyncMinutes > 0) {
      chrome.alarms.create(SYNC_ALARM, { periodInMinutes: settings.autoSyncMinutes });
    }
    chrome.alarms.clear(UPDATE_ALARM);
    // La vérification GitHub n'a de sens qu'en mode développeur ("non empaquetée") : une fois
    // publiée sur le Chrome Web Store, Chrome met à jour l'extension tout seul.
    chrome.management.getSelf((info) => {
      const isDev = info.installType === 'development';
      if (isDev && settings.autoCheckUpdates) {
        chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 720 }); // 2x/jour
      }
    });
  });
}

// Les erreurs (réseau hors ligne, Web App inaccessible, dépôt GitHub injoignable...) sont
// attendues de temps en temps sur un déclenchement en arrière-plan : sans .catch() ici, un
// simple "Failed to fetch" devenait une promesse rejetée non gérée ("Uncaught (in promise)").
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) {
    synchroniser().catch(e => console.error('[Snippet Expander] Échec de la synchro automatique :', e.message));
  }
  if (alarm.name === UPDATE_ALARM) {
    checkForUpdates().catch(e => console.error('[Snippet Expander] Échec de la vérification de mise à jour :', e.message));
  }
});

// ---------- Récupération en lecture seule depuis Google Sheets ----------
// L'extension ne modifie jamais le Sheet : les données affichées remplacent entièrement les
// snippets locaux à chaque récupération (rien à fusionner, il n'y a plus d'édition locale à préserver).

async function pullFromSheet() {
  const { syncSettings } = await chrome.storage.sync.get(['syncSettings']);
  if (!syncSettings || !syncSettings.webAppUrl) throw new Error('URL du Web App non configurée');

  const res = await fetch(syncSettings.webAppUrl);
  const remoteRaw = await res.json();
  if (!Array.isArray(remoteRaw)) throw new Error('Réponse invalide du Web App');

  const snippets = remoteRaw.map(s => ({
    trigger: s.trigger,
    content: s.content,
    folder: s.folder || ''
  }));

  // Garde-fou : un tableau distant vide n'écrase jamais une liste locale non vide. Sans cela, un
  // tableau accidentellement vidé se propage à l'extension à la synchro suivante, et la dernière
  // copie des snippets disparaît avec. La copie locale est conservée et l'anomalie signalée dans
  // la page Paramètres ; vider délibérément le tableau reste possible en supprimant d'abord les
  // snippets locaux, ou en réinstallant l'extension.
  const { snippets: locaux } = await chrome.storage.local.get(['snippets']);
  if (!snippets.length && locaux && locaux.length) {
    await chrome.storage.local.set({
      syncWarning: {
        at: new Date().toISOString(),
        kept: locaux.length,
        message: `Le tableau Google Sheets est revenu vide alors que ${locaux.length} snippets étaient enregistrés. ` +
                 `Ils ont été conservés et n'ont pas été écrasés : vérifiez le tableau (Fichier > Historique des versions).`
      }
    });
    throw new Error('Tableau distant vide : synchro ignorée pour ne pas perdre les snippets locaux');
  }

  await chrome.storage.local.set({ snippets, lastSync: new Date().toISOString(), syncWarning: null });
  return snippets;
}

// Synchro complète : récupération du Clausier Commun, puis sauvegarde du Clausier Personnel, à
// la même fréquence. La sauvegarde a lieu même si la récupération échoue (et inversement) : les
// deux sont indépendantes, seule l'erreur de récupération est renvoyée à l'appelant.
async function synchroniser() {
  try {
    return await pullFromSheet();
  } finally {
    await sauvegarderClausierPersonnel()
      .catch(e => console.error('[Snippet Expander] Sauvegarde du Clausier Personnel :', e.message));
  }
}

// ---------- Tutoriel ----------
// À incrémenter quand le tutoriel change assez pour être remontré à tous : c'est aussi le moyen
// d'annoncer des nouveautés (il n'y a pas de page « notes de mise à jour » séparée).
const TUTORIEL_VERSION = 1;

async function ouvrirTutorielSiNouveau() {
  const { tutorielVu } = await chrome.storage.local.get(['tutorielVu']);
  if ((tutorielVu || 0) >= TUTORIEL_VERSION) return;
  // Marqué vu dès l'ouverture : un onglet fermé sans aller au bout ne se rouvre pas.
  await chrome.storage.local.set({ tutorielVu: TUTORIEL_VERSION });
  chrome.tabs.create({ url: chrome.runtime.getURL('tutoriel.html') });
}

// ---------- Sauvegarde du Clausier Personnel ----------
// Copie anonyme des snippets locaux dans l'onglet "Local_Snippets_Backup" du Google Sheets, pour
// enrichir le Clausier Commun. Ce n'est pas une sauvegarde restaurable : l'extension ne relit
// jamais cet onglet, l'export reste la copie personnelle de l'utilisateur.
//
// Seuls les snippets ajoutés ou modifiés depuis la dernière sauvegarde réussie partent : on garde
// une empreinte du contenu envoyé par déclencheur (backupEmpreintes). Comparer à l'état stocké
// plutôt que d'intercepter chaque écriture couvre d'un coup l'édition sur Aviso, les Paramètres,
// l'import, et les snippets antérieurs à cette fonction (aucune empreinte : tout part la première
// fois). Un échec ne met pas les empreintes à jour : l'envoi est retenté à la synchro suivante.
const SAUVEGARDE_LOT = 200;

function empreinte(texte) {
  // FNV-1a 32 bits : il ne s'agit que de détecter un changement, pas de sécurité.
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

async function refUtilisateur() {
  // Identifiant aléatoire, sans lien avec le compte : stocké dans storage.sync pour rester le
  // même sur tous les postes de l'utilisateur.
  const { refUser } = await chrome.storage.sync.get(['refUser']);
  if (refUser) return refUser;
  const nouveau = crypto.randomUUID();
  await chrome.storage.sync.set({ refUser: nouveau });
  return nouveau;
}

async function sauvegarderClausierPersonnel() {
  const { syncSettings } = await chrome.storage.sync.get(['syncSettings']);
  const settings = syncSettings || {};
  if (settings.sauvegardeClausier === false || !settings.webAppUrl) return;

  const { localSnippets, backupEmpreintes } = await chrome.storage.local.get(['localSnippets', 'backupEmpreintes']);
  const liste = (localSnippets || []).filter(s => s && s.trigger);
  const empreintes = {};
  // Les déclencheurs supprimés sont oubliés : recréés plus tard, ils repartiront.
  liste.forEach(s => {
    if (backupEmpreintes && backupEmpreintes[s.trigger]) empreintes[s.trigger] = backupEmpreintes[s.trigger];
  });
  const aEnvoyer = liste.filter(s => empreintes[s.trigger] !== empreinte(String(s.content || '')));
  if (!aEnvoyer.length) {
    await chrome.storage.local.set({ backupEmpreintes: empreintes });
    return;
  }

  // Même garde-fou que le "+" : rien n'est posté à un script qui ne se déclare pas compatible.
  const sonde = settings.webAppUrl + (settings.webAppUrl.includes('?') ? '&' : '?') + 'probe=backup';
  let signature;
  try {
    signature = await (await fetch(sonde, { cache: 'no-store' })).json();
  } catch {
    throw new Error('Script Google Sheets injoignable ou réponse illisible');
  }
  if (Array.isArray(signature) || !signature || signature.api !== 'backup') {
    throw new Error('Script Google Sheets sans sauvegarde (à redéployer en "Nouvelle version") : envoi reporté');
  }

  const refUser = await refUtilisateur();
  for (let i = 0; i < aEnvoyer.length; i += SAUVEGARDE_LOT) {
    const lot = aEnvoyer.slice(i, i + SAUVEGARDE_LOT)
      .map(s => ({ trigger: s.trigger, content: String(s.content || '') }));
    const res = await fetch(settings.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'backup', refUser, snippets: lot })
    });
    const data = res.ok ? await res.json().catch(() => null) : null;
    if (!data || !data.ok) throw new Error((data && data.error) || `Sauvegarde refusée (${res.status})`);
    // Enregistré lot par lot : un échec au milieu ne renvoie pas ce qui est déjà passé.
    lot.forEach(s => { empreintes[s.trigger] = empreinte(s.content); });
    await chrome.storage.local.set({ backupEmpreintes: empreintes, lastBackup: new Date().toISOString() });
  }
}

// ---------- Création d'un snippet dans le Google Sheets ----------
// Depuis la v2.18.0, le bouton "+" d'Aviso crée un snippet dans le Clausier Personnel (local) :
// ce chemin n'est plus appelé, mais il est conservé, garde-fous compris, pour pouvoir être
// rebranché sans réécrire la poignée de main avec Code.gs.
//
// Ajoute une ligne au tableau (déclencheur + le texte déjà saisi dans la cellule Aviso, s'il y en
// a), récupère les données mises à jour, puis ouvre le tableau positionné sur la cellule
// "content" pour la compléter ou la relire.
//
// La requête part du service worker et non du script de contenu : les permissions d'hôte de
// l'extension s'y appliquent, la requête n'est donc pas soumise au CORS de la page Aviso.
// Content-Type en text/plain — Apps Script lit e.postData.contents tel quel, et ce type évite
// la requête de pré-vérification CORS.

// Vérifie que le script déployé expose bien l'ajout de ligne, AVANT de lui envoyer quoi que ce
// soit. Indispensable : une version antérieure de Code.gs réécrivait le tableau entier sur
// n'importe quel POST (clearContents puis réécriture), si bien qu'un POST vers un script pas
// encore redéployé effaçait tous les snippets. Le script récent répond ici un objet signé ;
// l'ancien, qui ignore le paramètre, renvoie le tableau des snippets — ce qui suffit à le
// reconnaître et à ne rien lui envoyer.
async function verifierApiAjout(webAppUrl) {
  const url = webAppUrl + (webAppUrl.includes('?') ? '&' : '?') + 'probe=append';
  let data;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    data = await res.json();
  } catch {
    throw new Error('Script Google Sheets injoignable ou réponse illisible');
  }
  if (Array.isArray(data) || !data || data.api !== 'append') {
    throw new Error(
      'Script Google Sheets obsolète : redéployez-le en "Nouvelle version" avant de créer un snippet ' +
      '(Déployer > Gérer les déploiements > crayon > Nouvelle version).'
    );
  }
}

async function createSnippetRow(trigger, content) {
  const { syncSettings } = await chrome.storage.sync.get(['syncSettings']);
  const settings = syncSettings || {};
  if (!settings.webAppUrl) throw new Error('URL du Web App non configurée (Paramètres avancés)');

  await verifierApiAjout(settings.webAppUrl);

  const res = await fetch(settings.webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    // content : texte déjà saisi dans la cellule Aviso. Un script déployé en version 2 ignore ce
    // champ et crée la ligne vide — dégradé mais sans perte, le tableau s'ouvrant de toute façon
    // sur la cellule à saisir.
    body: JSON.stringify({ action: 'append', trigger, content: content || '' })
  });
  if (!res.ok) throw new Error(`Le tableau a répondu ${res.status}`);

  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Réponse illisible du tableau');
  if (!data.ok) throw new Error(data.error || 'Ajout refusé par le tableau');
  // Le script déployé peut être une version antérieure, qui ignore l'action "append" : sans
  // numéro de ligne en retour, rien n'a été créé — mieux vaut le dire que d'ouvrir le tableau
  // au hasard en laissant croire que c'est fait.
  if (!data.row) throw new Error('Script Apps Script obsolète : redéployez-le en nouvelle version');

  await pullFromSheet().catch(e => console.error('[Snippet Expander] Synchro après ajout :', e.message));

  const base = (data.sheetUrl || settings.sheetUrl || DEFAULT_SHEET_URL).split('#')[0];
  // Colonne B = "content" : l'utilisateur arrive directement sur la cellule à saisir.
  const url = `${base}#gid=${data.gid || 0}&range=B${data.row}`;
  chrome.tabs.create({ url });

  return { created: data.created !== false, row: data.row };
}

// ---------- Vérification de mise à jour via GitHub ----------
// Compare le "version" du manifest.json publié sur GitHub (raw) à la version installée.
// Auto-update silencieux impossible pour une extension chargée en mode développeur (Chrome ne
// permet pas à une extension de réécrire ses propres fichiers) : on notifie seulement l'utilisateur.

async function checkForUpdates() {
  const manifestUrl = `${DEFAULT_GITHUB_URL}/manifest.json`;
  const res = await fetch(manifestUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossible de lire manifest.json sur GitHub (' + res.status + ')');
  const remoteManifest = await res.json();
  const remoteVersion = remoteManifest.version;
  const localVersion = chrome.runtime.getManifest().version;

  const isNewer = compareVersions(remoteVersion, localVersion) > 0;
  await chrome.storage.local.set({
    updateCheck: { remoteVersion, localVersion, isNewer, checkedAt: new Date().toISOString() }
  });

  // Signalée par le badge de l'icône et le bandeau de la page Paramètres. Plus de notification
  // système depuis la v2.18.1 : la permission "notifications" ne servait qu'en mode développeur,
  // et le Chrome Web Store refuse une permission qu'une installation depuis le Store n'utilise pas.
  if (isNewer) {
    chrome.action.setBadgeText({ text: '⬆' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
  return { remoteVersion, localVersion, isNewer };
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

// ---------- Messages depuis options.js ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PULL_FROM_SHEET') {
    synchroniser().then(merged => sendResponse({ ok: true, merged })).catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'RESCHEDULE_ALARM') {
    scheduleAlarms();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'CREATE_SNIPPET_ROW') {
    createSnippetRow(msg.trigger, msg.content)
      .then(r => sendResponse({ ok: true, ...r }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'CHECK_FOR_UPDATES') {
    checkForUpdates().then(r => sendResponse({ ok: true, ...r })).catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
