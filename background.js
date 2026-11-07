// background.js — récupération du Clausier Commun, sauvegarde du Clausier Personnel, statistiques
// d'utilisation, tutoriel, vérification de mise à jour

const SYNC_ALARM = 'snippet-sync';
const UPDATE_ALARM = 'snippet-update-check';
const DEFAULT_GITHUB_URL = 'https://raw.githubusercontent.com/yakamatt/Snippets-Expander/main';
const DEFAULT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzEAXT4ew2XasiZ_e7m9wtalf5f-duBVVI7Apw5z28iPLGjbJU-tujy5dTDYlEvFgDe/exec';
// Anciennes adresses par défaut du script. Le réglage webAppUrl est enregistré à l'installation et
// survit aux mises à jour : sans cette liste, les utilisateurs existants resteraient sur l'ancien
// déploiement, qui sert l'ancien code (pas de sauvegarde du Clausier Personnel avant l'API v4).
// Une adresse saisie à la main dans Paramètres avancés n'est jamais remplacée.
const ANCIENNES_WEBAPP_URLS = [
  'https://script.google.com/macros/s/AKfycbwlew8sAl_APmmZS5bpedGnSf6Ukn0Tvs3S93BGGwt6pwUMzg1uwfOWq91zEhTUVJG9/exec'
];
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
      sauvegardeClausier: true,
      statistiquesUtilisation: true
    };
    const merged = { ...defaults, ...(syncSettings || {}) };
    // La synchro auto toutes les heures est active par défaut : si elle est encore désactivée
    // (valeur héritée d'avant l'introduction de ce défaut), on la (ré)active à chaque installation/mise à jour.
    if (!merged.autoSyncMinutes) merged.autoSyncMinutes = 60;
    if (ANCIENNES_WEBAPP_URLS.includes(merged.webAppUrl)) merged.webAppUrl = DEFAULT_WEBAPP_URL;
    await chrome.storage.sync.set({ syncSettings: merged });

    const { snippets } = await chrome.storage.local.get(['snippets']);
    if (!snippets) await chrome.storage.local.set({ snippets: [] });

    if (isFreshInstall) {
      // Première installation : importe les snippets partagés AVANT d'ouvrir les paramètres
      // (pour inciter à épingler l'extension), afin que la page affiche déjà les snippets dès son ouverture.
      await pullFromSheet().catch(() => {});
    }

    // Tutoriel : à l'installation initiale seulement, jamais à une mise à jour (il reste
    // accessible depuis le popup). Il remplace l'ouverture des Paramètres et invite lui-même à
    // épingler l'extension.
    if (details.reason === 'install') {
      chrome.tabs.create({ url: chrome.runtime.getURL('tutoriel.html') });
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
    await envoyerStatistiques()
      .catch(e => console.error('[Snippet Expander] Statistiques d\'utilisation :', e.message));
  }
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
  if (settings.sauvegardeClausier === false) return { statut: 'desactivee', envoyes: 0 };
  if (!settings.webAppUrl) return { statut: 'sans-tableau', envoyes: 0 };

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
    return { statut: liste.length ? 'a-jour' : 'vide', envoyes: 0 };
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
  return { statut: 'envoyee', envoyes: aEnvoyer.length };
}

// ---------- Statistiques d'utilisation ----------
// Compteurs anonymes, pour mesurer l'adoption et savoir quelles fonctions servent : combien de
// fois chaque fonction a servi, par jour. Jamais le texte tapé ou inséré, ni l'adresse d'une page,
// ni un déclencheur, ni une donnée d'Aviso. Les pages et le script de contenu signalent un usage
// par un message STAT ; tout est compté ici, à la file (fileStats), pour que deux onglets qui
// comptent en même temps ne s'écrasent pas.
//
// Envoi avec la synchro, dans l'onglet "Statistiques" du Google Sheets : une ligne par
// utilisateur et par jour, que le script remplace à chaque envoi. On envoie donc les totaux du
// jour, jamais un écart : un envoi répété ou retenté ne compte rien deux fois. Le jour courant
// part même sans aucun usage (la ligne dit alors seulement que l'extension est installée et
// active), puis à nouveau dès qu'un compteur bouge. Une fois envoyés, les jours passés sont
// oubliés : rien ne s'accumule dans le navigateur.
const STATS_CLES = [
  'clavier_commun', 'clavier_perso', 'clavier_hors_aviso',
  'aviso_commun', 'aviso_perso', 'aviso_crayon', 'aviso_plus', 'aviso_dataviso',
  'aviso_sitesecurite', 'aviso_corbeille', 'aviso_annuler',
  'lien_sgo', 'lien_sharepoint', 'lien_explorateur',
  'import_dataviso', 'clausier_import', 'clausier_export',
  'popup', 'parametres', 'tutoriel'
];
let fileStats = Promise.resolve();

function aLaFileStats(tache) {
  const suite = fileStats.then(tache);
  fileStats = suite.catch(() => {});
  return suite;
}

