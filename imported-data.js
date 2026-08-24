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
const IMPORT_HEADER_RE = /^\s*([A-Za-z]{1,4})\s*(\d+)\s*[—–-]\s*(.+?)\s*$/;

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

function parseImportedData(text) {
  const articles = [];
  let current = null;

  for (const rawLine of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (!rawLine.trim()) continue;

    const header = IMPORT_HEADER_RE.exec(rawLine);
    if (header) {
      current = {
        code: (header[1] + header[2]).toUpperCase(),
        titre: header[3],
        champs: []
      };
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
