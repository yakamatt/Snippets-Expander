// Code.gs — à coller dans Extensions > Apps Script du Google Sheet partagé
//
// Expose le Sheet "Snippets" comme mini-API gratuite :
//   GET                          -> renvoie tous les snippets (lecture, utilisée à chaque synchro)
//   POST {action:"append", ...}  -> ajoute une ligne (déclencheur + contenu, ce dernier facultatif)
//
// Le POST sert au bouton "+" de l'intégration Aviso : il crée la ligne en y reprenant le texte
// déjà saisi dans la cellule "Dispositions réalisées" (vide si la cellule l'était), puis
// l'extension rouvre le tableau sur la cellule "content" pour compléter ou relire.
//
// ⚠️ Après toute modification de ce fichier : Déployer > Gérer les déploiements > (crayon) >
// Version : "Nouvelle version" > Déployer. Sans nouvelle version, l'URL /exec continue de
// servir l'ancien code.
//
// ============================================================================
// GUIDE DE DÉPLOIEMENT COMPLET
// ============================================================================
//
// Le script Apps Script doit être déployé en tant qu'application web, accessible via une URL
// /exec. Sans redéploiement après chaque modification, l'extension utilise l'ancienne version.
// C'est critique, car le bouton "+" de l'extension vérifie la version du script AVANT d'écrire
// (v2.15.1) : si le script n'a pas été redéployé, le bouton refuse proprement plutôt que de
// risquer d'écraser le tableau.
//
// ÉTAPES POUR DÉPLOYER (première fois, ou après modification du code)
// ==================================================================
//
// 1. ACCÉDER À L'ÉDITEUR APPS SCRIPT
//    └─ Dans Google Sheets, ouvrir ton tableau de snippets
//    └─ Menu : Extensions > Apps Script
//    └─ L'éditeur s'ouvre dans un nouvel onglet
//
// 2. COPIER-COLLER LE CODE (première fois)
//    └─ Copier tout ce fichier (Code.gs)
//    └─ Dans l'éditeur Apps Script, effacer le contenu par défaut
//    └─ Coller le code de ce fichier
//    └─ Ctrl+S (ou Cmd+S) pour enregistrer
//
// 3. CRÉER UN PREMIER DÉPLOIEMENT
//    └─ Bouton "Déployer" (en haut à droite) > Nouveau déploiement
//    └─ Type : "Application web"
//    └─ Exécuter en tant que : [ton compte Google]
//    └─ Accès : "N'importe quel utilisateur"
//    └─ Cliquer "Déployer"
//    └─ Copier l'URL de l'application web (format : https://script.google.com/macros/s/[ID]/exec)
//    └─ Cette URL est celle à coller dans les Paramètres avancés de l'extension
//
// 4. APRÈS CHAQUE MODIFICATION DU CODE
//    └─ Enregistrer le code (Ctrl+S)
//    └─ Cliquer sur "Déployer" > "Gérer les déploiements"
//    └─ Un déploiement "Application web" est listé
//    └─ Cliquer sur l'icône crayon (modifier)
//    └─ Dans "Version", sélectionner "Nouvelle version" (pas "Version la plus récente")
//    └─ Cliquer "Déployer"
//    └─ La même URL /exec sert maintenant le nouveau code
//    └─ Recharger l'extension Chrome (chrome://extensions > Actualiser ⟳)
//
// ⚠️ ERREUR COURANTE : choisir "Version la plus récente" au lieu de "Nouvelle version"
//    └─ L'URL ne change pas, mais elle continue de servir l'ANCIEN code
//    └─ L'extension s'en protège (v2.15.1+) : elle vérifie la version avant d'écrire
//    └─ Si le script n'a pas été redéployé, le bouton "+" refusera proprement
//
// DÉPANNAGE
// =========
//
// Q: Pourquoi le bouton "+" me dit "Script Google Sheets obsolète" ?
// R: Le script n'a pas été redéployé en "Nouvelle version" après sa modification.
//    Suis les étapes 4 ci-dessus, puis recharge l'extension Chrome.
//
// Q: L'URL que j'ai collée dans les Paramètres a changé après le déploiement ?
// R: Non — l'URL reste la même (elle continue de finir par /exec).
//    Ce qui change, c'est la version du code qu'elle sert.
//
// Q: Comment savoir si mon script fonctionne correctement ?
// R: Dans l'extension, cliquer le bouton "+" sur une ligne Aviso.
//    Si le tableau Google Sheets s'ouvre sur la ligne créée, c'est bon.
//    S'il affiche "Script Google Sheets obsolète", c'est qu'il faut redéployer.
//
// Q: Puis-je utiliser la même URL /exec pour plusieurs tableaux ?
// R: Non. Chaque tableau (chaque projet Apps Script) a sa propre URL.
//    Si tu crées un nouveau tableau, tu dois créer un nouveau script et en copier
//    la nouvelle URL dans les Paramètres avancés de l'extension.

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

// Version de l'API exposée par ce script. L'extension la vérifie AVANT tout POST : une version
// antérieure de ce fichier réécrivait le tableau entier sur n'importe quel POST, et un client
// récent parlant à un script ancien effaçait donc tous les snippets. Le POST n'est plus émis
// tant que cette signature n'a pas été obtenue.
// Version 3 : le POST accepte un champ "content". Un script resté en version 2 crée la ligne
// sans contenu — l'extension continue de fonctionner, il faut juste ressaisir le texte dans le
// tableau. Redéployer en "Nouvelle version" suffit à récupérer le pré-remplissage.
const API_VERSION = 3;

function doGet(e) {
  if (e && e.parameter && e.parameter.probe === 'append') {
    return json_({ ok: true, api: 'append', version: API_VERSION });
  }

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

    // Contenu pré-rempli : le texte déjà saisi dans la cellule Aviso au moment du clic sur "+".
    // Vide si la cellule l'était — la ligne est alors créée sans contenu, comme avant.
    const contenu = String(body.content || '').trim();

    const sheet = getSheet_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rows = sheet.getDataRange().getValues().slice(1);
    const triggers = rows.map(r => String(r[0]).trim());

    // Déjà présent : on renvoie sa ligne au lieu d'en créer une seconde au même déclencheur,
    // que l'expansion de texte départagerait de façon arbitraire.
    const deja = triggers.indexOf(trigger);
    if (deja >= 0) {
      const ligne = deja + 2;
      // Le contenu existant n'est jamais remplacé : on ne remplit que si la cellule est vide,
      // pour ne pas écraser un texte rédigé dans le tableau par un texte venu d'Aviso.
      if (contenu && !String(rows[deja][1] || '').trim()) {
        sheet.getRange(ligne, 2).setValue(contenu);
      }
      return json_({
        ok: true, created: false, row: ligne,
        gid: sheet.getSheetId(), sheetUrl: ss.getUrl()
      });
    }

    sheet.appendRow([trigger, contenu, String(body.folder || '')]);
    return json_({
      ok: true, created: true, row: sheet.getLastRow(),
      gid: sheet.getSheetId(), sheetUrl: ss.getUrl()
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
