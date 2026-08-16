// background.js — récupération en lecture seule depuis Google Sheets, ouverture des options, vérification de mise à jour

const SYNC_ALARM = 'snippet-sync';
const UPDATE_ALARM = 'snippet-update-check';
const DEFAULT_GITHUB_URL = 'https://raw.githubusercontent.com/yakamatt/Snippets-Expander/main';
const DEFAULT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwlew8sAl_APmmZS5bpedGnSf6Ukn0Tvs3S93BGGwt6pwUMzg1uwfOWq91zEhTUVJG9/exec';

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
      autoSyncMinutes: 60,
      expansionDelayMs: 500,
      avisoIconEnabled: true,
      autoCheckUpdates: true
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
      chrome.runtime.openOptionsPage();
    }

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
    pullFromSheet().catch(e => console.error('[Snippet Expander] Échec de la synchro automatique :', e.message));
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

  await chrome.storage.local.set({ snippets, lastSync: new Date().toISOString() });
  return snippets;
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

  if (isNewer) {
    chrome.action.setBadgeText({ text: '⬆' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Snippet Expander — mise à jour disponible',
        message: `Version ${remoteVersion} disponible (actuelle : ${localVersion}). Ouvrez les paramètres pour mettre à jour.`
      });
    }
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
    pullFromSheet().then(merged => sendResponse({ ok: true, merged })).catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'RESCHEDULE_ALARM') {
    scheduleAlarms();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'CHECK_FOR_UPDATES') {
    checkForUpdates().then(r => sendResponse({ ok: true, ...r })).catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
