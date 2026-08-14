// content.js — détecte et remplace les snippets, avec temporisation et mise en forme

let SNIPPETS = [];
let MAX_TRIGGER_LEN = 1;
let EXPANSION_DELAY_MS = 1000;
let AVISO_ICON_ENABLED = true;
let pendingTimeoutId = null;

// Déclarés avant loadSnippets() car référencés depuis son callback : chrome.storage est
// documenté comme toujours asynchrone, mais ces déclarations restent en TDZ tant que le script
// ne les a pas atteintes — les placer ici évite toute fragilité d'ordre d'exécution.
const AVISO_HOSTNAME = 'aviso2.bureauveritas.com';
const AVISO_ICON_CLASS = 'snippet-expander-aviso-icon';

function isAvisoSite() {
  return location.hostname === AVISO_HOSTNAME;
}

function loadSnippets() {
  chrome.storage.local.get(['snippets'], (res) => {
    SNIPPETS = res.snippets || [];
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

// ---------- Intégration Aviso (Bureau Veritas) ----------
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
  const textarea = dispoCell.querySelector('textarea.verification');
  const displayDiv = dispoCell.querySelector('div.verification');
  if (!textarea) return;

  const addition = resolveContent(snippet.content);
  const hasExisting = textarea.value.trim().length > 0;
  const separator = hasExisting && !textarea.value.endsWith('\n') ? '\n' : '';
  setNativeValue(textarea, textarea.value + separator + addition);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));

  // Le <div> d'affichage et le <textarea> partagent le même id/name (probable bascule
  // "lecture" <-> "édition" au clic) : on met les deux à jour pour rester cohérent quel que
  // soit celui visible au moment du clic.
  if (displayDiv) {
    const escaped = escapeHtmlAviso(addition).replace(/\n/g, '<br>');
    const currentHtml = displayDiv.innerHTML.trim();
    displayDiv.innerHTML = currentHtml ? currentHtml + '<br>' + escaped : escaped;
  }
}

function insertAvisoIcon(dispoCell, snippet) {
  const container = dispoCell.querySelector('.dispositions.verif');
  if (!container || container.querySelector('.' + AVISO_ICON_CLASS)) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = AVISO_ICON_CLASS;
  btn.title = `Ajouter le contenu du snippet "${snippet.trigger}"`;
  btn.style.cssText = 'all:unset;cursor:pointer;display:inline-flex;vertical-align:middle;margin:0 6px 4px 0;';

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/icon16.png');
  img.alt = 'Snippet Expander';
  img.style.cssText = 'width:16px;height:16px;display:block;';
  btn.appendChild(img);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    appendAvisoSnippet(dispoCell, snippet);
  });

  container.insertBefore(btn, container.firstChild);
}

function scanAvisoTable() {
  if (!AVISO_ICON_ENABLED || !SNIPPETS.length) return;
  document.querySelectorAll('td.referentiel.content').forEach(refCell => {
    const tr = refCell.closest('tr');
    const dispoCell = tr && tr.querySelector('td.dispositions');
    if (!dispoCell || !dispoCell.querySelector('textarea.verification')) return;

    const refCode = extractRefCode(refCell.textContent);
    if (!refCode) return;

    const match = SNIPPETS.find(s => triggerToRefCode(s.trigger) === refCode);
    if (match) insertAvisoIcon(dispoCell, match);
  });
}

let avisoScanTimeoutId = null;
function scheduleAvisoScan() {
  if (avisoScanTimeoutId) clearTimeout(avisoScanTimeoutId);
  avisoScanTimeoutId = setTimeout(scanAvisoTable, 150);
}

// Réagit immédiatement à un changement du réglage "Afficher l'icône de suggestion" (Paramètres
// avancés) : active un scan si on vient de le réactiver, ou retire les icônes déjà posées sinon.
function applyAvisoIconSetting() {
  if (AVISO_ICON_ENABLED) {
    scheduleAvisoScan();
  } else {
    document.querySelectorAll('.' + AVISO_ICON_CLASS).forEach(el => el.remove());
  }
}

if (isAvisoSite()) {
  // Les lignes se chargent/déplient dynamiquement (boutons d'expansion, AJAX) : on réagit à
  // toute modification du DOM plutôt qu'à un seul passage au chargement de la page.
  new MutationObserver(scheduleAvisoScan).observe(document.body, { childList: true, subtree: true });
  scheduleAvisoScan();
}
