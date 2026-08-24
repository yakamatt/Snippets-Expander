// content.js — détecte et remplace les snippets, avec temporisation et mise en forme

let SNIPPETS = [];
let IMPORTED_ARTICLES = [];
let MAX_TRIGGER_LEN = 1;
let EXPANSION_DELAY_MS = 1000;
let AVISO_ICON_ENABLED = true;
let pendingTimeoutId = null;

// Déclarés avant loadSnippets() car référencés depuis son callback : chrome.storage est
// documenté comme toujours asynchrone, mais ces déclarations restent en TDZ tant que le script
// ne les a pas atteintes — les placer ici évite toute fragilité d'ordre d'exécution.
const AVISO_HOSTNAME = 'aviso2.bureauveritas.com';
const AVISO_ICON_CLASS = 'snippet-expander-aviso-icon';
const AVISO_LAW_CLASS = 'snippet-expander-aviso-law';
const AVISO_IMPORT_CLASS = 'snippet-expander-aviso-import';

function isAvisoSite() {
  return location.hostname === AVISO_HOSTNAME;
}

function loadSnippets() {
  chrome.storage.local.get(['snippets', 'importedArticles'], (res) => {
    SNIPPETS = res.snippets || [];
    IMPORTED_ARTICLES = res.importedArticles || [];
    MAX_TRIGGER_LEN = SNIPPETS.reduce((m, s) => Math.max(m, s.trigger.length), 1);
    if (isAvisoSite()) scheduleAvisoScan();
  });
}
function loadSettings() {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const s = res.syncSettings || {};
    EXPANSION_DELAY_MS = Number.isFinite(s.expansionDelayMs) ? s.expansionDelayMs : 1000;
    AVISO_ICON_ENABLED = s.avisoIconEnabled !== false;
    if (isAvisoSite()) applyAvisoIconSetting();
  });
}
loadSnippets();
loadSettings();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.snippets) {
    SNIPPETS = changes.snippets.newValue || [];
    MAX_TRIGGER_LEN = SNIPPETS.reduce((m, s) => Math.max(m, s.trigger.length), 1);
    if (isAvisoSite()) scheduleAvisoScan();
  }
  // Un import depuis le popup doit se voir tout de suite sur l'onglet Aviso déjà ouvert : les
  // icônes obsolètes sont retirées, puis un scan les repose d'après les nouvelles données.
  if (area === 'local' && changes.importedArticles) {
    IMPORTED_ARTICLES = changes.importedArticles.newValue || [];
    if (isAvisoSite()) {
      document.querySelectorAll('.' + AVISO_IMPORT_CLASS).forEach(el => el.remove());
      scheduleAvisoScan();
    }
  }
  if (area === 'sync' && changes.syncSettings) {
    const s = changes.syncSettings.newValue || {};
    EXPANSION_DELAY_MS = Number.isFinite(s.expansionDelayMs) ? s.expansionDelayMs : 1000;
    AVISO_ICON_ENABLED = s.avisoIconEnabled !== false;
    if (isAvisoSite()) applyAvisoIconSetting();
  }
});

function resolveContent(text) {
  const now = new Date();
  return text
    .replace(/\{date\}/gi, now.toLocaleDateString())
    .replace(/\{time\}/gi, now.toLocaleTimeString())
    .replace(/\{cursor\}/gi, '');
}

function findCursorOffset(rawText) {
  return rawText.search(/\{cursor\}/i);
}

function findMatch(before) {
  return SNIPPETS
    .slice()
    .sort((a, b) => b.trigger.length - a.trigger.length)
    .find(s => before.endsWith(s.trigger));
}

function setNativeValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && descriptor.set) descriptor.set.call(element, value);
  else element.value = value;
}

// ---------- INPUT / TEXTAREA ----------

