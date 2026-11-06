// content.js — détecte et remplace les snippets, avec temporisation et mise en forme

// Deux sources coexistent : le Clausier Commun (snippets du Google Sheets, en lecture seule) et
// le Clausier Personnel (snippets locaux, propres à ce navigateur). ACTIVE_SNIPPETS est la
// fusion utilisée par l'expansion au clavier, où le snippet local l'emporte à déclencheur égal.
let SNIPPETS = [];
let LOCAL_SNIPPETS = [];
let ACTIVE_SNIPPETS = [];
let IMPORTED_ARTICLES = [];
let MAX_TRIGGER_LEN = 1;
let EXPANSION_DELAY_MS = 1000;
// Liens SGO / SharePoint / Explorateur posés sur les affaires dans Aviso, un réglage par lien
// (Paramètres avancés). Actifs par défaut : un réglage absent vaut "activé".
let LIENS_AFFAIRE = { sgo: true, sharepoint: true, explorateur: true };
let pendingTimeoutId = null;

// Déclarés avant loadSnippets() car référencés depuis son callback : chrome.storage est
// documenté comme toujours asynchrone, mais ces déclarations restent en TDZ tant que le script
// ne les a pas atteintes — les placer ici évite toute fragilité d'ordre d'exécution.
const AVISO_HOSTNAME = 'aviso2.bureauveritas.com';
const AVISO_ICON_CLASS = 'snippet-expander-aviso-icon';
const AVISO_LAW_CLASS = 'snippet-expander-aviso-law';
const AVISO_IMPORT_CLASS = 'snippet-expander-aviso-import';
const AVISO_ADD_CLASS = 'snippet-expander-aviso-add';
const AVISO_LOCAL_CLASS = 'snippet-expander-aviso-local';
const AVISO_EDIT_CLASS = 'snippet-expander-aviso-edit';
// Hors de AVISO_ORDER : la corbeille flotte au bord droit de la cellule, à l'écart de la rangée.
const AVISO_CLEAR_CLASS = 'snippet-expander-aviso-clear';
// Groupe de liens SGO / SharePoint / Explorateur d'une affaire (liste Plans Affaires, barre bleue).
const AVISO_LIENS_CLASS = 'snippet-expander-liens-affaire';

// Ordre d'affichage des icônes, de gauche à droite. Le "+" et l'icône jaune occupent la même
// place et ne coexistent jamais : le "+" n'apparaît que sur une ligne sans snippet local.
const AVISO_ORDER = [
  AVISO_ADD_CLASS, AVISO_LOCAL_CLASS, AVISO_EDIT_CLASS,
  AVISO_ICON_CLASS, AVISO_LAW_CLASS, AVISO_IMPORT_CLASS
];

function isAvisoSite() {
  return location.hostname === AVISO_HOSTNAME;
}

// Le snippet local masque, pour l'expansion au clavier, le snippet du Google Sheets de même
// déclencheur. Sans ce filtre, findMatch départagerait deux déclencheurs identiques à la
// longueur, donc arbitrairement.
function rebuildActiveSnippets() {
  const locaux = new Set(LOCAL_SNIPPETS.map(s => s.trigger));
  ACTIVE_SNIPPETS = LOCAL_SNIPPETS.concat(SNIPPETS.filter(s => !locaux.has(s.trigger)));
  MAX_TRIGGER_LEN = ACTIVE_SNIPPETS.reduce((m, s) => Math.max(m, s.trigger.length), 1);
}

function loadSnippets() {
  chrome.storage.local.get(['snippets', 'localSnippets', 'importedArticles'], (res) => {
    SNIPPETS = res.snippets || [];
    LOCAL_SNIPPETS = res.localSnippets || [];
    IMPORTED_ARTICLES = res.importedArticles || [];
    rebuildActiveSnippets();
    if (isAvisoSite()) scheduleAvisoScan();
  });
}
// Applique les réglages ; renvoie true si les liens d'affaire ont changé, pour que l'appelant
// retire et repose ceux déjà affichés.
function appliquerReglages(s) {
  EXPANSION_DELAY_MS = Number.isFinite(s.expansionDelayMs) ? s.expansionDelayMs : 1000;
  const avant = JSON.stringify(LIENS_AFFAIRE);
  LIENS_AFFAIRE = {
    sgo: s.lienSgo !== false,
    sharepoint: s.lienSharepoint !== false,
    explorateur: s.lienExplorateur !== false
  };
  return JSON.stringify(LIENS_AFFAIRE) !== avant;
}

function loadSettings() {
  chrome.storage.sync.get(['syncSettings'], (res) => {
    if (appliquerReglages(res.syncSettings || {}) && isAvisoSite()) retirerIconesAviso([AVISO_LIENS_CLASS]);
  });
}
loadSnippets();
loadSettings();

