// Code.gs — à coller dans Extensions > Apps Script du Google Sheet partagé
//
// Expose le Sheet "Snippets" comme mini-API gratuite :
//   GET                          -> renvoie tous les snippets (lecture, utilisée à chaque synchro)
//   POST {action:"append", ...}  -> ajoute une ligne (déclencheur + contenu, ce dernier facultatif)
//   POST {action:"backup", ...}  -> sauvegarde le Clausier Personnel d'un utilisateur dans
//                                   l'onglet "Local_Snippets_Backup" (jamais dans "Snippets")
//
// Et, dans le tableau lui-même, un menu « Clausier » pour le garant du Clausier Commun :
//   Préparer la revue        -> onglet "Revue" : nouveaux déclencheurs et variantes de snippets
//                               communs trouvés dans les sauvegardes, à adopter ou ignorer
//   Appliquer les décisions  -> reporte dans "Snippets" ce qui a été adopté (ancien texte copié
//                               dans "Historique"), et retient ce qui a été traité
// Ce menu s'exécute avec le code enregistré dans l'éditeur, sans redéploiement.
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
const BACKUP_SHEET_NAME = 'Local_Snippets_Backup';
const BACKUP_HEADER = ['trigger', 'content', 'Ref_User', 'Date'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['trigger', 'content', 'folder']);
  }
  return sheet;
}

function getBackupSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BACKUP_SHEET_NAME);
    sheet.appendRow(BACKUP_HEADER);
    sheet.setFrozenRows(1);
    // Colonne Date en texte : la valeur reste telle qu'écrite ("2026-11-06 14:32"), sans
    // conversion selon les paramètres régionaux du tableau.
    sheet.getRange('D:D').setNumberFormat('@');
    // Masqué : les Clausiers Personnels n'ont pas à s'afficher à tous ceux qui ouvrent le
    // tableau. Masquer ne protège pas (une copie du tableau les montre) : cela évite seulement
    // de les avoir sous les yeux.
    sheet.hideSheet();
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
// Version 4 : POST {action:"backup"} pour la sauvegarde du Clausier Personnel, sondée par
// ?probe=backup. Un script resté en version 3 renvoie le tableau des snippets à cette sonde :
// l'extension ne lui envoie alors rien et réessaie à la synchro suivante.
const API_VERSION = 4;