function doExpandInInput(el, match) {
  const start = el.selectionStart;
  if (start == null) return;
  const value = el.value;
  const before = value.substring(Math.max(0, start - MAX_TRIGGER_LEN), start);
  if (!before.endsWith(match.trigger)) return; // le contexte a changé entre-temps, on annule

  const cursorMarker = findCursorOffset(match.content);
  const replacement = resolveContent(match.content); // \n est préservé nativement dans <textarea>
  const triggerStart = start - match.trigger.length;
  const newValue = value.substring(0, triggerStart) + replacement + value.substring(start);

  setNativeValue(el, newValue);

  let newPos;
  if (cursorMarker >= 0) {
    const beforeCursor = resolveContent(match.content.substring(0, cursorMarker));
    newPos = triggerStart + beforeCursor.length;
  } else {
    newPos = triggerStart + replacement.length;
  }
  el.setSelectionRange(newPos, newPos);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function tryExpandInInput(el) {
  const start = el.selectionStart;
  if (start == null || start === 0) return;
  const value = el.value;
  const windowStart = Math.max(0, start - MAX_TRIGGER_LEN);
  const before = value.substring(windowStart, start);
  const match = findMatch(before);
  if (!match) return;
  scheduleExpansion(() => doExpandInInput(el, match));
}

// ---------- CONTENTEDITABLE (respecte les sauts de ligne avec <br>) ----------

function doExpandInContentEditable(match) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return;

  const offset = range.startOffset;
  const text = node.textContent;
  const windowStart = Math.max(0, offset - MAX_TRIGGER_LEN);
  const before = text.substring(windowStart, offset);
  if (!before.endsWith(match.trigger)) return; // contexte changé, on annule

  const cursorMarker = findCursorOffset(match.content);
  const replacement = resolveContent(match.content);
  const triggerStart = offset - match.trigger.length;

  const afterText = text.substring(offset);
  const beforeText = text.substring(0, triggerStart);

  const frag = document.createDocumentFragment();
  const lines = replacement.split('\n');
  let cursorNode = null, cursorOffsetInNode = 0;
  let consumed = 0;
  lines.forEach((line, idx) => {
    const textNode = document.createTextNode(line);
    frag.appendChild(textNode);
    if (cursorMarker >= 0 && cursorNode === null) {
      const lineEndInResolved = consumed + line.length;
      if (cursorMarker <= lineEndInResolved + idx) {
        cursorNode = textNode;
        cursorOffsetInNode = Math.max(0, Math.min(line.length, cursorMarker - consumed - idx));
      }
    }
    consumed += line.length;
    if (idx < lines.length - 1) {
      frag.appendChild(document.createElement('br'));
    }
  });

  node.textContent = beforeText;
  const afterNode = document.createTextNode(afterText);
  const parent = node.parentNode;
  const nextSibling = node.nextSibling;
  parent.insertBefore(frag, nextSibling);
  parent.insertBefore(afterNode, nextSibling);

  const newRange = document.createRange();
  if (cursorNode) {
    newRange.setStart(cursorNode, cursorOffsetInNode);
  } else {
    newRange.setStartBefore(afterNode);
  }
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

function tryExpandInContentEditable() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return;

  const offset = range.startOffset;
  const text = node.textContent;
  const windowStart = Math.max(0, offset - MAX_TRIGGER_LEN);
  const before = text.substring(windowStart, offset);
  const match = findMatch(before);
  if (!match) return;
  scheduleExpansion(() => doExpandInContentEditable(match));
}

// ---------- Temporisation ----------
// Attend que l'utilisateur arrête de taper pendant EXPANSION_DELAY_MS avant de déclencher
// l'expansion. Si la frappe continue et invalide le match entre-temps, l'expansion est
// automatiquement annulée (doExpand* revérifie le contexte juste avant d'agir).

function scheduleExpansion(fn) {
  if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
  if (EXPANSION_DELAY_MS <= 0) {
    fn();
    return;
  }
  pendingTimeoutId = setTimeout(() => {
    pendingTimeoutId = null;
    fn();
  }, EXPANSION_DELAY_MS);
}

document.addEventListener('input', (e) => {
  if (!SNIPPETS.length) return;
  const el = e.target;

  if (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|email|url)$/i.test(el.type)))) {
    tryExpandInInput(el);
  } else if (el && el.isContentEditable) {
    tryExpandInContentEditable();
  }
}, true);

// ---------- Intégration Aviso ----------
// Sur les tableaux de saisie de rapport (colonnes "Référentiel" / "Dispositions réalisées"),
// affiche une icône à côté de "Dispositions réalisées" quand le code du Référentiel (la partie
// avant le premier " - ", ex: "GN 4" dans "GN 4 - Procédure d'adaptation...") correspond au
// déclencheur d'un snippet. Un clic AJOUTE le contenu du snippet à la suite du texte déjà
// présent (jamais d'écrasement). Limité à ce site : aucun effet sur les autres pages visitées.
// (AVISO_HOSTNAME, AVISO_ICON_CLASS et isAvisoSite() sont déclarés en haut du fichier.)