// Les icônes Aviso capturent leur snippet au moment de leur pose : quand une source change, les
// icônes qui en dépendent sont retirées, puis le scan les repose d'après les nouvelles données.
function retirerIconesAviso(classes) {
  document.querySelectorAll(classes.map(c => '.' + c).join(', ')).forEach(el => el.remove());
  scheduleAvisoScan();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.snippets) {
    SNIPPETS = changes.snippets.newValue || [];
    rebuildActiveSnippets();
    if (isAvisoSite()) retirerIconesAviso([AVISO_ICON_CLASS]);
  }
  // Un snippet local créé, modifié ou supprimé (fenêtre d'édition, page Paramètres) : le "+",
  // l'icône jaune et le crayon dépendent tous trois de son existence.
  if (area === 'local' && changes.localSnippets) {
    LOCAL_SNIPPETS = changes.localSnippets.newValue || [];
    rebuildActiveSnippets();
    if (isAvisoSite()) retirerIconesAviso([AVISO_ADD_CLASS, AVISO_LOCAL_CLASS, AVISO_EDIT_CLASS]);
  }
  // Un import depuis le popup doit se voir tout de suite sur l'onglet Aviso déjà ouvert.
  if (area === 'local' && changes.importedArticles) {
    IMPORTED_ARTICLES = changes.importedArticles.newValue || [];
    if (isAvisoSite()) retirerIconesAviso([AVISO_IMPORT_CLASS]);
  }
  if (area === 'sync' && changes.syncSettings) {
    if (appliquerReglages(changes.syncSettings.newValue || {}) && isAvisoSite()) {
      retirerIconesAviso([AVISO_LIENS_CLASS]);
    }
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
  return ACTIVE_SNIPPETS
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

// doc : le document du champ. Celui de la page, ou celui de l'iframe d'un éditeur riche
// (TinyMCE sur Aviso), dans laquelle ce script ne tourne pas (voir lierEditeursRiches).
function doExpandInContentEditable(match, doc = document) {
  const sel = doc.getSelection();
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

  const frag = doc.createDocumentFragment();
  const lines = replacement.split('\n');
  let cursorNode = null, cursorOffsetInNode = 0;
  let consumed = 0;
  lines.forEach((line, idx) => {
    const textNode = doc.createTextNode(line);
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
      frag.appendChild(doc.createElement('br'));
    }
  });

  node.textContent = beforeText;
  const afterNode = doc.createTextNode(afterText);
  const parent = node.parentNode;
  const nextSibling = node.nextSibling;
  parent.insertBefore(frag, nextSibling);
  parent.insertBefore(afterNode, nextSibling);

  const newRange = doc.createRange();
  if (cursorNode) {
    newRange.setStart(cursorNode, cursorOffsetInNode);
  } else {
    newRange.setStartBefore(afterNode);
  }
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
  // Prévient l'éditeur (TinyMCE, etc.) que le contenu a changé, comme pour un champ texte.
  const racine = parent.nodeType === Node.ELEMENT_NODE ? parent.closest('[contenteditable]') || parent : null;
  if (racine) racine.dispatchEvent(new Event('input', { bubbles: true }));
}

function tryExpandInContentEditable(doc = document) {
  const sel = doc.getSelection();
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
  scheduleExpansion(() => doExpandInContentEditable(match, doc));
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

function surSaisie(e, doc) {
  if (!ACTIVE_SNIPPETS.length) return;
  const el = e.target;

  if (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|email|url)$/i.test(el.type)))) {
    tryExpandInInput(el);
  } else if (el && el.isContentEditable) {
    tryExpandInContentEditable(doc);
  }
}

document.addEventListener('input', (e) => surSaisie(e, document), true);

// ---------- Éditeurs riches dans une iframe vide (TinyMCE) ----------
// Le champ « Remarque » d'Aviso est un éditeur TinyMCE : un <body contenteditable> dans une
// iframe sans src (about:blank). Chrome n'y injecte pas ce script (pas de match_about_blank),
// la frappe n'y atteint donc pas le listener ci-dessus. La page parente, de même origine, peut
// en revanche écouter ce document : on y branche le même listener.
//
// Plutôt que match_about_blank : TinyMCE remplit son iframe par document.write, qui efface les
// listeners du document : on retient le <body> vu au branchement (une réécriture le remplace) et
// le branchement est refait à chaque occasion : scan Aviso, survol de l'iframe, focus qui y entre.
// L'ancien listener est retiré avant d'en poser un nouveau, pour ne jamais en avoir deux.
// Les iframes à src, où ce script tourne déjà (all_frames), sont ignorées : sinon double expansion.
// (srcdoc non plus n'est pas injecté : l'attribut src est alors absent, l'iframe est donc liée.)
const editeursLies = new WeakMap(); // document de l'iframe -> { body, ecouteur }

function lierEditeurRiche(iframe) {
  // Sans src (ou about:, javascript:), Chrome n'injecte pas ce script dans l'iframe. On teste
  // l'attribut et non l'URL du document : après document.write, celle-ci devient celle de la
  // page parente.
  const src = (iframe.getAttribute('src') || '').trim();
  if (src && !/^(about|javascript):/i.test(src)) return;
  let doc;
  try {
    doc = iframe.contentDocument; // null si l'iframe est d'une autre origine
  } catch {
    return;
  }
  if (!doc || !doc.body) return;
  const lie = editeursLies.get(doc);
  if (lie && lie.body === doc.body) return;
  if (lie) doc.removeEventListener('input', lie.ecouteur, true);
  const ecouteur = (e) => surSaisie(e, doc);
  doc.addEventListener('input', ecouteur, true);
  editeursLies.set(doc, { body: doc.body, ecouteur });
}

function lierEditeursRiches(racine = document) {
  racine.querySelectorAll('iframe').forEach(lierEditeurRiche);
}

if (isAvisoSite()) {
  document.addEventListener('mouseover', (e) => {
    if (e.target && e.target.tagName === 'IFRAME') lierEditeurRiche(e.target);
  }, true);
  // Le focus qui passe dans une iframe fait perdre le focus à la fenêtre parente ; l'iframe est
  // alors l'élément actif (navigation au clavier, focus posé par Aviso à l'ouverture).
  window.addEventListener('blur', () => {
    setTimeout(() => {
      const actif = document.activeElement;
      if (actif && actif.tagName === 'IFRAME') lierEditeurRiche(actif);
    }, 0);
  });
}

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

// Un code d'article : une à quatre lettres, un numéro, éventuellement un suffixe ("CO 24",
// "CH 12-1"). Ce qui n'y ressemble pas est un libellé de rubrique, pas un code.
const REF_CODE_RE = /^[A-Za-z]{1,4}\s*\d+(?:-\d+)?$/;

// "GN 4 - Procédure d'adaptation..." -> "GN4"
// "Dallage - Exigences d'utilisation et conception" -> le libellé entier : les référentiels
// solidité n'ont pas de code, et deux rubriques d'un même groupe ("Dallage - données relatives
// au sol support") se confondraient si l'on coupait au premier " - ".
function extractRefCode(referentielText) {
  const text = String(referentielText || '').trim();
  const sepIndex = text.indexOf(' - ');
  if (sepIndex < 0) return normalizeRefCode(text);
  const prefixe = text.slice(0, sepIndex).trim();
  return normalizeRefCode(REF_CODE_RE.test(prefixe) ? prefixe : text);
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
  if (!textarea || !addition) return;

  const hasExisting = textarea.value.trim().length > 0;
  const separator = hasExisting && !textarea.value.endsWith('\n') ? '\n' : '';
  ecrireAvisoValeur(dispoCell, textarea.value + separator + addition);
}

