// clausier-fichiers.js — lecture et écriture des fichiers du Clausier Personnel (.xlsx, .csv)
//
// Sans dépendance, comme le reste de l'extension :
// - XLSX : un .xlsx est une archive zip de fichiers XML. L'écriture produit une archive non
//   compressée (méthode "stored", que tout lecteur accepte) ; la lecture décompresse avec
//   DecompressionStream('deflate-raw'), natif dans Chrome.
// - CSV : séparateur ";" et UTF-8 avec BOM à l'écriture, pour qu'Excel en français l'ouvre
//   directement en colonnes et avec les accents. À la lecture, le séparateur est détecté et un
//   fichier non UTF-8 (Excel enregistre ses CSV en Windows-1252) est décodé comme tel.
// Le format .xls (Excel 97-2003, binaire) n'est pas pris en charge.

const CLAUSIER_ENTETES = ['declencheur', 'contenu'];

// Préfixe usuel d'un déclencheur, le même que celui que triggerToRefCode (content.js) retire
// pour rapprocher un snippet d'un Référentiel Aviso.
const CLAUSIER_PREFIXE_RE = /^[/;:!]/;

// "GN 4" saisi dans le modèle devient "/GN 4" : sans préfixe, le déclencheur s'expanserait en
// pleine rédaction, dès qu'on tape ces lettres dans un texte ordinaire.
function normaliserDeclencheur(valeur) {
  const t = String(valeur ?? '').trim();
  if (!t) return '';
  return CLAUSIER_PREFIXE_RE.test(t) ? t : '/' + t;
}

function normaliserContenu(valeur) {
  return String(valeur ?? '').replace(/\r\n?/g, '\n').replace(/\s+$/, '');
}

// ---------- Lecture : du fichier à la liste de snippets ----------

async function lireFichierClausier(file) {
  const nom = file.name.toLowerCase();
  if (nom.endsWith('.xls')) {
    throw new Error('le format .xls (Excel 97-2003) n\'est pas pris en charge. Dans Excel : Fichier > Enregistrer sous > .xlsx ou .csv.');
  }
  const buffer = await file.arrayBuffer();
  const estZip = buffer.byteLength > 4 && new DataView(buffer).getUint32(0, true) === 0x04034b50;
  const lignes = estZip ? await lireXlsx(buffer) : lireCsv(decoderTexte(buffer));
  return lignesVersSnippets(lignes);
}