function doGet(e) {
  if (e && e.parameter && e.parameter.probe === 'append') {
    return json_({ ok: true, api: 'append', version: API_VERSION });
  }
  if (e && e.parameter && e.parameter.probe === 'backup') {
    return json_({ ok: true, api: 'backup', version: API_VERSION });
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
    if (body.action === 'backup') return json_(sauvegarderClausier_(body));
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

// Sauvegarde anonyme des Clausiers Personnels, pour repérer les snippets utiles à intégrer au
// Clausier Commun. N'écrit QUE dans l'onglet "Local_Snippets_Backup" : l'onglet "Snippets"
// reste en ajout seul (voir doPost). Ici, une ligne par couple (Ref_User, trigger) : un snippet
// modifié remplace sa version précédente pour cet utilisateur ; le même déclencheur peut exister
// chez plusieurs utilisateurs. Un snippet supprimé dans l'extension reste dans la sauvegarde.
function sauvegarderClausier_(body) {
  const refUser = String(body.refUser || '').trim();
  // Identifiant aléatoire créé par l'extension : on refuse tout le reste plutôt que d'écrire
  // n'importe quoi dans la colonne qui sert de clé.
  if (!/^[A-Za-z0-9-]{8,64}$/.test(refUser)) return { ok: false, error: 'Ref_User invalide' };
  const recus = Array.isArray(body.snippets) ? body.snippets : [];

  // Deux utilisateurs qui sauvegardent en même temps liraient le même état puis ajouteraient
  // chacun leurs lignes au même endroit.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getBackupSheet_();
    const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    const lignes = sheet.getDataRange().getValues();
    const index = {};
    for (let i = 1; i < lignes.length; i++) {
      index[String(lignes[i][2]) + '\u0000' + String(lignes[i][0]).trim()] = i + 1;
    }

    const ajouts = [];
    let maj = 0;
    recus.forEach(s => {
      const trigger = String((s && s.trigger) || '').trim();
      if (!trigger) return;
      const ligne = [trigger, String(s.content || ''), refUser, date];
      const existante = index[refUser + '\u0000' + trigger];
      if (existante) {
        sheet.getRange(existante, 1, 1, 4).setValues([ligne]);
        maj++;
      } else {
        ajouts.push(ligne);
      }
    });
    if (ajouts.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, ajouts.length, 4).setValues(ajouts);
    }
    return { ok: true, api: 'backup', updated: maj, added: ajouts.length };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// REVUE DU CLAUSIER COMMUN (menu « Clausier », réservé au garant)
// ============================================================================
//
// La revue compare les sauvegardes des Clausiers Personnels à l'onglet "Snippets" :
//   🆕 un déclencheur qui n'existe pas dans le Clausier Commun ;
//   ✏️ un déclencheur commun dont des utilisateurs ont écrit un autre texte.
// Les déclencheurs sont rapprochés sans tenir compte de la casse, des espaces ni du préfixe
// ("/gn4", "/GN4" et "GN4" sont le même). Un texte identique au texte commun n'est pas proposé :
// c'est un utilisateur qui a recopié le snippet commun sans le changer.
//
// Seule exception à l'ajout seul de "Snippets" : « Appliquer les décisions » remplace le texte
// d'un snippet commun, sur décision explicite du garant, après en avoir copié l'ancien texte dans
// "Historique". L'extension, elle, n'y écrit toujours jamais (doPost reste en ajout seul).

const REVUE_SHEET_NAME = 'Revue';
const HISTORIQUE_SHEET_NAME = 'Historique';
const TRAITES_SHEET_NAME = 'Revue_Traités';
const REVUE_HEADER = ['Type', 'Déclencheur', 'Dossier', 'Texte commun actuel', 'Proposition',
  'Utilisateurs', 'Autres variantes', 'Décision', 'Texte final', 'Clé', 'Variantes (JSON)'];
const DECISION_ADOPTER = 'Adopter';
const DECISION_IGNORER = 'Ignorer';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Clausier')
    .addItem('Préparer la revue', 'preparerRevue')
    .addItem('Appliquer les décisions', 'appliquerDecisions')
    .addToUi();
}

// "/gn 4" -> "GN4" : même rapprochement que l'extension pour les codes de Référentiel.
function cleDeclencheur_(trigger) {
  return String(trigger || '').replace(/^[\/;:!]+/, '').replace(/\s+/g, '').toUpperCase();
}

// Deux textes qui ne diffèrent que par des fins de ligne ou des espaces en bout de ligne sont
// le même texte.
function texteNormalise_(texte) {
  return String(texte || '').replace(/\r\n?/g, '\n').split('\n')
    .map(l => l.replace(/\s+$/, '')).join('\n').trim();
}

function feuille_(nom, entete) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(nom);
  if (!sheet) {
    sheet = ss.insertSheet(nom);
    if (entete) {
      sheet.appendRow(entete);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// Onglets de travail du garant : masqués sauf "Revue" pendant qu'il s'en sert.
function masquerOngletsGarant_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [BACKUP_SHEET_NAME, HISTORIQUE_SHEET_NAME, TRAITES_SHEET_NAME].forEach(nom => {
    const sheet = ss.getSheetByName(nom);
    if (sheet && !sheet.isSheetHidden()) sheet.hideSheet();
  });
}

// Textes déjà adoptés ou ignorés, par déclencheur : ils ne reviennent pas à la revue suivante,
// sauf si un utilisateur les modifie (le texte change, il redevient une proposition).
function lireTraites_() {
  const traites = {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRAITES_SHEET_NAME);
  if (!sheet) return traites;
  sheet.getDataRange().getValues().slice(1).forEach(r => {
    const cle = String(r[0]);
    (traites[cle] = traites[cle] || {})[texteNormalise_(r[1])] = true;
  });
  return traites;
}

function lireSnippetsCommuns_() {
  const communs = {};
  const lignes = getSheet_().getDataRange().getValues();
  for (let i = 1; i < lignes.length; i++) {
    const cle = cleDeclencheur_(lignes[i][0]);
    if (!cle || communs[cle]) continue; // un doublon dans le tableau : la première ligne compte
    communs[cle] = {
      ligne: i + 1,
      trigger: String(lignes[i][0]).trim(),
      content: String(lignes[i][1] || ''),
      folder: String(lignes[i][2] || '')
    };
  }
  return communs;
}

function preparerRevue() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const revue = feuille_(REVUE_SHEET_NAME, REVUE_HEADER);

  // Régénérer efface l'onglet : on ne perd pas sans prévenir des décisions pas encore appliquées.
  const enCours = revue.getLastRow() > 1
    ? revue.getRange(2, 8, revue.getLastRow() - 1, 1).getValues().filter(r => String(r[0]).trim()).length
    : 0;
  if (enCours && ui.alert('Revue en cours',
    `${enCours} décision(s) de l'onglet « Revue » n'ont pas encore été appliquées. Les effacer en préparant une nouvelle revue ?`,
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  const communs = lireSnippetsCommuns_();
  const traites = lireTraites_();
  const sauvegardes = getBackupSheet_().getDataRange().getValues().slice(1);

  // cle -> { trigger, variantes: { texteNormalise -> { texte, users:Set, date } } }
  const groupes = {};
  sauvegardes.forEach(r => {
    const cle = cleDeclencheur_(r[0]);
    const texte = texteNormalise_(r[1]);
    if (!cle || !texte) return;
    const commun = communs[cle];
    if (commun && texteNormalise_(commun.content) === texte) return;
    if (traites[cle] && traites[cle][texte]) return;
    const g = groupes[cle] = groupes[cle] || { trigger: String(r[0]).trim(), variantes: {} };
    const v = g.variantes[texte] = g.variantes[texte] || { texte, users: {}, date: '' };
    v.users[String(r[2])] = true;
    if (String(r[3]) > v.date) v.date = String(r[3]);
  });

  const lignes = Object.keys(groupes).map(cle => {
    const g = groupes[cle];
    const commun = communs[cle];
    const variantes = Object.values(g.variantes)
      .map(v => ({ texte: v.texte, nb: Object.keys(v.users).length, date: v.date }))
      .sort((a, b) => b.nb - a.nb || (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
    const total = {};
    Object.values(g.variantes).forEach(v => Object.keys(v.users).forEach(u => { total[u] = true; }));
    const nbTotal = Object.keys(total).length;
    const autres = variantes.slice(1)
      .map(v => `(${v.nb} utilisateur${v.nb > 1 ? 's' : ''})\n${v.texte}`).join('\n\n———\n\n');
    return [
      commun ? '✏️ Variante' : '🆕 Nouveau',
      commun ? commun.trigger : (g.trigger.charAt(0) === '/' ? g.trigger : '/' + g.trigger),
      commun ? commun.folder : '',
      commun ? commun.content : '',
      variantes[0].texte,
      variantes.length > 1 ? `${variantes[0].nb} sur ${nbTotal}` : String(nbTotal),
      autres,
      '',
      variantes[0].texte,
      cle,
      JSON.stringify(variantes.map(v => v.texte))
    ];
  }).sort((a, b) => parseInt(b[5], 10) - parseInt(a[5], 10) || String(a[1]).localeCompare(String(b[1])));

  revue.clear();
  revue.getRange(1, 1, 1, REVUE_HEADER.length).setValues([REVUE_HEADER]).setFontWeight('bold');
  revue.setFrozenRows(1);
  if (lignes.length) {
    revue.getRange(2, 1, lignes.length, REVUE_HEADER.length).setValues(lignes);
    const regle = SpreadsheetApp.newDataValidation()
      .requireValueInList([DECISION_ADOPTER, DECISION_IGNORER], true).setAllowInvalid(false).build();
    revue.getRange(2, 8, lignes.length, 1).setDataValidation(regle);
    revue.getRange(2, 1, lignes.length, REVUE_HEADER.length).setVerticalAlignment('top').setWrap(true);
  }
  [110, 110, 90, 320, 320, 90, 280, 100, 320].forEach((l, i) => revue.setColumnWidth(i + 1, l));
  revue.getRange('I:I').setBackground('#fff8e1'); // la colonne à retoucher
  revue.hideColumns(10, 2); // clé et variantes : à l'usage d'« Appliquer les décisions »

  masquerOngletsGarant_();
  revue.showSheet();
  ss.setActiveSheet(revue);
  ui.alert('Revue prête',
    lignes.length
      ? `${lignes.length} proposition(s), les plus partagées en premier.\n\n` +
        `Pour chacune, choisissez « ${DECISION_ADOPTER} » ou « ${DECISION_IGNORER} » dans la colonne Décision. ` +
        `« ${DECISION_ADOPTER} » enregistre la colonne Texte final, pré-remplie avec la proposition : retouchez-la si besoin. ` +
        `Pour un nouveau déclencheur, indiquez aussi son dossier.\n\nPuis : Clausier > Appliquer les décisions.`
      : 'Aucune nouvelle proposition dans les sauvegardes.',
    ui.ButtonSet.OK);
}

function appliquerDecisions() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const revue = ss.getSheetByName(REVUE_SHEET_NAME);
  if (!revue || revue.getLastRow() < 2) {
    ui.alert('Rien à appliquer', 'Préparez d\'abord la revue : Clausier > Préparer la revue.', ui.ButtonSet.OK);
    return;
  }

  // L'extension peut ajouter une ligne à "Snippets" pendant ce temps (bouton "+", s'il est
  // rebranché) : on travaille sous le même verrou que la sauvegarde.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  const bilan = { ajoutes: 0, modifies: 0, ignores: 0, ecartes: [] };
  try {
    const sheet = getSheet_();
    const communs = lireSnippetsCommuns_();
    const historique = feuille_(HISTORIQUE_SHEET_NAME,
      ['Date', 'Déclencheur', 'Ancien texte', 'Nouveau texte']);
    const traites = feuille_(TRAITES_SHEET_NAME, ['Clé', 'Texte', 'Décision', 'Date']);
    const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

    const lignes = revue.getRange(2, 1, revue.getLastRow() - 1, REVUE_HEADER.length).getValues();
    const aSupprimer = [];
    const memoire = [];

    lignes.forEach((r, i) => {
      const decision = String(r[7]).trim();
      if (!decision) return;
      const trigger = String(r[1]).trim();
      const cle = String(r[9]);
      const variantes = JSON.parse(String(r[10] || '[]'));

      if (decision === DECISION_ADOPTER) {
        const texte = String(r[8] || '').trim();
        if (!texte) { bilan.ecartes.push(`${trigger} : Texte final vide`); return; }
        const commun = communs[cle];
        if (String(r[0]).indexOf('Nouveau') >= 0) {
          if (commun) { bilan.ecartes.push(`${trigger} : ajouté au Clausier Commun depuis la revue, à revoir`); return; }
          sheet.appendRow([trigger, texte, String(r[2] || '')]);
          communs[cle] = { ligne: sheet.getLastRow(), trigger, content: texte, folder: String(r[2] || '') };
          bilan.ajoutes++;
        } else {
          if (!commun) { bilan.ecartes.push(`${trigger} : n'existe plus dans le Clausier Commun`); return; }
          // Modifié dans "Snippets" depuis la préparation : on ne remplace pas un texte que la
          // revue n'a pas montré.
          if (texteNormalise_(commun.content) !== texteNormalise_(r[3])) {
            bilan.ecartes.push(`${trigger} : texte commun modifié depuis la préparation de la revue`);
            return;
          }
          historique.appendRow([date, commun.trigger, commun.content, texte]);
          sheet.getRange(commun.ligne, 2).setValue(texte);
          commun.content = texte;
          bilan.modifies++;
        }
      } else if (decision === DECISION_IGNORER) {
        bilan.ignores++;
      } else {
        return;
      }
      // Adopter ou ignorer tranche pour toutes les variantes montrées : aucune ne revient.
      variantes.forEach(t => memoire.push([cle, t, decision, date]));
      aSupprimer.push(i + 2);
    });

    if (memoire.length) traites.getRange(traites.getLastRow() + 1, 1, memoire.length, 4).setValues(memoire);
    aSupprimer.reverse().forEach(n => revue.deleteRow(n));
  } finally {
    lock.releaseLock();
  }

  masquerOngletsGarant_();
  if (revue.getLastRow() < 2) revue.hideSheet(); // revue terminée : l'onglet se range avec les autres
  ui.alert('Décisions appliquées',
    `${bilan.ajoutes} snippet(s) ajouté(s), ${bilan.modifies} modifié(s) (ancien texte dans « ${HISTORIQUE_SHEET_NAME} »), ` +
    `${bilan.ignores} ignoré(s).` +
    (bilan.ecartes.length ? `\n\nNon appliqués, restés dans la revue :\n- ${bilan.ecartes.join('\n- ')}` : '') +
    '\n\nLes utilisateurs recevront les changements à leur prochaine actualisation.',
    ui.ButtonSet.OK);
}