// Seule écriture dans une cellule Aviso, partagée par l'ajout ci-dessus et par la corbeille
// (effacement puis annulation de l'effacement).
function ecrireAvisoValeur(dispoCell, valeur) {
  const textarea = dispoCell.querySelector('textarea.verification');
  const displayDiv = dispoCell.querySelector('div.verification');
  if (!textarea) return;

  setNativeValue(textarea, valeur);
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

  ajusterHauteurAviso(textarea);
  ajusterHauteurAviso(displayDiv);
}

// Un long snippet inséré dans un champ de quelques lignes resterait caché derrière une barre de
// défilement : le champ s'agrandit pour tout montrer, jusqu'à 60 % de la hauteur de la fenêtre
// (au-delà, il défile, pour ne pas repousser les lignes suivantes hors de la vue). Il ne
// rapetisse jamais sous la taille que lui donne Aviso.
const AVISO_HAUTEUR_MAX = 0.6;

function ajusterHauteurAviso(el) {
  // Masqué (le <div> de lecture et le <textarea> d'édition alternent) : rien à mesurer. Le
  // <textarea> est réajusté quand il reprend le focus, voir insertAvisoClearButton.
  if (!el || !el.offsetParent) return;
  if (el.scrollHeight <= el.clientHeight) return;
  // Plancher de 200 px : une fenêtre très basse (ou un cadre encore en cours de mise en page)
  // donnerait sinon un plafond dérisoire.
  const max = Math.max(200, Math.round(window.innerHeight * AVISO_HAUTEUR_MAX));
  const style = getComputedStyle(el);
  // scrollHeight compte le padding mais pas la bordure : la hauteur à poser en dépend.
  const bordureEtPadding = style.boxSizing === 'border-box'
    ? el.offsetHeight - el.clientHeight
    : -(parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));
  const actuelle = parseFloat(style.height) || 0;
  el.style.height = Math.max(actuelle, Math.min(el.scrollHeight + bordureEtPadding, max)) + 'px';
  el.style.maxHeight = Math.max(actuelle, max) + 'px';
  el.style.overflowY = 'auto';
}

const AVISO_BTN_STYLE = 'all:unset;cursor:pointer;display:inline-flex;vertical-align:middle;margin:0 6px 4px 0;';
const AVISO_IMG_STYLE = 'width:16px;height:16px;display:block;';

// Longueur maximale de l'infobulle de prévisualisation. Les infobulles natives ne défilent pas :
// au-delà, le texte déborderait de l'écran et deviendrait illisible. Le contenu inséré, lui,
// n'est jamais tronqué. Partagée par les icônes snippet et DatAviso.
const AVISO_TOOLTIP_MAX = 700;

function tronquerPourInfobulle(texte) {
  return texte.length > AVISO_TOOLTIP_MAX
    ? texte.slice(0, AVISO_TOOLTIP_MAX).trimEnd() + '…'
    : texte;
}

// Place une icône à son rang dans AVISO_ORDER : juste après la plus proche des icônes qui la
// précèdent et sont déjà posées, sinon en tête du conteneur. Jamais de position absolue — les
// données arrivent dans un ordre quelconque (synchro, import, scan suivant), l'ordre affiché
// doit pourtant rester le même.
function placerIcone(container, el) {
  const rang = AVISO_ORDER.indexOf(el.className);
  for (let i = rang - 1; i >= 0; i--) {
    const precedente = container.querySelector('.' + AVISO_ORDER[i]);
    if (precedente) {
      precedente.insertAdjacentElement('afterend', el);
      return;
    }
  }
  container.insertBefore(el, container.firstChild);
}

function creerBoutonAviso(className, iconPath, alt) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.style.cssText = AVISO_BTN_STYLE;
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL(iconPath);
  img.alt = alt;
  img.style.cssText = AVISO_IMG_STYLE;
  btn.appendChild(img);
  return btn;
}

// Bouton d'insertion d'un snippet, commun au bleu (Clausier Commun) et au jaune (Clausier
// Personnel) : seuls l'icône et le libellé de l'infobulle changent.
function insertAvisoSnippetButton(container, dispoCell, snippet, className, iconPath, libelle) {
  if (container.querySelector('.' + className)) return;

  const btn = creerBoutonAviso(className, iconPath, libelle);

  // L'infobulle montre le texte qui sera réellement inséré, pour pouvoir le relire avant de
  // cliquer. Recalculé au survol et non une fois pour toutes : le contenu peut porter des
  // {date}/{time}, que resolveContent remplace par l'instant présent.
  const majTitre = () => {
    const texte = resolveContent(snippet.content);
    btn.title = `${libelle} "${snippet.trigger}" :\n${tronquerPourInfobulle(texte)}`;
  };
  majTitre();
  btn.addEventListener('mouseenter', majTitre);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    appendAvisoSnippet(dispoCell, snippet);
  });

  placerIcone(container, btn);
}

function insertAvisoIcon(container, dispoCell, snippet) {
  insertAvisoSnippetButton(container, dispoCell, snippet, AVISO_ICON_CLASS, 'icons/icon16.png',
    'Ajouter le contenu du snippet du Clausier Commun');
}

function insertAvisoLocalIcon(container, dispoCell, snippet) {
  insertAvisoSnippetButton(container, dispoCell, snippet, AVISO_LOCAL_CLASS, 'icons/local16.svg',
    'Ajouter le contenu du snippet du Clausier Personnel');
}

// Crayon jaune, à droite de l'icône jaune : modifie le snippet local sans quitter Aviso.
function insertAvisoEditIcon(container, snippet) {
  if (container.querySelector('.' + AVISO_EDIT_CLASS)) return;

  const btn = creerBoutonAviso(AVISO_EDIT_CLASS, 'icons/edit16.svg', `Modifier ${snippet.trigger}`);
  btn.title = `Modifier le snippet "${snippet.trigger}" du Clausier Personnel`;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    ouvrirEditeurLocal(snippet.trigger, snippet.content, true);
  });

  placerIcone(container, btn);
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

  placerIcone(container, link);
}