function normaliserEntete(valeur) {
  return String(valeur ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Les colonnes sont repérées par leur en-tête quand il existe (dans n'importe quel ordre) ; à
// défaut, la première colonne est le déclencheur et la deuxième le contenu, et la première
// ligne est alors une donnée comme les autres.
function lignesVersSnippets(lignes) {
  const nonVides = lignes.filter(l => l.some(c => String(c ?? '').trim()));
  if (!nonVides.length) return { snippets: [], ignorees: 0 };

  const entete = nonVides[0].map(normaliserEntete);
  const iTrigger = entete.findIndex(c => /^(declencheur|trigger|raccourci)$/.test(c));
  const iContenu = entete.findIndex(c => /^(contenu|content|texte)$/.test(c));
  const aEntete = iTrigger >= 0 && iContenu >= 0;
  const colTrigger = aEntete ? iTrigger : 0;
  const colContenu = aEntete ? iContenu : 1;

  const snippets = [];
  let ignorees = 0;
  nonVides.slice(aEntete ? 1 : 0).forEach(ligne => {
    const trigger = normaliserDeclencheur(ligne[colTrigger]);
    const content = normaliserContenu(ligne[colContenu]);
    if (!trigger || !content.trim()) {
      ignorees++;
      return;
    }
    snippets.push({ trigger, content });
  });
  return { snippets, ignorees };
}

function decoderTexte(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

// Analyse CSV (RFC 4180) : champs entre guillemets, "" pour un guillemet, sauts de ligne
// autorisés à l'intérieur d'un champ entre guillemets — un contenu de snippet en a souvent.
function lireCsv(texte) {
  texte = texte.replace(/^﻿/, '');
  const premiere = texte.split(/\r?\n/, 1)[0];
  const compter = (c) => premiere.split(c).length - 1;
  const sep = [';', '\t', ','].reduce((meilleur, c) => compter(c) > compter(meilleur) ? c : meilleur, ';');

  const lignes = [];
  let ligne = [];
  let champ = '';
  let entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') { champ += '"'; i++; }
        else entreGuillemets = false;
      } else {
        champ += c;
      }
    } else if (c === '"' && champ === '') {
      entreGuillemets = true;
    } else if (c === sep) {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
    } else {
      champ += c;
    }
  }
  if (champ !== '' || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes;
}

// ---------- Lecture XLSX ----------

function lireRepertoireZip(buffer) {
  const dv = new DataView(buffer);
  const octets = new Uint8Array(buffer);
  // L'enregistrement de fin de répertoire est à la fin de l'archive, suivi d'un éventuel
  // commentaire (65 535 octets au plus) : on le cherche en remontant depuis la fin.
  let fin = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('fichier .xlsx illisible (archive incomplète)');

  const nombre = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const entrees = new Map();
  const decodeur = new TextDecoder();
  for (let k = 0; k < nombre; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('fichier .xlsx illisible (répertoire corrompu)');
    const lNom = dv.getUint16(p + 28, true);
    const lExtra = dv.getUint16(p + 30, true);
    const lCommentaire = dv.getUint16(p + 32, true);
    entrees.set(decodeur.decode(octets.subarray(p + 46, p + 46 + lNom)), {
      methode: dv.getUint16(p + 10, true),
      // Tailles lues dans le répertoire central, pas dans l'en-tête local : celui-ci peut les
      // laisser à zéro et les reporter après les données (bit 3, "data descriptor").
      tailleCompressee: dv.getUint32(p + 20, true),
      offsetLocal: dv.getUint32(p + 42, true)
    });
    p += 46 + lNom + lExtra + lCommentaire;
  }
  return entrees;
}

async function extraireDuZip(buffer, entree) {
  const dv = new DataView(buffer);
  const o = entree.offsetLocal;
  const debut = o + 30 + dv.getUint16(o + 26, true) + dv.getUint16(o + 28, true);
  const donnees = new Uint8Array(buffer, debut, entree.tailleCompressee);
  if (entree.methode === 0) return donnees;
  if (entree.methode === 8) {
    const flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(flux).arrayBuffer());
  }
  throw new Error('fichier .xlsx compressé dans un format non pris en charge');
}

function analyserXml(texte) {
  const doc = new DOMParser().parseFromString(texte, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('fichier .xlsx illisible (XML invalide)');
  return doc;
}

// Par nom local, quel que soit le préfixe d'espace de noms : selon le logiciel qui l'a produit,
// un .xlsx écrit <c> ou <x:c>.
function elements(racine, nom) {
  return Array.from(racine.getElementsByTagNameNS('*', nom));
}

// Texte d'une chaîne Excel : un seul <t>, ou plusieurs <r><t> pour un texte mis en forme. Les
// <rPh> (indications phonétiques des textes japonais) ne font pas partie du texte affiché.
function texteExcel(el) {
  return elements(el, 't')
    .filter(t => !(t.parentNode && t.parentNode.localName === 'rPh'))
    .map(t => t.textContent)
    .join('');
}

// Excel échappe certains caractères en _xHHHH_ (le retour chariot devient _x000D_).
function decoderEchappementsExcel(v) {
  return v.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function indexColonne(ref) {
  const m = /^([A-Z]+)/.exec(ref || '');
  if (!m) return null;
  return m[1].split('').reduce((n, l) => n * 26 + (l.charCodeAt(0) - 64), 0) - 1;
}

// Lit la première feuille du classeur en tableau de lignes (chaque ligne : tableau de textes).
async function lireXlsx(buffer) {
  const entrees = lireRepertoireZip(buffer);
  const lire = async (nom) => {
    const entree = entrees.get(nom);
    return entree ? new TextDecoder().decode(await extraireDuZip(buffer, entree)) : null;
  };

  let cheminFeuille = 'xl/worksheets/sheet1.xml';
  const classeur = await lire('xl/workbook.xml');
  const relations = await lire('xl/_rels/workbook.xml.rels');
  if (classeur && relations) {
    const premiere = elements(analyserXml(classeur), 'sheet')[0];
    const rid = premiere && (premiere.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || premiere.getAttribute('r:id'));
    const rel = elements(analyserXml(relations), 'Relationship').find(r => r.getAttribute('Id') === rid);
    if (rel) {
      const cible = rel.getAttribute('Target') || '';
      cheminFeuille = cible.startsWith('/') ? cible.slice(1) : 'xl/' + cible;
    }
  }

  const partagees = [];
  const xmlPartagees = await lire('xl/sharedStrings.xml');
  if (xmlPartagees) elements(analyserXml(xmlPartagees), 'si').forEach(si => partagees.push(texteExcel(si)));

  const xmlFeuille = await lire(cheminFeuille);
  if (!xmlFeuille) throw new Error('aucune feuille trouvée dans le fichier .xlsx');

  return elements(analyserXml(xmlFeuille), 'row').map(row => {
    const ligne = [];
    elements(row, 'c').forEach(c => {
      const col = indexColonne(c.getAttribute('r')) ?? ligne.length;
      const type = c.getAttribute('t');
      let v;
      if (type === 'inlineStr') {
        const is = elements(c, 'is')[0];
        v = is ? texteExcel(is) : '';
      } else {
        const ve = elements(c, 'v')[0];
        v = ve ? ve.textContent : '';
        if (type === 's') v = partagees[Number(v)] ?? '';
      }
      ligne[col] = decoderEchappementsExcel(v);
    });
    return Array.from(ligne, x => x ?? '');
  });
}

// ---------- Écriture CSV ----------

function clausierVersCsv(snippets) {
  const champ = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lignes = [CLAUSIER_ENTETES, ...snippets.map(s => [s.trigger, s.content])]
    .map(l => l.map(champ).join(';'));
  return new Blob(['﻿' + lignes.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}

// ---------- Écriture XLSX ----------

function echapperXml(v) {
  return String(v ?? '')
    .replace(/\r\n?/g, '\n')
    // Caractères de contrôle interdits en XML 1.0 : Excel refuserait d'ouvrir le fichier.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const XLSX_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XLSX_NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// Style 1 : en-tête en gras. Style 2 : format Texte (numFmt 49), aligné en haut et renvoyé à la
// ligne — appliqué aux colonnes entières, il vaut aussi pour les lignes saisies plus tard dans
// le modèle vierge : "4-1" ou "0012" y restent du texte au lieu de devenir une date ou un nombre.
const XLSX_STYLES = XML_DECL +
  `<styleSheet xmlns="${XLSX_NS}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>' +
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function clausierVersXlsx(snippets) {
  const cellule = (ref, valeur, style) =>
    `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${echapperXml(valeur)}</t></is></c>`;
  const lignes = [
    `<row r="1">${cellule('A1', CLAUSIER_ENTETES[0], 1)}${cellule('B1', CLAUSIER_ENTETES[1], 1)}</row>`,
    ...snippets.map((s, i) => {
      const n = i + 2;
      return `<row r="${n}">${cellule('A' + n, s.trigger, 2)}${cellule('B' + n, s.content, 2)}</row>`;
    })
  ];

  const feuille = XML_DECL +
    `<worksheet xmlns="${XLSX_NS}">` +
    // Ligne d'en-tête figée : elle reste visible en faisant défiler un long clausier.
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<cols><col min="1" max="1" width="26" style="2" customWidth="1"/><col min="2" max="2" width="110" style="2" customWidth="1"/></cols>' +
    `<sheetData>${lignes.join('')}</sheetData>` +
    '</worksheet>';

  const fichiers = {
    '[Content_Types].xml': XML_DECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels': XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      `<Relationship Id="rId1" Type="${XLSX_NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
      '</Relationships>',
    'xl/workbook.xml': XML_DECL +
      `<workbook xmlns="${XLSX_NS}" xmlns:r="${XLSX_NS_REL}">` +
      '<sheets><sheet name="Clausier Personnel" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      `<Relationship Id="rId1" Type="${XLSX_NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${XLSX_NS_REL}/styles" Target="styles.xml"/>` +
      '</Relationships>',
    'xl/styles.xml': XLSX_STYLES,
    'xl/worksheets/sheet1.xml': feuille
  };

  const encodeur = new TextEncoder();
  return creerZip(Object.entries(fichiers).map(([nom, texte]) => ({ nom, donnees: encodeur.encode(texte) })),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

let TABLE_CRC32 = null;
function crc32(octets) {
  if (!TABLE_CRC32) {
    TABLE_CRC32 = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      TABLE_CRC32[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < octets.length; i++) crc = TABLE_CRC32[(crc ^ octets[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Archive zip sans compression ("stored") : quelques dizaines de lignes au lieu d'un
// compresseur, au prix d'un fichier un peu plus gros — sans importance pour un clausier.
function creerZip(fichiers, type) {
  const d = new Date();
  const heureDos = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dateDos = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const encodeur = new TextEncoder();
  const locaux = [];
  const central = [];
  let offset = 0;

  fichiers.forEach(({ nom, donnees }) => {
    const nomOctets = encodeur.encode(nom);
    const crc = crc32(donnees);

    const l = new DataView(new ArrayBuffer(30));
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true); // noms en UTF-8
    l.setUint16(8, 0, true);      // stored
    l.setUint16(10, heureDos, true);
    l.setUint16(12, dateDos, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, donnees.length, true);
    l.setUint32(22, donnees.length, true);
    l.setUint16(26, nomOctets.length, true);
    l.setUint16(28, 0, true);
    locaux.push(new Uint8Array(l.buffer), nomOctets, donnees);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, heureDos, true);
    c.setUint16(14, dateDos, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, donnees.length, true);
    c.setUint32(24, donnees.length, true);
    c.setUint16(28, nomOctets.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), nomOctets);

    offset += 30 + nomOctets.length + donnees.length;
  });

  const tailleCentral = central.reduce((n, m) => n + m.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, fichiers.length, true);
  fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true);
  fin.setUint32(16, offset, true);

  return new Blob([...locaux, ...central, new Uint8Array(fin.buffer)], { type });
}

// ---------- Téléchargement ----------
// Un lien <a download> suffit depuis une page de l'extension : pas besoin de la permission
// "downloads", ni de demander quoi que ce soit à l'utilisateur au-delà du dialogue de Chrome.
function telechargerFichier(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
