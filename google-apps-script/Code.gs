// Code.gs — à coller dans Extensions > Apps Script du Google Sheet partagé
//
// Expose le Sheet "Snippets" comme mini-API gratuite :
//   GET                          -> renvoie tous les snippets (lecture, utilisée à chaque synchro)
//   POST {action:"append", ...}  -> ajoute une ligne avec un déclencheur, contenu laissé vide
//
// Le POST sert au bouton "+" de l'intégration Aviso : il crée la ligne, l'extension rouvre
// ensuite le tableau sur la cellule "content" pour que l'utilisateur saisisse le texte.
//
// ⚠️ Après toute modification de ce fichier : Déployer > Gérer les déploiements > (crayon) >
// Version : "Nouvelle version" > Déployer. Sans nouvelle version, l'URL /exec continue de
// servir l'ancien code.

const SHEET_NAME = 'Snippets';

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['trigger', 'content', 'folder']);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  data.shift(); // enlève l'en-tête
  const snippets = data
    .filter(row => row[0])
    .map(row => ({
      trigger: String(row[0]),
      content: String(row[1] || ''),
      folder: String(row[2] || '')
    }));
  return json_(snippets);
}

// Ajout d'une seule ligne. Volontairement non destructif : la version précédente de ce script
// vidait tout le tableau avant de le réécrire (héritage d'avant le passage en lecture seule de
// l'extension, qui ne l'appelait plus). Un appel inattendu aurait effacé les snippets.
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action !== 'append') {
      return json_({ ok: false, error: 'Action inconnue : ' + body.action });
    }

    const trigger = String(body.trigger || '').trim();
    if (!trigger) return json_({ ok: false, error: 'Déclencheur vide' });

    const sheet = getSheet_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const triggers = sheet.getDataRange().getValues().slice(1).map(r => String(r[0]).trim());

    // Déjà présent : on renvoie sa ligne au lieu d'en créer une seconde au même déclencheur,
    // que l'expansion de texte départagerait de façon arbitraire.
    const deja = triggers.indexOf(trigger);
    if (deja >= 0) {
      return json_({
        ok: true, created: false, row: deja + 2,
        gid: sheet.getSheetId(), sheetUrl: ss.getUrl()
      });
    }

    sheet.appendRow([trigger, '', String(body.folder || '')]);
    return json_({
      ok: true, created: true, row: sheet.getLastRow(),
      gid: sheet.getSheetId(), sheetUrl: ss.getUrl()
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
