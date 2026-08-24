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

// Ligne de champ : libellé court, puis ':' puis la valeur. La découpe se fait au PREMIER ':'
// uniquement — les valeurs en contiennent ("... en présence du public : le chantier précède ...").
// Le libellé est borné à 28 caractères et exclut ':' pour ne pas confondre une phrase de
// continuation ponctuée avec un nouveau champ.
const IMPORT_FIELD_RE = /^\s+([A-Za-zÀ-Ý][^:\n]{0,28}?)\s*:\s*(.*)$/;

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

    const field = IMPORT_FIELD_RE.exec(rawLine);
    if (field) {
      current.champs.push({ label: field[1].trim(), valeur: field[2].trim() });
    } else if (current.champs.length) {
      // Ligne sans libellé : suite de la valeur précédente (valeur repliée sur plusieurs lignes).
      const last = current.champs[current.champs.length - 1];
      last.valeur = (last.valeur + ' ' + rawLine.trim()).trim();
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
    .map(c => `${c.label} : ${c.valeur}`)
    .join('\n');
}
