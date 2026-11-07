// Code.gs — à coller dans Extensions > Apps Script du Google Sheet partagé
//
// Expose le Sheet "Snippets" comme mini-API gratuite :
//   GET                          -> renvoie tous les snippets (lecture, utilisée à chaque synchro)
//   POST {action:"append", ...}  -> ajoute une ligne (déclencheur + contenu, ce dernier facultatif)
//   POST {action:"backup", ...}  -> sauvegarde le Clausier Personnel d'un utilisateur dans
//                                   l'onglet "Local_Snippets_Backup" (jamais dans "Snippets")
//   POST {action:"stats", ...}   -> statistiques d'utilisation anonymes, dans l'onglet
//                                   "Statistiques" (une ligne par utilisateur et par jour)
//
// Et, dans le tableau lui-même, un menu « Clausier » pour le garant du Clausier Commun :
//   Préparer la revue        -> onglet "Revue" : nouveaux déclencheurs et variantes de snippets
//                               communs trouvés dans les sauvegardes, à adopter ou ignorer
//   Appliquer les décisions  -> reporte dans "Snippets" ce qui a été adopté (ancien texte copié
//                               dans "Historique"), et retient ce qui a été traité
//   Synthèse hebdomadaire / mensuelle -> onglets "Synthèse_Hebdo" / "Synthèse_Mensuelle" :
//                               utilisateurs et usage par semaine ou par mois
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
    sheet.appendRow(['trigger', 'content']);
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
// Version 5 : POST {action:"stats"} pour les statistiques d'utilisation, sondée par ?probe=stats,
// avec le même repli : un script resté en version 4 ne reçoit rien.
const API_VERSION = 5;

