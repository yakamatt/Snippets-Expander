// background.js — synchro Google Sheets (fusion), ouverture des options, vérification de mise à jour

const SYNC_ALARM = 'snippet-sync';
const UPDATE_ALARM = 'snippet-update-check';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['snippets'], (res) => {
    if (!res.snippets) chrome.storage.local.set({ snippets: [] });
  });
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const defaults = {
      webAppUrl: '',
      autoSyncMinutes: 0,
      expansionDelayMs: 1000,
      syncPriority: 'remote', // 'remote' = Google Sheets écrase les doublons locaux | 'local' = les snippets locaux sont conservés
      githubRepoUrl: '',
      autoCheckUpdates: false
    };
    chrome.storage.sync.set({ syncSettings: { ...defaults, ...(res.syncSettings || {}) } });
  });
  scheduleAlarms();
});

chrome.runtime.onStartup.addListener(scheduleAlarms);

// Clic sur l'icône de la barre d'outils → ouvre directement les paramètres
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

function scheduleAlarms() {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const settings = res.syncSettings || {};
    chrome.alarms.clear(SYNC_ALARM);
    if (settings.autoSyncMinutes > 0) {
      chrome.alarms.create(SYNC_ALARM, { periodInMinutes: settings.autoSyncMinutes });
    }
    chrome.alarms.clear(UPDATE_ALARM);
    if (settings.autoCheckUpdates && settings.githubRepoUrl) {
      chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 720 }); // 2x/jour
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) pullFromSheet();
  if (alarm.name === UPDATE_ALARM) checkForUpdates();
});

// ---------- Synchro Google Sheets avec FUSION (ne supprime jamais les snippets locaux) ----------

async function pullFromSheet() {
  const { syncSettings } = await chrome.storage.sync.get(['syncSettings']);
  if (!syncSettings || !syncSettings.webAppUrl) throw new Error('URL du Web App non configurée');

  const res = await fetch(syncSettings.webAppUrl);
  const remoteRaw = await res.json();
  if (!Array.isArray(remoteRaw)) throw new Error('Réponse invalide du Web App');

  const remoteSnippets = remoteRaw.map(s => ({
    trigger: s.trigger,
    content: s.content,
    description: s.description || '',
    folder: s.folder || '',
    origin: 'synced'
  }));

  const { snippets: current } = await chrome.storage.local.get(['snippets']);
  const currentList = current || [];
  const priority = syncSettings.syncPriority || 'remote';

  const localOnly = currentList.filter(s => s.origin !== 'synced');
  const remoteTriggersSet = new Set(remoteSnippets.map(s => s.trigger));

  let merged;
  if (priority === 'local') {
    // Les triggers locaux gagnent en cas de doublon : on ignore la version distante correspondante
    const localTriggers = new Set(localOnly.map(s => s.trigger));
    const remoteFiltered = remoteSnippets.filter(s => !localTriggers.has(s.trigger));
    merged = [...localOnly, ...remoteFiltered];
  } else {
    // Priorité distante (par défaut) : si un trigger local entre en conflit avec un trigger
    // synchronisé, la version distante remplace la version locale pour ce trigger précis.
    const localFiltered = localOnly.filter(s => !remoteTriggersSet.has(s.trigger));
    merged = [...localFiltered, ...remoteSnippets];
  }

  await chrome.storage.local.set({ snippets: merged, lastSync: new Date().toISOString() });
  return merged;
}

async function pushToSheet() {
  const { syncSettings } = await chrome.storage.sync.get(['syncSettings']);
  const { snippets } = await chrome.storage.local.get(['snippets']);
  if (!syncSettings || !syncSettings.webAppUrl) throw new Error('URL du Web App non configurée');

  const payload = (snippets || []).map(s => ({
    trigger: s.trigger, content: s.content, description: s.description || '', folder: s.folder || ''
  }));

  const res = await fetch(syncSettings.webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ---------- Vérification de mise à jour via GitHub ----------
// Compare le "version" du manifest.json publié sur GitHub (raw) à la version installée.
// Auto-update silencieux impossible pour une extension chargée en mode développeur (Chrome ne
// permet pas à une extension de réécrire ses propres fichiers) : on notifie seulement l'utilisateur.

async function checkForUpdates() {
  const { syncSettings } = await chrome.storage.sync.get(['syncSettings']);
  if (!syncSettings || !syncSettings.githubRepoUrl) return null;

  const base = syncSettings.githubRepoUrl.replace(/\/$/, '');
  const manifestUrl = `${base}/manifest.json`;
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
  if (msg.type === 'PUSH_TO_SHEET') {
    pushToSheet().then(r => sendResponse({ ok: true, result: r })).catch(e => sendResponse({ ok: false, error: e.message }));
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
