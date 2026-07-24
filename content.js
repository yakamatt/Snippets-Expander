// content.js — détecte et remplace les snippets, avec temporisation et mise en forme

let SNIPPETS = [];
let MAX_TRIGGER_LEN = 1;
let EXPANSION_DELAY_MS = 1000;
let pendingTimeoutId = null;

function loadSnippets() {
  chrome.storage.local.get(['snippets'], (res) => {
    SNIPPETS = res.snippets || [];
    MAX_TRIGGER_LEN = SNIPPETS.reduce((m, s) => Math.max(m, s.trigger.length), 1);
  });
}
function loadSettings() {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    const s = res.syncSettings || {};
    EXPANSION_DELAY_MS = Number.isFinite(s.expansionDelayMs) ? s.expansionDelayMs : 1000;
  });
}
loadSnippets();
loadSettings();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.snippets) {
    SNIPPETS = changes.snippets.newValue || [];
    MAX_TRIGGER_LEN = SNIPPETS.reduce((m, s) => Math.max(m, s.trigger.length), 1);
  }
  if (area === 'sync' && changes.syncSettings) {
    const s = changes.syncSettings.newValue || {};
    EXPANSION_DELAY_MS = Number.isFinite(s.expansionDelayMs) ? s.expansionDelayMs : 1000;
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
    .sort((a, b) => {
      if (b.trigger.length !== a.trigger.length) return b.trigger.length - a.trigger.length;
      // À longueur de déclencheur égale, un snippet local est toujours prioritaire sur un snippet synchronisé
      return (a.origin === 'synced' ? 1 : 0) - (b.origin === 'synced' ? 1 : 0);
    })
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