// Icône verte : ajoute les données DatAviso de cet article (tous ses champs, sans la ligne de
// titre). Même comportement d'ajout que le bouton snippet — rien n'est écrasé. Dernière icône
// de la rangée (voir AVISO_ORDER).
function insertAvisoImportIcon(container, dispoCell, article) {
  if (container.querySelector('.' + AVISO_IMPORT_CLASS)) return;

  const texte = importedArticleToText(article);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = AVISO_IMPORT_CLASS;
  // L'infobulle montre le texte qui sera réellement inséré, pour pouvoir le relire avant de
  // cliquer plutôt que de découvrir le contenu une fois dans la cellule. Calculé une fois : les
  // données DatAviso sont figées entre deux imports, contrairement au contenu d'un snippet.
  btn.title = tronquerPourInfobulle(texte);
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

  placerIcone(container, btn);
}

// Bouton "+" : crée dans le Clausier Personnel un snippet dont le déclencheur reprend le
// Référentiel et dont le contenu reprend le texte déjà saisi dans "Dispositions réalisées" —
// c'est le cas courant : on rédige une fois la disposition, puis on la capitalise en snippet.
// Ouvre la fenêtre d'édition pour relire avant d'enregistrer. N'apparaît que sur les lignes sans
// snippet local : deux snippets locaux au même déclencheur rendraient l'expansion imprévisible.
// Plus aucune écriture dans le Google Sheets depuis Aviso (createSnippetRow, dans
// background.js, est conservé mais n'est plus appelé).
function insertAvisoAddIcon(container, dispoCell, refCode) {
  if (container.querySelector('.' + AVISO_ADD_CLASS)) return;

  const trigger = '/' + refCode;

  // Contenu déjà saisi dans "Dispositions réalisées" : il sert de contenu au snippet créé. Lu au
  // clic et non à la pose de l'icône — la cellule est éditable, sa valeur au moment du scan
  // n'est pas celle que l'utilisateur a sous les yeux quand il clique.
  const lireDispositions = () => {
    const textarea = dispoCell.querySelector('textarea.verification');
    return textarea ? textarea.value.trim() : '';
  };

  const btn = creerBoutonAviso(AVISO_ADD_CLASS, 'icons/add16.svg', `Créer le snippet ${trigger}`);
  // Le libellé dépend de ce que contient la cellule : il est recalculé au survol, la saisie
  // pouvant avoir changé depuis la pose de l'icône.
  const majTitre = () => {
    btn.title = lireDispositions()
      ? `Créer le snippet "${trigger}" dans le Clausier Personnel, à partir du texte saisi dans cette cellule`
      : `Créer le snippet "${trigger}" dans le Clausier Personnel`;
  };
  majTitre();
  btn.addEventListener('mouseenter', majTitre);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    ouvrirEditeurLocal(trigger, lireDispositions(), false, dispoCell);
  });

  placerIcone(container, btn);
}

// ---------- Clausier Personnel : écriture ----------
// Les snippets locaux vivent dans chrome.storage.local (clé localSnippets), accessible
// directement depuis le script de contenu. Lecture puis réécriture de la liste entière : les
// modifications concurrentes (deux onglets Aviso) sont assez improbables pour ne pas justifier
// de verrou, et chrome.storage.onChanged resynchronise ensuite tous les onglets.

async function enregistrerSnippetLocal(trigger, content) {
  const { localSnippets } = await chrome.storage.local.get(['localSnippets']);
  const liste = (localSnippets || []).slice();
  const i = liste.findIndex(s => s.trigger === trigger);
  if (i >= 0) liste[i] = { ...liste[i], content };
  else liste.push({ trigger, content });
  await chrome.storage.local.set({ localSnippets: liste });
}

async function supprimerSnippetLocal(trigger) {
  const { localSnippets } = await chrome.storage.local.get(['localSnippets']);
  const liste = (localSnippets || []).filter(s => s.trigger !== trigger);
  await chrome.storage.local.set({ localSnippets: liste });
}

// ---------- Clausier Personnel : fenêtre d'édition dans Aviso ----------
// Superposée à la page, sans la quitter. Montée dans un Shadow DOM : les styles d'Aviso ne
// l'atteignent pas, et les siens ne débordent pas sur le rapport.

const AVISO_EDITOR_ID = 'snippet-expander-editeur-local';

const AVISO_EDITOR_CSS = `
  .fond { position: fixed; inset: 0; z-index: 2147483647; background: rgba(15, 20, 35, 0.45);
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
  .fenetre { background: #ffffff; color: #16213d; width: min(680px, 92vw); max-height: 90vh;
    display: flex; flex-direction: column; gap: 10px; padding: 18px 20px; border-radius: 12px;
    border-top: 5px solid #f2b705; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3); box-sizing: border-box; }
  h2 { margin: 0; font-size: 15px; font-weight: 700; }
  code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; background: #fdf3d0;
    padding: 1px 6px; border-radius: 4px; }
  .aide { margin: 0; color: #5b6a8f; font-size: 12px; line-height: 1.5; }
  textarea { width: 100%; min-height: 260px; box-sizing: border-box; padding: 10px 12px; resize: vertical;
    border: 1px solid #c3cdea; border-radius: 8px; font-family: inherit; font-size: 13.5px;
    line-height: 1.5; color: inherit; }
  textarea:focus { outline: none; border-color: #c99700; box-shadow: 0 0 0 3px #fdf3d0; }
  .erreur { margin: 0; color: #b3261e; font-size: 12.5px; }
  .erreur[hidden] { display: none; }
  .actions { display: flex; gap: 8px; align-items: center; }
  .espace { flex: 1; }
  button { border: none; border-radius: 8px; padding: 8px 14px; font-family: inherit;
    font-size: 13px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  .enregistrer { background: #f2b705; color: #3d2e00; }
  .enregistrer:hover { background: #dba500; }
  .annuler { background: #e6ebfa; color: #1f3d8f; }
  .supprimer { background: none; color: #b3261e; border: 1px solid #eccbc8; }
  .supprimer:hover { background: #fbeceb; }
  .supprimer[hidden] { display: none; }
`;