// Date locale (et non UTC) : une journée de travail ne doit pas se couper à 1 h du matin.
function jourLocal(d = new Date()) {
  const n = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}`;
}

async function statistiquesActives() {
  const { syncSettings } = await chrome.storage.sync.get(['syncSettings']);
  return (syncSettings || {}).statistiquesUtilisation !== false;
}

function compterUsage(cle) {
  if (!STATS_CLES.includes(cle)) return Promise.resolve();
  return aLaFileStats(async () => {
    if (!(await statistiquesActives())) return;
    const jour = jourLocal();
    const { statsJours } = await chrome.storage.local.get(['statsJours']);
    const jours = statsJours || {};
    const compteurs = jours[jour] = jours[jour] || {};
    compteurs[cle] = (compteurs[cle] || 0) + 1;
    await chrome.storage.local.set({ statsJours: jours });
  });
}

async function envoyerStatistiques() {
  const { syncSettings } = await chrome.storage.sync.get(['syncSettings']);
  const settings = syncSettings || {};
  if (settings.statistiquesUtilisation === false) {
    // Désactivé : ce qui n'est pas encore parti ne partira jamais.
    await aLaFileStats(() => chrome.storage.local.remove(['statsJours', 'statsEnvoyes']));
    return { statut: 'desactivee', envoyes: 0 };
  }
  if (!settings.webAppUrl) return { statut: 'sans-tableau', envoyes: 0 };

  const aujourdhui = jourLocal();
  const { statsJours, statsEnvoyes, localSnippets, importedArticles } = await chrome.storage.local.get(
    ['statsJours', 'statsEnvoyes', 'localSnippets', 'importedArticles']);
  const envoyes = statsEnvoyes || {};
  const jours = { ...(statsJours || {}) };
  jours[aujourdhui] = jours[aujourdhui] || {};
  // État de l'installation, joint au jour courant seulement : il dit l'adoption (version déployée,
  // Clausier Personnel commencé, DatAviso AI utilisé), pas un usage.
  const etat = {
    version: chrome.runtime.getManifest().version,
    snippetsPerso: (localSnippets || []).length,
    articlesDataviso: (importedArticles || []).length
  };
  // Le jour courant repart quand ses compteurs ou l'état changent. Un jour passé repart une
  // dernière fois avec ses totaux définitifs, sans l'état (le script garde celui déjà reçu), puis
  // il est oublié.
  const marque = (date) => empreinte(JSON.stringify(jours[date]) + (date === aujourdhui ? JSON.stringify(etat) : ''));
  const lot = Object.keys(jours).sort()
    .filter(date => envoyes[date] !== marque(date))
    .map(date => ({ date, ...(date === aujourdhui ? etat : {}), compteurs: jours[date] }));
  if (!lot.length) return { statut: 'a-jour', envoyes: 0 };

  const sonde = settings.webAppUrl + (settings.webAppUrl.includes('?') ? '&' : '?') + 'probe=stats';
  let signature;
  try {
    signature = await (await fetch(sonde, { cache: 'no-store' })).json();
  } catch {
    throw new Error('Script Google Sheets injoignable ou réponse illisible');
  }
  if (Array.isArray(signature) || !signature || signature.api !== 'stats') {
    throw new Error('Script Google Sheets sans statistiques (à redéployer en "Nouvelle version") : envoi reporté');
  }

  const refUser = await refUtilisateur();
  const res = await fetch(settings.webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'stats', refUser, jours: lot })
  });
  const data = res.ok ? await res.json().catch(() => null) : null;
  if (!data || !data.ok) throw new Error((data && data.error) || `Statistiques refusées (${res.status})`);

  // Relu dans la file : un usage compté pendant l'envoi ne doit pas être effacé. Le jour courant
  // reste (il continue de compter) ; les jours passés envoyés sont oubliés.
  await aLaFileStats(async () => {
    const etatActuel = await chrome.storage.local.get(['statsJours', 'statsEnvoyes']);
    const restants = etatActuel.statsJours || {};
    const memo = etatActuel.statsEnvoyes || {};
    lot.forEach(j => {
      if (j.date === aujourdhui) memo[j.date] = empreinte(JSON.stringify(j.compteurs) + JSON.stringify(etat));
      else { delete restants[j.date]; delete memo[j.date]; }
    });
    // Un jour passé qui n'a plus rien à envoyer n'a plus besoin de son empreinte.
    Object.keys(memo).forEach(d => { if (d < aujourdhui && !restants[d]) delete memo[d]; });
    await chrome.storage.local.set({ statsJours: restants, statsEnvoyes: memo });
  });
  return { statut: 'envoyee', envoyes: lot.length };
}

// Un import DatAviso AI peut partir du popup comme des Paramètres : on le compte à sa source
// commune, la date d'import qu'ils écrivent tous deux. Supprimer un article ne la change pas.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.importedMeta) return;
  const avant = changes.importedMeta.oldValue, apres = changes.importedMeta.newValue;
  if (apres && apres.importedAt && (!avant || avant.importedAt !== apres.importedAt)) {
    compterUsage('import_dataviso');
  }
});

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

// ---------- Messages des pages de l'extension et du script de contenu ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Bouton « Forcer l'actualisation » des Paramètres : même enchaînement que synchroniser(), mais
  // le résultat de la sauvegarde est renvoyé à part, pour être affiché sous le bouton (c'est là
  // qu'on voit si le script Apps Script a bien été redéployé).
  if (msg.type === 'PULL_FROM_SHEET') {
    (async () => {
      const reponse = {};
      try {
        reponse.merged = await pullFromSheet();
        reponse.ok = true;
      } catch (e) {
        reponse.ok = false;
        reponse.error = e.message;
      }
      try {
        reponse.sauvegarde = { ok: true, ...(await sauvegarderClausierPersonnel()) };
      } catch (e) {
        reponse.sauvegarde = { ok: false, error: e.message };
      }
      try {
        reponse.statistiques = { ok: true, ...(await envoyerStatistiques()) };
      } catch (e) {
        reponse.statistiques = { ok: false, error: e.message };
      }
      sendResponse(reponse);
    })();
    return true;
  }
  if (msg.type === 'STAT') {
    compterUsage(msg.cle);
    sendResponse({ ok: true });
    return false;
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
