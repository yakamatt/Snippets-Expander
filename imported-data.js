// imported-data.js — analyse des données de dossier collées/importées, par article réglementaire
//
// Le texte importé décrit un article par bloc, sous la forme :
//
//     GN 12 — Justification des classements de comportement au feu
//       Exigence      : ...
//       Travaux prévus: ...
//       Source        : ...
//       Statut        : Non renseigné
//
// Les libellés de champs ne sont pas figés : tout "Libellé : valeur" est accepté, ce qui évite
// d'avoir à rouvrir le code si le document source gagne une rubrique.
//
// Partagé entre le popup (analyse à l'import), la page Paramètres (affichage) et le script de
// contenu (insertion dans Aviso), d'où un fichier séparé plutôt qu'une copie dans chacun.

// "GN 12 — Titre de l'article" -> code "GN12" (même normalisation que le Référentiel Aviso et
// que sitesecurite-articles.js, pour que les trois se recoupent sans conversion).
const IMPORT_HEADER_RE = /^\s*([A-Za-z]{1,4})\s*(\d+(?:-\d+)?)\s*[—–-]\s*(.+?)\s*$/;

// Certains référentiels Aviso n'ont pas de code d'article : les missions solidité listent des
// rubriques nommées ("Reconnaissance des sols", "Fondations profondes"). Aviso construit alors
// son code depuis le libellé entier (extractRefCode dans content.js retombe sur le texte complet
// quand il n'y a pas de " - "). L'en-tête d'un tel bloc est donc le libellé seul.
//
// On le reconnaît à sa position : dans un fichier d'import, un en-tête est en colonne 0 et les
// champs sont indentés. Deux garde-fous : la ligne ne doit pas être une ligne de champ, et ne
// doit pas être une barre de séparation ou une puce.
const IMPORT_LABEL_HEADER_EXCLUDE_RE = /^[=\-_*#•>|\s]/;

// Ligne de champ : libellé, puis ':' puis la valeur. La découpe se fait au PREMIER ':'
// uniquement — les valeurs en contiennent ("... en présence du public : le chantier précède ...").
const IMPORT_FIELD_RE = /^\s*([^:\n]{1,80}?)\s*:\s*(.*)$/;

// Reconnaît une ligne "Libellé : valeur", ou renvoie null si la ligne n'en est pas une.
// Deux garde-fous, volontairement larges : un libellé réaliste peut être long ("Travaux prévus
// dans le cadre du projet" fait 38 caractères), mais il ne contient pas de point — c'est ce qui
// distingue un vrai champ d'une phrase qui se poursuit et comporte un ':'.
// Se tromper ici ne fait jamais perdre de texte : une ligne non reconnue est rattachée au champ
// précédent (voir parseImportedData), elle reste donc intégralement présente.
function splitImportedField(line) {
  const m = IMPORT_FIELD_RE.exec(line);
  if (!m) return null;

  const label = m[1].trim();
  if (!label || label.includes('.')) return null;
  if (!/^[A-Za-zÀ-ÿ0-9]/.test(label)) return null;

  return { label, valeur: m[2].trim() };
}

// Normalisation commune à l'import et au scan Aviso : "GN 4" et "GN4" désignent le même code,
// "Reconnaissance des sols" devient "RECONNAISSANCEDESSOLS".
function normalizeImportedCode(str) {
  return String(str || '').replace(/\s+/g, '').toUpperCase();
}

// Rend { code, titre } si la ligne ouvre un bloc, sinon null.
function importedHeader(rawLine) {
  const m = IMPORT_HEADER_RE.exec(rawLine);
  if (m) {
    return { code: normalizeImportedCode(m[1] + m[2]), titre: m[3] };
  }

  // En-tête « libellé seul » : colonne 0, pas une ligne de champ, pas une séparation.
  if (IMPORT_LABEL_HEADER_EXCLUDE_RE.test(rawLine)) return null;
  if (splitImportedField(rawLine)) return null;

  const text = rawLine.trim();
  if (!text) return null;
  const sep = text.indexOf(' - ');
  const code = normalizeImportedCode(sep >= 0 ? text.slice(0, sep) : text);
  if (!code) return null;
  return { code, titre: sep >= 0 ? text.slice(sep + 3).trim() : text };
}

function parseImportedData(text) {
  const articles = [];
  let current = null;

  for (const rawLine of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (!rawLine.trim()) continue;

    const header = importedHeader(rawLine);
    if (header) {
      current = { code: header.code, titre: header.titre, champs: [] };
      articles.push(current);
      continue;
    }

    if (!current) continue; // texte avant le premier en-tête : ignoré

    const field = splitImportedField(rawLine);
    if (field) {
      current.champs.push(field);
    } else if (current.champs.length) {
      // Ligne sans libellé : suite de la valeur précédente (valeur repliée sur plusieurs lignes).
      const last = current.champs[current.champs.length - 1];
      last.valeur = (last.valeur + ' ' + rawLine.trim()).trim();
    } else {
      // Ligne non reconnue, et aucun champ auquel la rattacher : on la conserve telle quelle,
      // sans libellé. Tout le texte situé sous l'en-tête doit se retrouver dans l'article —
      // une ligne écartée ici serait perdue sans que rien ne le signale.
      current.champs.push({ label: '', valeur: rawLine.trim() });
    }
  }

  // Un bloc sans aucun champ n'apporte rien à insérer : on l'écarte plutôt que de proposer
  // dans Aviso une icône qui n'ajouterait rien.
  return articles.filter(a => a.champs.length > 0);
}

// Texte inséré dans Aviso : uniquement les champs, jamais la ligne de titre de l'article —
// la ligne Aviso porte déjà son Référentiel, le répéter n'apporterait rien.
function importedArticleToText(article) {
  return (article && article.champs ? article.champs : [])
    .map(c => (c.label ? `${c.label} : ${c.valeur}` : c.valeur))
    .join('\n');
}