// Après la création d'un snippet par le "+", reporte dans la cellule ce qu'elle ne contient pas
// encore. La fenêtre s'ouvre préremplie avec le texte de la cellule : l'ajouter tel quel le
// doublerait. Cellule vide : tout le snippet. Snippet qui prolonge le texte de la cellule : la
// seule suite. Texte réécrit : rien, la cellule n'étant jamais remplacée (rien n'est écrasé).
function reporterCreationDansAviso(dispoCell, texteCellule, contenu) {
  const debut = texteCellule.trim();
  let ajout = '';
  if (!debut) ajout = contenu;
  else if (contenu.startsWith(debut)) ajout = contenu.slice(debut.length).replace(/^\s+/, '');
  if (ajout.trim()) appendAvisoText(dispoCell, resolveContent(ajout));
}

// dispoCell n'est fourni que pour une création depuis le "+" : c'est le seul cas où le snippet
// enregistré est aussi ajouté à la cellule Aviso. Le crayon corrige le snippet pour les fois
// suivantes, sans toucher au rapport.
function ouvrirEditeurLocal(trigger, contenuInitial, existant, dispoCell) {
  if (document.getElementById(AVISO_EDITOR_ID)) return; // une seule fenêtre à la fois

  const host = document.createElement('div');
  host.id = AVISO_EDITOR_ID;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${AVISO_EDITOR_CSS}</style>
    <div class="fond">
      <div class="fenetre" role="dialog" aria-modal="true" aria-labelledby="titre">
        <h2 id="titre"></h2>
        <p class="aide">Clausier Personnel : ce snippet est enregistré dans ce navigateur uniquement.
          Il s'insère avec l'icône jaune et, au clavier, l'emporte sur un snippet du Clausier Commun
          de même déclencheur. Ctrl+Entrée pour enregistrer, Échap pour annuler.</p>
        <textarea spellcheck="true"></textarea>
        <p class="erreur" hidden></p>
        <div class="actions">
          <button type="button" class="supprimer">🗑️ Supprimer</button>
          <span class="espace"></span>
          <button type="button" class="annuler">Annuler</button>
          <button type="button" class="enregistrer">Enregistrer</button>
        </div>
      </div>
    </div>`;

  const titre = root.getElementById('titre');
  titre.append(existant ? 'Modifier le snippet ' : 'Créer le snippet ');
  const code = document.createElement('code');
  code.textContent = trigger;
  titre.appendChild(code);

  const textarea = root.querySelector('textarea');
  const erreurEl = root.querySelector('.erreur');
  const btnEnregistrer = root.querySelector('.enregistrer');
  const btnSupprimer = root.querySelector('.supprimer');
  textarea.value = contenuInitial || '';
  btnSupprimer.hidden = !existant;

  // Les évènements de la fenêtre ne doivent pas atteindre Aviso : ses raccourcis clavier et sa
  // bascule lecture/édition des cellules réagiraient à une frappe ou un clic destinés ici.
  ['keydown', 'keyup', 'keypress', 'input', 'click', 'mousedown', 'mouseup'].forEach(type => {
    host.addEventListener(type, (e) => e.stopPropagation());
  });

  const fermer = () => host.remove();
  const afficherErreur = (message) => {
    erreurEl.textContent = message;
    erreurEl.hidden = false;
  };
  // Après un rechargement de l'extension, l'ancien script de contenu reste dans la page mais
  // perd l'accès à chrome.storage : seul un rechargement de la page Aviso le rétablit.
  const messageErreur = (err) => /context invalidated/i.test(err && err.message)
    ? "L'extension a été mise à jour : rechargez la page Aviso, puis recommencez."
    : `Enregistrement impossible : ${err && err.message}`;

  const annuler = () => {
    if (textarea.value !== (contenuInitial || '') &&
        !confirm('Abandonner les modifications de ce snippet ?')) return;
    fermer();
  };

  const enregistrer = () => {
    if (!textarea.value.trim()) {
      afficherErreur(existant
        ? 'Le contenu est vide. Pour retirer ce snippet, utilisez « Supprimer ».'
        : 'Le contenu est vide : saisissez le texte du snippet.');
      return;
    }
    btnEnregistrer.disabled = true;
    const contenu = textarea.value;
    enregistrerSnippetLocal(trigger, contenu)
      .then(() => {
        fermer();
        if (!existant && dispoCell) reporterCreationDansAviso(dispoCell, contenuInitial || '', contenu);
      })
      .catch((err) => {
        btnEnregistrer.disabled = false;
        afficherErreur(messageErreur(err));
      });
  };

  btnEnregistrer.addEventListener('click', enregistrer);
  root.querySelector('.annuler').addEventListener('click', annuler);
  btnSupprimer.addEventListener('click', () => {
    if (!confirm(`Supprimer le snippet "${trigger}" du Clausier Personnel ?`)) return;
    supprimerSnippetLocal(trigger).then(fermer).catch((err) => afficherErreur(messageErreur(err)));
  });
  root.querySelector('.fenetre').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); annuler(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enregistrer(); }
  });

  document.body.appendChild(host);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

// ---------- Corbeille : vider la cellule d'un clic, et pouvoir revenir en arrière ----------
// Seul effacement de texte dans Aviso, et uniquement sur ce clic explicite. Pas de demande de
// confirmation : la corbeille se change aussitôt en bouton "Annuler l'effacement", qui remet le
// texte effacé. L'annulation reste offerte tant que la cellule est vide ; dès qu'on y écrit à
// nouveau, elle disparaît (restaurer écraserait alors la nouvelle saisie) et la corbeille revient.

const AVISO_SVG_CORBEILLE = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" ' +
  'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M2.5 4.5h11M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4 4.5l.7 8.6a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.6M6.75 7v4.5M9.25 7v4.5"/></svg>';
const AVISO_SVG_ANNULER = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" ' +
  'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5.5 3 2.5 6l3 3"/><path d="M2.5 6h7a4 4 0 0 1 0 8H7"/></svg>';

const AVISO_COULEUR_CORBEILLE = '#5b6a8f';
const AVISO_COULEUR_CORBEILLE_SURVOL = '#b3261e';
const AVISO_COULEUR_ANNULER = '#1f3d8f';

function insertAvisoClearButton(container, dispoCell) {
  if (container.querySelector('.' + AVISO_CLEAR_CLASS)) return;
  const textarea = dispoCell.querySelector('textarea.verification');
  if (!textarea) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = AVISO_CLEAR_CLASS;
  // Flottant à droite : collé au bord droit de la cellule, sur la ligne des icônes.
  btn.style.cssText = AVISO_BTN_STYLE + 'float:right;margin:0 0 4px 6px;';

  // Texte effacé, en attente d'une éventuelle annulation ; null hors de ce mode.
  let texteEfface = null;

  const majAffichage = () => {
    const enAnnulation = texteEfface !== null;
    btn.innerHTML = enAnnulation ? AVISO_SVG_ANNULER : AVISO_SVG_CORBEILLE;
    btn.style.color = enAnnulation ? AVISO_COULEUR_ANNULER : AVISO_COULEUR_CORBEILLE;
    btn.title = enAnnulation ? "Annuler l'effacement : remettre le texte effacé" : 'Effacer le contenu de ce champ';
    btn.style.display = enAnnulation || textarea.value.trim() ? 'inline-flex' : 'none';
  };

  btn.addEventListener('mouseenter', () => {
    if (texteEfface === null) btn.style.color = AVISO_COULEUR_CORBEILLE_SURVOL;
  });
  btn.addEventListener('mouseleave', majAffichage);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (texteEfface === null) {
      texteEfface = textarea.value;
      ecrireAvisoValeur(dispoCell, '');
    } else {
      const aRemettre = texteEfface;
      texteEfface = null; // avant l'écriture : son évènement 'change' ne doit plus voir le mode annulation
      ecrireAvisoValeur(dispoCell, aRemettre);
    }
    majAffichage();
  });

  // La corbeille suit la saisie : visible dès qu'il y a du texte (frappe, insertion d'un
  // snippet), masquée sinon. Une nouvelle saisie après effacement abandonne l'annulation.
  const surModification = () => {
    if (texteEfface !== null && textarea.value.trim()) texteEfface = null;
    majAffichage();
  };
  textarea.addEventListener('input', surModification);
  textarea.addEventListener('change', surModification);
  // Le <textarea> était masqué quand un snippet a été inséré en mode lecture : il prend la bonne
  // hauteur au moment où on le rouvre pour l'éditer.
  textarea.addEventListener('focus', () => ajusterHauteurAviso(textarea));

  majAffichage();
  container.insertBefore(btn, container.firstChild);
}

// ---------- Liens d'affaire : SGO, SharePoint, Explorateur Windows ----------
// À partir du numéro d'affaire (8 chiffres en général, parfois 7 : utilisé tel quel), trois
// liens discrets, monochromes, chacun désactivable dans Paramètres avancés :
// - sur la liste Plans Affaires, à côté de la loupe "Consulter" de chaque ligne ;
// - dans la barre bleue d'une affaire ouverte, à gauche du sélecteur de métier "BTS".
// De simples liens dans la page : aucune permission supplémentaire n'est nécessaire.

const SGO_URL = 'https://sgo.bureauveritas.com/SGO-Client/servlet/com.bv.sgo.modele.affaire.j2ee.AramisSGOCtrl';
const SHAREPOINT_RECHERCHE_URL = 'https://bureauveritas.sharepoint.com/_layouts/15/sharepoint.aspx/search';
// Un navigateur ne peut pas lancer l'Explorateur lui-même : le protocole search-ms:, propre à
// Windows, ouvre une recherche dans l'Explorateur (Chrome demande d'abord l'autorisation
// d'ouvrir l'application). Sans objet ailleurs : le lien n'est posé que sous Windows.
// Recherche dans C:\Users\ : les profils Windows, donc le dossier "Bureau Veritas" de
// l'utilisateur, sans parcourir tout le disque. Viser directement ce dossier a été essayé
// (v2.20.1) et abandonné : l'Explorateur ne développe pas %USERPROFILE% dans un lien search-ms:
// (rien ne s'ouvre), et une page web ne peut pas connaître l'identifiant Windows.
const EXPLORATEUR_DOSSIER = 'C:\\Users\\';
const EXPLORATEUR_LIBELLE = 'C:\\Users';
const EST_WINDOWS = /Windows/i.test(navigator.userAgent);

// "29462057 / 1" (liste) ou "33846357 / 1 - CTC - PROJET…" (barre bleue) -> "29462057"
const NUMERO_AFFAIRE_RE = /^\s*(\d{5,})\s*\//;

function numeroAffaire(texte) {
  const m = NUMERO_AFFAIRE_RE.exec(String(texte || ''));
  return m ? m[1] : null;
}

const SVG_ATTRS = 'height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';
const LIENS_AFFAIRE_DEFS = [
  {
    cle: 'sgo',
    libelle: 'SGO',
    titre: (n) => `Ouvrir l'affaire ${n} dans SGO`,
    url: (n) => `${SGO_URL}?identifiant=${encodeURIComponent(n)}&action=accesDirect`,
    svg: `<svg viewBox="0 0 22 16" width="22" ${SVG_ATTRS}><rect x="0.75" y="2.75" width="20.5" height="10.5" rx="2.5"/>` +
      '<text x="11" y="10.9" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial, sans-serif" font-size="7.4" font-weight="700" letter-spacing="0.3">SGO</text></svg>'
  },
  {
    cle: 'sharepoint',
    libelle: 'ShP',
    titre: (n) => `Rechercher l'affaire ${n} dans SharePoint`,
    url: (n) => `${SHAREPOINT_RECHERCHE_URL}?q=${encodeURIComponent(n)}`,
    // Même cadre que SGO : trois lettres aussi.
    svg: `<svg viewBox="0 0 22 16" width="22" ${SVG_ATTRS}><rect x="0.75" y="2.75" width="20.5" height="10.5" rx="2.5"/>` +
      '<text x="11" y="10.9" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial, sans-serif" font-size="7.4" font-weight="700" letter-spacing="0.3">ShP</text></svg>'
  },
  {
    cle: 'explorateur',
    libelle: 'C:\\',
    windowsSeulement: true,
    titre: (n) => `Rechercher "${n}" dans l'Explorateur Windows (${EXPLORATEUR_LIBELLE})`,
    url: (n) => `search-ms:displayname=${encodeURIComponent('Affaire ' + n)}` +
      `&crumb=location:${encodeURIComponent(EXPLORATEUR_DOSSIER)}&query=${encodeURIComponent(n)}`,
    // « C:\ » plutôt qu'un dossier : dit à la fois l'outil (l'Explorateur) et où il cherche.
    svg: `<svg viewBox="0 0 20 16" width="20" ${SVG_ATTRS}><rect x="0.75" y="2.75" width="18.5" height="10.5" rx="2.5"/>` +
      '<text x="10" y="10.9" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial, sans-serif" font-size="7.4" font-weight="700" letter-spacing="0.3">C:\\</text></svg>'
  }
];