function normalizeRefCode(str) {
  return String(str || '').replace(/\s+/g, '').toUpperCase();
}

// "GN 4 - Procédure d'adaptation..." -> "GN4"
function extractRefCode(referentielText) {
  const text = String(referentielText || '').trim();
  const sepIndex = text.indexOf(' - ');
  const code = sepIndex >= 0 ? text.slice(0, sepIndex) : text;
  return normalizeRefCode(code);
}

// "/GN4" -> "GN4" (retire un préfixe usuel de déclencheur avant comparaison)
function triggerToRefCode(trigger) {
  return normalizeRefCode(String(trigger || '').replace(/^[/;:!]+/, ''));
}

function escapeHtmlAviso(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function appendAvisoSnippet(dispoCell, snippet) {
  appendAvisoText(dispoCell, resolveContent(snippet.content));
}

// Ajout à la suite du contenu existant, jamais d'écrasement. Partagé par le bouton snippet et
// par celui des données DatAviso : c'est la même écriture dans la cellule Aviso.
function appendAvisoText(dispoCell, addition) {
  const textarea = dispoCell.querySelector('textarea.verification');
  const displayDiv = dispoCell.querySelector('div.verification');
  if (!textarea || !addition) return;

  const hasExisting = textarea.value.trim().length > 0;
  const separator = hasExisting && !textarea.value.endsWith('\n') ? '\n' : '';
  setNativeValue(textarea, textarea.value + separator + addition);
  textarea.dispatchEvent(new Event('change', { bubbles: true }));

  // Le <div> d'affichage et le <textarea> partagent le même id/name (bascule "lecture" <->
  // "édition" au clic) : on recopie la valeur complète du textarea, plutôt que d'y ajouter le
  // snippet. Aviso resynchronise déjà ce <div> depuis le textarea sur l'évènement 'change'
  // ci-dessus (dispatchEvent est synchrone, son handler a donc fini de s'exécuter ici) : un
  // ajout de notre côté afficherait le snippet en double. Recopier reste correct dans tous les
  // cas, y compris si Aviso ne resynchronise rien.
  if (displayDiv) {
    displayDiv.innerHTML = escapeHtmlAviso(textarea.value).replace(/\n/g, '<br>');
  }
}

const AVISO_BTN_STYLE = 'all:unset;cursor:pointer;display:inline-flex;vertical-align:middle;margin:0 6px 4px 0;';
const AVISO_IMG_STYLE = 'width:16px;height:16px;display:block;';

function insertAvisoIcon(container, dispoCell, snippet) {
  if (container.querySelector('.' + AVISO_ICON_CLASS)) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = AVISO_ICON_CLASS;
  btn.title = `Ajouter le contenu du snippet "${snippet.trigger}"`;
  btn.style.cssText = AVISO_BTN_STYLE;

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/icon16.png');
  img.alt = 'Snippet Expander';
  img.style.cssText = AVISO_IMG_STYLE;
  btn.appendChild(img);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    appendAvisoSnippet(dispoCell, snippet);
  });

  container.insertBefore(btn, container.firstChild);
}

// Lien vers le texte réglementaire correspondant sur sitesecurite.com, ouvert dans un nouvel
// onglet. Indépendant du bouton d'insertion : il ne dépend que du Référentiel de la ligne, et
// s'affiche donc aussi sur les lignes sans snippet (consulter l'article reste utile même quand
// il n'y a rien à insérer). Un vrai <a> (plutôt qu'un window.open au clic) pour conserver les
// usages du navigateur : clic milieu, Ctrl+clic, "ouvrir dans un nouvel onglet".
// Absent si le code ne correspond à aucun article ERP connu, plutôt que de mener à une 404.
function insertAvisoLawLink(container, refCode) {
  if (container.querySelector('.' + AVISO_LAW_CLASS)) return;

  const url = sitesecuriteUrlForCode(refCode);
  if (!url) return;

  const link = document.createElement('a');
  link.className = AVISO_LAW_CLASS;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = `Consulter le texte réglementaire ${refCode} sur sitesecurite.com`;
  link.style.cssText = AVISO_BTN_STYLE;

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/sitesecurite32.png');
  img.alt = `Texte réglementaire ${refCode}`;
  img.style.cssText = AVISO_IMG_STYLE;
  link.appendChild(img);

  // Seulement stopPropagation : sans preventDefault, la navigation par défaut du lien a bien
  // lieu — on empêche juste Aviso de réagir au clic (bascule lecture/édition de la cellule).
  link.addEventListener('click', (e) => e.stopPropagation());

  // Le bouton d'insertion est toujours posé en tête de conteneur : se placer juste après lui
  // quand il existe garde l'ordre [insertion, texte réglementaire], quel que soit celui des
  // deux qui a été inséré en premier (les snippets peuvent arriver après un premier scan).
  const snippetBtn = container.querySelector('.' + AVISO_ICON_CLASS);
  if (snippetBtn) snippetBtn.insertAdjacentElement('afterend', link);
  else container.insertBefore(link, container.firstChild);
}