function doGet(e) {
  if (e && e.parameter && e.parameter.probe === 'append') {
    return json_({ ok: true, api: 'append', version: API_VERSION });
  }
  if (e && e.parameter && e.parameter.probe === 'backup') {
    return json_({ ok: true, api: 'backup', version: API_VERSION });
  }
  if (e && e.parameter && e.parameter.probe === 'stats') {
    return json_({ ok: true, api: 'stats', version: API_VERSION });
  }

  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  data.shift(); // enlève l'en-tête
  const snippets = data
    .filter(row => row[0])
    .map(row => ({
      trigger: String(row[0]),
      content: String(row[1] || '')
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
    if (body.action === 'stats') return json_(enregistrerStatistiques_(body));
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

    sheet.appendRow([trigger, contenu]);
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
// Colonnes lues par position dans appliquerDecisions : toute modification de cet en-tête s'y
// reporte (une revue préparée avec un autre en-tête est refusée, voir plus bas).
const REVUE_HEADER = ['Type', 'Déclencheur', 'Texte commun actuel', 'Proposition',
  'Utilisateurs', 'Autres variantes', 'Décision', 'Texte final', 'Clé', 'Variantes (JSON)'];
const DECISION_ADOPTER = 'Adopter';
const DECISION_IGNORER = 'Ignorer';
// Ajoutées à la colonne Type quand « Préparer la revue » reporte le travail de la revue précédente.
const MARQUE_RETOUCHE = '✍️ retouche conservée';
const MARQUE_CHANGEE = '🔄 proposition changée';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Clausier')
    .addItem('Préparer la revue', 'preparerRevue')
    .addItem('Appliquer les décisions', 'appliquerDecisions')
    .addSeparator()
    .addItem('Synthèse hebdomadaire des statistiques', 'syntheseHebdomadaire')
    .addItem('Synthèse mensuelle des statistiques', 'syntheseMensuelle')
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
  [BACKUP_SHEET_NAME, HISTORIQUE_SHEET_NAME, TRAITES_SHEET_NAME, STATS_SHEET_NAME].forEach(nom => {
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
      content: String(lignes[i][1] || '')
    };
  }
  return communs;
}

// Ce que le garant a déjà fait dans l'onglet "Revue" (décisions non appliquées, Texte final
// retouché), par clé, pour le reporter dans la revue suivante. Les colonnes sont cherchées par
// nom : un onglet d'un format inconnu n'est pas reporté, ses lignes sont seulement comptées.
function lireRevueEnCours_(revue) {
  const resultat = { lignes: {}, illisibles: 0 };
  if (revue.getLastRow() < 2) return resultat;
  const valeurs = revue.getRange(1, 1, revue.getLastRow(), revue.getLastColumn()).getValues();
  const col = nom => valeurs[0].indexOf(nom);
  const c = { type: col('Type'), trigger: col('Déclencheur'), proposition: col('Proposition'), decision: col('Décision'),
    texteFinal: col('Texte final'), cle: col('Clé') };
  if (Object.values(c).some(i => i < 0)) {
    resultat.illisibles = valeurs.slice(1).filter(r => r.some(v => String(v).trim())).length;
    return resultat;
  }
  valeurs.slice(1).forEach(r => {
    const cle = String(r[c.cle]);
    if (!cle) return;
    const decision = String(r[c.decision]).trim();
    const texteFinal = String(r[c.texteFinal] || '');
    resultat.lignes[cle] = {
      trigger: String(r[c.trigger]).trim(),
      // Déjà signalée « proposition changée » : son Texte final diffère de la proposition sans
      // être une retouche, la marque doit rester.
      changee: String(r[c.type]).indexOf(MARQUE_CHANGEE) >= 0,
      proposition: String(r[c.proposition] || ''),
      decision: decision === DECISION_ADOPTER || decision === DECISION_IGNORER ? decision : '',
      texteFinal,
      // Un Texte final vidé n'est pas une retouche : la nouvelle proposition le remplit.
      retouche: !!texteNormalise_(texteFinal) &&
        texteNormalise_(texteFinal) !== texteNormalise_(r[c.proposition])
    };
  });
  return resultat;
}

function preparerRevue() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const revue = feuille_(REVUE_SHEET_NAME, REVUE_HEADER);
  const precedent = lireRevueEnCours_(revue);

  const communs = lireSnippetsCommuns_();
  const traites = lireTraites_();
  const sauvegardes = getBackupSheet_().getDataRange().getValues().slice(1);

  const bilan = { retouches: 0, decisions: 0, changees: 0 };

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
    let type = commun ? '✏️ Variante' : '🆕 Nouveau';
    let decision = '';
    let texteFinal = variantes[0].texte;
    // Ligne déjà travaillée dans la revue précédente : sa décision et son Texte final sont repris
    // tels quels, même si la proposition a changé depuis (le garant les a écrits, pas la revue).
    const avant = precedent.lignes[cle];
    if (avant) {
      delete precedent.lignes[cle];
      decision = avant.decision;
      if (avant.retouche || avant.decision) texteFinal = avant.texteFinal;
      const changee = (avant.retouche || avant.decision) &&
        (avant.changee || texteNormalise_(avant.proposition) !== texteNormalise_(variantes[0].texte));
      if (avant.retouche && !avant.changee) { type += '\n' + MARQUE_RETOUCHE; bilan.retouches++; }
      if (changee) { type += '\n' + MARQUE_CHANGEE; bilan.changees++; }
      if (avant.decision) bilan.decisions++;
    }
    return [
      type,
      commun ? commun.trigger : (g.trigger.charAt(0) === '/' ? g.trigger : '/' + g.trigger),
      commun ? commun.content : '',
      variantes[0].texte,
      variantes.length > 1 ? `${variantes[0].nb} sur ${nbTotal}` : String(nbTotal),
      autres,
      decision,
      texteFinal,
      cle,
      JSON.stringify(variantes.map(v => v.texte))
    ];
  }).sort((a, b) => parseInt(b[4], 10) - parseInt(a[4], 10) || String(a[1]).localeCompare(String(b[1])));

  // Ce qui ne se reporte pas serait perdu en silence : une ligne travaillée qui n'est plus à revoir
  // (texte commun modifié à la main, variante supprimée…), ou une revue d'un format inconnu.
  const perdues = Object.values(precedent.lignes).filter(l => l.retouche || l.decision);
  if (perdues.length || precedent.illisibles) {
    const detail = perdues.length
      ? `${perdues.length} ligne(s) retouchée(s) ou décidée(s) ne sont plus à revoir et seront effacées :\n- ` +
        perdues.map(l => l.trigger).join('\n- ')
      : `L'onglet « Revue » a été préparé par une version précédente du script : ses ${precedent.illisibles} ligne(s) ne peuvent pas être reportées.`;
    if (ui.alert('Revue en cours', `${detail}\n\nPréparer quand même la nouvelle revue ?`,
      ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  }

  revue.clear();
  // clear() garde les validations et les colonnes masquées : une revue préparée avec un autre
  // en-tête laisserait sa liste déroulante sur une colonne qui n'est plus « Décision ».
  revue.getRange(1, 1, revue.getMaxRows(), revue.getMaxColumns()).clearDataValidations();
  revue.showColumns(1, revue.getMaxColumns());
  revue.getRange(1, 1, 1, REVUE_HEADER.length).setValues([REVUE_HEADER]).setFontWeight('bold');
  revue.setFrozenRows(1);
  if (lignes.length) {
    revue.getRange(2, 1, lignes.length, REVUE_HEADER.length).setValues(lignes);
    const regle = SpreadsheetApp.newDataValidation()
      .requireValueInList([DECISION_ADOPTER, DECISION_IGNORER], true).setAllowInvalid(false).build();
    revue.getRange(2, 7, lignes.length, 1).setDataValidation(regle);
    revue.getRange(2, 1, lignes.length, REVUE_HEADER.length).setVerticalAlignment('top').setWrap(true);
  }
  [110, 110, 320, 320, 90, 280, 100, 320].forEach((l, i) => revue.setColumnWidth(i + 1, l));
  revue.getRange('H:H').setBackground('#fff8e1'); // la colonne à retoucher
  revue.hideColumns(9, 2); // clé et variantes : à l'usage d'« Appliquer les décisions »

  masquerOngletsGarant_();
  revue.showSheet();
  ss.setActiveSheet(revue);
  ui.alert('Revue prête',
    lignes.length
      ? `${lignes.length} proposition(s), les plus partagées en premier.\n\n` +
        (bilan.retouches || bilan.decisions || bilan.changees
          ? `Reprises de la revue précédente : ${bilan.retouches} retouche(s) du Texte final, ${bilan.decisions} décision(s).` +
            (bilan.changees ? ` ${bilan.changees} ligne(s) marquée(s) « ${MARQUE_CHANGEE} » : la proposition n'est plus celle sur laquelle vous aviez travaillé, relisez-les.` : '') +
            '\n\n'
          : '') +
        `Pour chacune, choisissez « ${DECISION_ADOPTER} » ou « ${DECISION_IGNORER} » dans la colonne Décision. ` +
        `« ${DECISION_ADOPTER} » enregistre la colonne Texte final, pré-remplie avec la proposition : retouchez-la si besoin.\n\nPuis : Clausier > Appliquer les décisions.`
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

  const entete = revue.getRange(1, 1, 1, REVUE_HEADER.length).getValues()[0];
  if (entete.join('|') !== REVUE_HEADER.join('|')) {
    ui.alert('Revue à refaire',
      'L\'onglet « Revue » a été préparé par une version précédente du script : ses colonnes ne ' +
      'correspondent plus. Préparez à nouveau la revue (Clausier > Préparer la revue).', ui.ButtonSet.OK);
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
      const decision = String(r[6]).trim();
      if (!decision) return;
      const trigger = String(r[1]).trim();
      const cle = String(r[8]);
      const variantes = JSON.parse(String(r[9] || '[]'));

      if (decision === DECISION_ADOPTER) {
        const texte = String(r[7] || '').trim();
        if (!texte) { bilan.ecartes.push(`${trigger} : Texte final vide`); return; }
        const commun = communs[cle];
        if (String(r[0]).indexOf('Nouveau') >= 0) {
          if (commun) { bilan.ecartes.push(`${trigger} : ajouté au Clausier Commun depuis la revue, à revoir`); return; }
          sheet.appendRow([trigger, texte]);
          communs[cle] = { ligne: sheet.getLastRow(), trigger, content: texte };
          bilan.ajoutes++;
        } else {
          if (!commun) { bilan.ecartes.push(`${trigger} : n'existe plus dans le Clausier Commun`); return; }
          // Modifié dans "Snippets" depuis la préparation : on ne remplace pas un texte que la
          // revue n'a pas montré.
          if (texteNormalise_(commun.content) !== texteNormalise_(r[2])) {
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

// ============================================================================
// STATISTIQUES D'UTILISATION (anonymes)
// ============================================================================
//
// Onglet "Statistiques", masqué : une ligne par utilisateur (Ref_User aléatoire) et par jour. Les
// colonnes fixes disent l'installation (version, taille du Clausier Personnel, articles DatAviso
// AI importés), les suivantes comptent les usages, une colonne par fonction. L'extension envoie
// les totaux du jour, que la ligne reçoit en remplacement : un envoi répété ne compte rien deux
// fois. Une fonction ajoutée à l'extension crée sa colonne au premier envoi, sans changer ce script.
// Conservation : 24 mois, purgés au plus une fois par jour au fil des envois.

const STATS_SHEET_NAME = 'Statistiques';
const STATS_SYNTHESE_HEBDO_SHEET_NAME = 'Synthèse_Hebdo';
const STATS_SYNTHESE_MOIS_SHEET_NAME = 'Synthèse_Mensuelle';
// Totaux mis en tête des synthèses : ce que le garant suit d'abord. Le détail de chaque usage
// suit dans les colonnes d'après.
const STATS_REGROUPEMENTS = [
  ['Clausier Personnel (clavier + icône jaune)', ['clavier_perso', 'aviso_perso']],
  ['Clausier Commun (clavier + icône bleue)', ['clavier_commun', 'aviso_commun']],
  ['Liens externes (SGO, SharePoint, sitesecurite, Explorateur)',
    ['lien_sgo', 'lien_sharepoint', 'aviso_sitesecurite', 'lien_explorateur']]
];
const STATS_COLONNES_FIXES = ['Ref_User', 'Date', 'Version', 'Snippets personnels', 'Articles DatAviso'];
const STATS_CONSERVATION_MOIS = 24;
// Libellés de la synthèse ; une clé absente d'ici s'affiche telle quelle.
const STATS_LIBELLES = {
  clavier_commun: 'Expansions au clavier, Clausier Commun',
  clavier_perso: 'Expansions au clavier, Clausier Personnel',
  clavier_hors_aviso: '… dont hors Aviso',
  aviso_commun: 'Aviso : icône bleue (Clausier Commun)',
  aviso_perso: 'Aviso : icône jaune (Clausier Personnel)',
  aviso_crayon: 'Aviso : crayon (modifier un snippet)',
  aviso_plus: 'Aviso : « + » (créer un snippet)',
  aviso_dataviso: 'Aviso : icône verte (DatAviso AI)',
  aviso_sitesecurite: 'Aviso : lien sitesecurite',
  aviso_corbeille: 'Aviso : corbeille',
  aviso_annuler: 'Aviso : annuler l\'effacement',
  lien_sgo: 'Lien SGO',
  lien_sharepoint: 'Lien SharePoint',
  lien_explorateur: 'Lien Explorateur',
  import_dataviso: 'Imports DatAviso AI',
  clausier_import: 'Imports du Clausier Personnel',
  clausier_export: 'Exports du Clausier Personnel',
  popup: 'Ouvertures du popup',
  parametres: 'Ouvertures des Paramètres',
  tutoriel: 'Ouvertures du tutoriel'
};

function getStatsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(STATS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(STATS_SHEET_NAME);
    sheet.appendRow(STATS_COLONNES_FIXES);
    sheet.setFrozenRows(1);
    sheet.getRange('B:C').setNumberFormat('@'); // date et version en texte, comme dans la sauvegarde
    sheet.hideSheet();
  }
  return sheet;
}

function entier_(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 1000000) : null;
}

function enregistrerStatistiques_(body) {
  const refUser = String(body.refUser || '').trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(refUser)) return { ok: false, error: 'Ref_User invalide' };
  const jours = (Array.isArray(body.jours) ? body.jours : []).slice(0, 400)
    .filter(j => j && /^\d{4}-\d{2}-\d{2}$/.test(String(j.date)));

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getStatsSheet_();
    const valeurs = sheet.getDataRange().getValues();
    const entete = valeurs[0].map(String);
    // Seules des clés de la forme attendue deviennent des colonnes : un envoi malformé ne doit
    // pas fabriquer des centaines de colonnes.
    jours.forEach(j => Object.keys(j.compteurs || {}).slice(0, 60).forEach(cle => {
      if (/^[a-z0-9_]{1,40}$/.test(cle) && entier_(j.compteurs[cle]) !== null && entete.indexOf(cle) < 0) entete.push(cle);
    }));
    if (entete.length > valeurs[0].length) {
      sheet.getRange(1, 1, 1, entete.length).setValues([entete]);
    }

    const index = {};
    for (let i = 1; i < valeurs.length; i++) index[valeurs[i][0] + '\u0000' + valeurs[i][1]] = i;

    const ajouts = [];
    let maj = 0;
    jours.forEach(j => {
      const existante = index[refUser + '\u0000' + j.date];
      // Une ligne existante garde ce que l'envoi ne redonne pas (l'état d'un jour passé, une
      // colonne qu'une version plus ancienne de l'extension ne connaît pas).
      const ligne = entete.map((_, c) => existante !== undefined ? (valeurs[existante][c] ?? '') : '');
      ligne[0] = refUser;
      ligne[1] = String(j.date);
      if (j.version !== undefined) ligne[2] = String(j.version).slice(0, 20);
      if (entier_(j.snippetsPerso) !== null) ligne[3] = entier_(j.snippetsPerso);
      if (entier_(j.articlesDataviso) !== null) ligne[4] = entier_(j.articlesDataviso);
      Object.keys(j.compteurs || {}).forEach(cle => {
        const c = entete.indexOf(cle);
        const n = entier_(j.compteurs[cle]);
        if (c >= STATS_COLONNES_FIXES.length && n !== null) ligne[c] = n;
      });
      if (existante !== undefined) {
        sheet.getRange(existante + 1, 1, 1, entete.length).setValues([ligne]);
        maj++;
      } else {
        ajouts.push(ligne);
      }
    });
    if (ajouts.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, ajouts.length, entete.length).setValues(ajouts);
    }
    purgerStatistiques_(sheet);
    return { ok: true, api: 'stats', updated: maj, added: ajouts.length };
  } finally {
    lock.releaseLock();
  }
}

// Supprime les lignes de plus de 24 mois, au plus une fois par jour (le premier envoi du jour).
function purgerStatistiques_(sheet) {
  const props = PropertiesService.getScriptProperties();
  const aujourdhui = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (props.getProperty('statsPurge') === aujourdhui) return;
  props.setProperty('statsPurge', aujourdhui);

  const limite = new Date();
  limite.setMonth(limite.getMonth() - STATS_CONSERVATION_MOIS);
  const seuil = Utilities.formatDate(limite, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const valeurs = sheet.getDataRange().getValues();
  const garder = valeurs.slice(1).filter(r => String(r[1]) >= seuil);
  if (garder.length === valeurs.length - 1) return;
  // Réécrit les lignes gardées en une fois : supprimer des milliers de lignes une à une dépasse
  // vite le temps d'exécution d'Apps Script.
  sheet.getRange(2, 1, valeurs.length - 1, valeurs[0].length).clearContent();
  if (garder.length) sheet.getRange(2, 1, garder.length, valeurs[0].length).setValues(garder);
}

// Menu « Clausier > Synthèse hebdomadaire / mensuelle » : une période par ligne, de la plus
// récente à la plus ancienne. Installations actives : extension ouverte au moins un jour de la
// période. Utilisateurs actifs : au moins une fonction utilisée. Puis les totaux de
// STATS_REGROUPEMENTS, et le détail de chaque usage.
function syntheseHebdomadaire() { syntheseStatistiques_('semaine'); }
function syntheseMensuelle() { syntheseStatistiques_('mois'); }

// "2026-11-07" -> semaine ISO (du lundi au dimanche). La clé est la date du lundi, ce qui trie
// les semaines dans l'ordre, y compris d'une année sur l'autre.
function semaineIso_(jour) {
  const p = jour.split('-').map(Number);
  const date = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  const lundi = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000);
  const dimanche = new Date(lundi.getTime() + 6 * 86400000);
  const jeudi = new Date(lundi.getTime() + 3 * 86400000); // l'année ISO est celle du jeudi
  const debutAnnee = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 1));
  const numero = Math.floor((jeudi - debutAnnee) / 86400000 / 7) + 1;
  const jm = d => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return {
    cle: lundi.toISOString().slice(0, 10),
    libelle: `${jeudi.getUTCFullYear()} S${String(numero).padStart(2, '0')} (${jm(lundi)} au ${jm(dimanche)})`
  };
}

function syntheseStatistiques_(periode) {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName(STATS_SHEET_NAME);
  if (!source || source.getLastRow() < 2) {
    ui.alert('Pas encore de statistiques',
      'Aucune statistique reçue pour l\'instant : elles arrivent avec les actualisations des utilisateurs ' +
      'dont l\'extension est en version 2.22.0 ou plus, une fois ce script redéployé.', ui.ButtonSet.OK);
    return;
  }
  const hebdo = periode === 'semaine';
  const valeurs = source.getDataRange().getValues();
  const entete = valeurs[0].map(String);
  const cles = entete.slice(STATS_COLONNES_FIXES.length);
  const groupes = {};
  valeurs.slice(1).forEach(r => {
    const jour = String(r[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return;
    const p = hebdo ? semaineIso_(jour) : { cle: jour.slice(0, 7), libelle: jour.slice(0, 7) };
    const g = groupes[p.cle] = groupes[p.cle] ||
      { libelle: p.libelle, installes: {}, actifs: {}, versions: {}, totaux: {} };
    g.installes[r[0]] = true;
    let usage = 0;
    cles.forEach((cle, i) => {
      const n = Number(r[STATS_COLONNES_FIXES.length + i]) || 0;
      g.totaux[cle] = (g.totaux[cle] || 0) + n;
      usage += n;
    });
    if (usage) g.actifs[r[0]] = true;
    // Dernière version vue pour cet utilisateur dans la période (les jours arrivent dans l'ordre
    // de leur envoi : on garde la plus récente par date).
    if (r[2] && (!g.versions[r[0]] || g.versions[r[0]].jour <= jour)) g.versions[r[0]] = { v: String(r[2]), jour };
  });

  const lignes = Object.keys(groupes).sort().reverse().map(cle => {
    const g = groupes[cle];
    const parVersion = {};
    Object.values(g.versions).forEach(x => { parVersion[x.v] = (parVersion[x.v] || 0) + 1; });
    const versions = Object.keys(parVersion).sort().reverse().map(v => `${v} : ${parVersion[v]}`).join(', ');
    return [g.libelle, Object.keys(g.installes).length, Object.keys(g.actifs).length]
      .concat(STATS_REGROUPEMENTS.map(([, cs]) => cs.reduce((t, c) => t + (g.totaux[c] || 0), 0)))
      .concat(cles.map(c => g.totaux[c] || 0))
      .concat([versions]);
  });

  const nom = hebdo ? STATS_SYNTHESE_HEBDO_SHEET_NAME : STATS_SYNTHESE_MOIS_SHEET_NAME;
  const synthese = feuille_(nom);
  synthese.clear();
  const titres = [hebdo ? 'Semaine' : 'Mois', 'Installations actives', 'Utilisateurs actifs']
    .concat(STATS_REGROUPEMENTS.map(([libelle]) => libelle))
    .concat(cles.map(c => STATS_LIBELLES[c] || c))
    .concat(['Versions (utilisateurs)']);
  synthese.getRange(1, 1, 1, titres.length).setValues([titres]).setFontWeight('bold').setWrap(true);
  synthese.setFrozenRows(1);
  synthese.setFrozenColumns(1);
  // En texte avant d'écrire : sinon le tableau lit « 2026-11 » comme une date.
  synthese.getRange('A:A').setNumberFormat('@');
  if (lignes.length) synthese.getRange(2, 1, lignes.length, titres.length).setValues(lignes);
  // Les totaux suivis d'abord, en évidence.
  synthese.getRange(1, 4, Math.max(lignes.length + 1, 1), STATS_REGROUPEMENTS.length).setBackground('#fff8e1');
  synthese.setColumnWidth(1, hebdo ? 190 : 90);
  synthese.showSheet();
  ss.setActiveSheet(synthese);
  ui.alert('Synthèse prête',
    `${lignes.length} ${hebdo ? 'semaine(s)' : 'mois'}, du plus récent au plus ancien. Les données détaillées restent dans ` +
    `l'onglet masqué « ${STATS_SHEET_NAME} », conservées ${STATS_CONSERVATION_MOIS} mois.`, ui.ButtonSet.OK);
}