// Bande verticale qui contient toutes les icônes, trait de 1,4 compris (voir LIENS_AFFAIRE_DEFS).
const ICONE_RECADRAGE = { y: 2.0, hauteur: 12.5 };

// Boutons de la liste Plans Affaires : libellé en vrai texte (plus lisible qu'un dessin de 7 px),
// hauteur au plus juste pour que les trois tiennent empilés dans une ligne de deux lignes de texte.
const BOUTON_TEXTE = 11;   // px
const BOUTON_HAUTEUR = 13; // px, bordure comprise

// couleur : celle de l'environnement (blanc sur la barre bleue, gris sur la liste) ;
// survol : plus contrasté, sans changer de teinte, pour rester discret.
// taille : hauteur des icônes en px (les SVG sont dessinés sur une hauteur de 16).
// empile : icônes les unes sous les autres, pour tenir dans une colonne étroite.
// classeBouton : classes d'un bouton d'Aviso à reprendre telles quelles (couleurs, bordure,
// survol) ; couleur, couleurSurvol et opacite sont alors sans effet.
function creerLiensAffaire(numero, { couleur, couleurSurvol, espacement, taille = 16, opacite = 0.75, empile = false, classeBouton = null }) {
  const defs = LIENS_AFFAIRE_DEFS.filter(d => LIENS_AFFAIRE[d.cle] && (!d.windowsSeulement || EST_WINDOWS));
  if (!defs.length) return null;

  const groupe = document.createElement('span');
  groupe.className = AVISO_LIENS_CLASS;
  // En boutons empilés, tous prennent la largeur du plus large, comme une colonne de boutons.
  groupe.style.cssText = `display:inline-flex;flex-direction:${empile ? 'column' : 'row'};` +
    `align-items:${classeBouton && empile ? 'stretch' : 'center'};` +
    `gap:${espacement}px;vertical-align:middle;`;
  defs.forEach(d => {
    const a = document.createElement('a');
    a.href = d.url(numero);
    // search-ms: n'ouvre pas d'onglet mais l'Explorateur : target="_blank" laisserait un onglet vide.
    if (!d.url(numero).startsWith('search-ms:')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.title = d.titre(numero);
    a.setAttribute('aria-label', d.titre(numero));
    if (classeBouton) {
      a.className = classeBouton;
      // Gabarit resserré : le bouton d'Aviso, avec sa hauteur de ligne de texte, ferait plus du
      // double de la hauteur du libellé.
      a.style.cssText = `display:flex;align-items:center;justify-content:center;box-sizing:border-box;` +
        `height:${BOUTON_HAUTEUR}px;padding:0 2px;margin:0;font-family:Arial,sans-serif;` +
        `font-size:${BOUTON_TEXTE}px;font-weight:700;line-height:1;letter-spacing:0.2px;`;
    } else {
      a.style.cssText = `all:unset;cursor:pointer;display:inline-flex;color:${couleur};opacity:${opacite};transition:opacity .15s;`;
    }
    if (classeBouton && d.libelle) {
      // Sur un bouton, le fond bleu délimite déjà l'icône : SGO et ShP s'écrivent en texte, sans
      // le cadre de leur dessin, utile seulement sur un fond nu.
      a.textContent = d.libelle;
    } else {
      a.innerHTML = d.svg;
      const svg = a.firstElementChild;
      const vb = svg.viewBox.baseVal;
      // Empilées, les marges haute et basse du dessin (le cadre SGO/SP va de 2,75 à 13,25 sur 16,
      // le dossier de 3,25 à 13,75) s'additionneraient d'une icône à l'autre : on recadre au plus
      // près, trait compris.
      if (empile || classeBouton) svg.setAttribute('viewBox', `${vb.x} ${ICONE_RECADRAGE.y} ${vb.width} ${ICONE_RECADRAGE.hauteur}`);
      // Sur un bouton, le dessin prend la hauteur du texte des boutons voisins.
      const hauteur = classeBouton ? BOUTON_TEXTE
        : (empile ? ICONE_RECADRAGE.hauteur : 16) * taille / 16;
      const hauteurVue = (empile || classeBouton) ? ICONE_RECADRAGE.hauteur : 16;
      svg.setAttribute('height', hauteur);
      svg.setAttribute('width', vb.width * hauteur / hauteurVue);
    }
    if (!classeBouton) {
      a.addEventListener('mouseenter', () => { a.style.opacity = '1'; a.style.color = couleurSurvol; });
      a.addEventListener('mouseleave', () => { a.style.opacity = String(opacite); a.style.color = couleur; });
    }
    // Ni la ligne du tableau ni la barre ne doivent réagir au clic (ouverture de l'affaire, menu).
    a.addEventListener('click', (e) => e.stopPropagation());
    groupe.appendChild(a);
  });
  return groupe;
}

// La ligne d'affaire ne doit pas grandir à cause des liens : ils sont posés hors du flux
// (position absolue), à droite de la loupe, et la cellule ne leur réserve que la largeur.
// Empilés si la hauteur de la ligne le permet, sinon côte à côte (ligne d'une seule ligne de
// texte). Recalculé au redimensionnement de la fenêtre, qui change le nombre de lignes du libellé.
function disposerLiensListe(actions, liens) {
  if (!actions.dataset.snippetExpanderPadding) {
    actions.dataset.snippetExpanderPadding = getComputedStyle(actions).paddingRight;
  }
  const paddingDroit = parseFloat(actions.dataset.snippetExpanderPadding) || 0;
  const cs = getComputedStyle(actions);
  actions.style.position = 'relative';
  liens.style.position = 'absolute';
  liens.style.top = cs.paddingTop;
  liens.style.right = paddingDroit + 'px';

  // Hauteur disponible : celle de la ligne telle qu'Aviso la dessine, les liens étant hors du flux.
  const disponible = actions.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const nb = liens.children.length;
  const empile = nb * BOUTON_HAUTEUR <= disponible;
  liens.style.flexDirection = empile ? 'column' : 'row';
  liens.style.gap = empile ? '0px' : '2px';
  actions.style.paddingRight = (paddingDroit + liens.offsetWidth + 2) + 'px';
}

let liensListeResizeId = null;
window.addEventListener('resize', () => {
  if (!isAvisoSite()) return;
  clearTimeout(liensListeResizeId);
  liensListeResizeId = setTimeout(() => {
    document.querySelectorAll('td.std_links > .' + AVISO_LIENS_CLASS)
      .forEach(liens => disposerLiensListe(liens.parentNode, liens));
  }, 200);
});

function scanLiensAffaire() {
  // Liste Plans Affaires : une affaire par ligne, numéro dans la colonne "N° plan affaire".
  document.querySelectorAll('td[headers="plans_affaires_n_degrees_plan_affaire_th"]').forEach(td => {
    const tr = td.closest('tr');
    const actions = tr && tr.querySelector('td.std_links');
    if (!actions || actions.querySelector('.' + AVISO_LIENS_CLASS)) return;
    const numero = numeroAffaire(td.textContent);
    if (!numero) return;
    // Mêmes classes que la loupe voisine (btn btn-primary) : blanc sur fond bleu, survol
    // compris, identiques par construction. Empilées sans espace, comme un groupe de boutons.
    const liens = creerLiensAffaire(numero, { espacement: 0, empile: true, classeBouton: 'btn btn-primary' });
    if (!liens) return;
    actions.style.whiteSpace = 'nowrap';
    actions.appendChild(liens);
    disposerLiensListe(actions, liens);
  });

  // Barre bleue : le titre de l'affaire ouverte, vide sur les pages sans affaire (la liste).
  const titre = document.getElementById('cur_plan_aff');
  const bar = document.getElementById('main_bar');
  if (titre && bar) {
    const numero = numeroAffaire(titre.textContent);
    const existant = bar.querySelector('.' + AVISO_LIENS_CLASS);
    // Une autre affaire ouverte sans rechargement complet : les liens suivent le nouveau numéro.
    if (existant && existant.dataset.numero !== numero) existant.remove();
    else if (existant) return;
    if (!numero) return;
    // Plus grandes et plus opaques que sur la liste : elles doivent se voir sur le fond bleu, à
    // côté de textes de menu en 14 px.
    const liens = creerLiensAffaire(numero, { couleur: '#ffffff', couleurSurvol: '#ffffff', espacement: 12, taille: 22, opacite: 0.9 });
    if (!liens) return;
    liens.dataset.numero = numero;
    const metier = document.getElementById('metier_header_selector');
    if (metier) {
      // En-tête actuel d'Aviso : à gauche du sélecteur de métier "BTS". Les menus de cette zone
      // sont rangés en flex "row-reverse" (l'ordre affiché est l'inverse de celui de la page) :
      // le côté d'insertion suit le sens réel d'affichage, pour rester à gauche dans les deux cas.
      liens.style.margin = '0 6px 0 14px';
      liens.style.alignSelf = 'center';
      const inverse = getComputedStyle(metier.parentNode).flexDirection === 'row-reverse';
      metier.insertAdjacentElement(inverse ? 'afterend' : 'beforebegin', liens);
    } else {
      // Repli, pour un en-tête sans sélecteur de métier (pages d'avant son apparition) : juste
      // après le titre de l'affaire, qui flotte à gauche dans la barre.
      liens.style.float = 'left';
      liens.style.height = titre.offsetHeight + 'px';
      liens.style.marginLeft = '-1em';
      titre.insertAdjacentElement('afterend', liens);
    }
  }
}

function scanAvisoTable() {
  lierEditeursRiches();
  document.querySelectorAll('td.referentiel.content').forEach(refCell => {
    const tr = refCell.closest('tr');
    const dispoCell = tr && tr.querySelector('td.dispositions');
    if (!dispoCell || !dispoCell.querySelector('textarea.verification')) return;

    const container = dispoCell.querySelector('.dispositions.verif');
    if (!container) return;

    // Sur toutes les lignes, y compris celles dont le Référentiel n'a pas de code.
    insertAvisoClearButton(container, dispoCell);

    const refCode = extractRefCode(refCell.textContent);
    if (!refCode) return;

    const local = LOCAL_SNIPPETS.find(s => triggerToRefCode(s.trigger) === refCode);
    if (local) {
      insertAvisoLocalIcon(container, dispoCell, local);
      insertAvisoEditIcon(container, local);
    } else {
      insertAvisoAddIcon(container, dispoCell, refCode);
    }

    const match = SNIPPETS.find(s => triggerToRefCode(s.trigger) === refCode);
    if (match) insertAvisoIcon(container, dispoCell, match);
    insertAvisoLawLink(container, refCode);

    const article = IMPORTED_ARTICLES.find(a => a.code === refCode);
    if (article) insertAvisoImportIcon(container, dispoCell, article);
  });

  scanLiensAffaire();
}

let avisoScanTimeoutId = null;
function scheduleAvisoScan() {
  if (avisoScanTimeoutId) clearTimeout(avisoScanTimeoutId);
  avisoScanTimeoutId = setTimeout(scanAvisoTable, 150);
}

// L'intégration est toujours active sur Aviso (le réglage "Intégration Aviso" a été retiré en
// v2.18.0) et reste sans effet sur tout autre site.
if (isAvisoSite()) {
  // Les lignes se chargent/déplient dynamiquement (boutons d'expansion, AJAX) : on réagit à
  // toute modification du DOM plutôt qu'à un seul passage au chargement de la page.
  new MutationObserver(scheduleAvisoScan).observe(document.body, { childList: true, subtree: true });
  scheduleAvisoScan();
}