// Longueur maximale de l'infobulle de prévisualisation. Les infobulles natives ne défilent pas :
// au-delà, le texte déborderait de l'écran et deviendrait illisible. Le contenu inséré, lui,
// n'est jamais tronqué.
const AVISO_TOOLTIP_MAX = 700;

// Troisième icône : ajoute les données DatAviso de cet article (tous ses champs, sans la ligne
// de titre). Même comportement d'ajout que le bouton snippet — rien n'est écrasé.
// Posée en dernier des trois, l'ordre affiché étant [snippet, texte réglementaire, DatAviso].
function insertAvisoImportIcon(container, dispoCell, article) {
  if (container.querySelector('.' + AVISO_IMPORT_CLASS)) return;

  const texte = importedArticleToText(article);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = AVISO_IMPORT_CLASS;
  // L'infobulle montre le texte qui sera réellement inséré, pour pouvoir le relire avant de
  // cliquer plutôt que de découvrir le contenu une fois dans la cellule.
  btn.title = texte.length > AVISO_TOOLTIP_MAX
    ? texte.slice(0, AVISO_TOOLTIP_MAX).trimEnd() + '…'
    : texte;
  btn.style.cssText = AVISO_BTN_STYLE;

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/imported16.svg');
  img.alt = `Données DatAviso ${article.code}`;
  img.style.cssText = AVISO_IMG_STYLE;
  btn.appendChild(img);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    appendAvisoText(dispoCell, texte);
  });

  const previous = container.querySelector('.' + AVISO_LAW_CLASS)
    || container.querySelector('.' + AVISO_ICON_CLASS);
  if (previous) previous.insertAdjacentElement('afterend', btn);
  else container.insertBefore(btn, container.firstChild);
}

function scanAvisoTable() {
  if (!AVISO_ICON_ENABLED) return;
  document.querySelectorAll('td.referentiel.content').forEach(refCell => {
    const tr = refCell.closest('tr');
    const dispoCell = tr && tr.querySelector('td.dispositions');
    if (!dispoCell || !dispoCell.querySelector('textarea.verification')) return;

    const refCode = extractRefCode(refCell.textContent);
    if (!refCode) return;

    const container = dispoCell.querySelector('.dispositions.verif');
    if (!container) return;

    const match = SNIPPETS.find(s => triggerToRefCode(s.trigger) === refCode);
    if (match) insertAvisoIcon(container, dispoCell, match);
    insertAvisoLawLink(container, refCode);

    const article = IMPORTED_ARTICLES.find(a => a.code === refCode);
    if (article) insertAvisoImportIcon(container, dispoCell, article);
  });
}

let avisoScanTimeoutId = null;
function scheduleAvisoScan() {
  if (avisoScanTimeoutId) clearTimeout(avisoScanTimeoutId);
  avisoScanTimeoutId = setTimeout(scanAvisoTable, 150);
}

// Réagit immédiatement à un changement du réglage "Intégration Aviso" (page Paramètres ou popup
// de l'icône) : relance un scan si on vient de le réactiver, ou retire les icônes déjà posées.
function applyAvisoIconSetting() {
  if (AVISO_ICON_ENABLED) {
    scheduleAvisoScan();
  } else {
    document.querySelectorAll(
      '.' + AVISO_ICON_CLASS + ', .' + AVISO_LAW_CLASS + ', .' + AVISO_IMPORT_CLASS
    ).forEach(el => el.remove());
  }
}

if (isAvisoSite()) {
  // Les lignes se chargent/déplient dynamiquement (boutons d'expansion, AJAX) : on réagit à
  // toute modification du DOM plutôt qu'à un seul passage au chargement de la page.
  new MutationObserver(scheduleAvisoScan).observe(document.body, { childList: true, subtree: true });
  scheduleAvisoScan();
}
