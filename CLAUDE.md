# Snippet Expander

Extension Chrome **Manifest V3** d'expansion de texte, avec une intégration métier sur
l'application **Aviso** (contrôle technique bâtiment). Deux sources de snippets :

- le **Clausier Commun** : un Google Sheets partagé, lu par l'extension (clé `snippets`) ;
- le **Clausier Personnel** : propre à chaque utilisateur, dans `chrome.storage.local` (clé
  `localSnippets`). À déclencheur égal, il l'emporte au clavier (`rebuildActiveSnippets`). Une
  copie anonyme part dans l'onglet `Local_Snippets_Backup` du même classeur (voir Apps Script).

JavaScript natif, aucune dépendance, **aucune étape de build**. Pas de `node` sur cette machine :
la vérification est manuelle dans Chrome (`chrome://extensions` > « Charger l'extension non
empaquetée », puis ⟳ après chaque modification). Il n'y a pas de suite de tests ; ne prétends
jamais avoir « testé », dis ce que tu as vérifié et comment.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | MV3. La version y est la source de vérité, à monter avec le CHANGELOG |
| `content.js` | Expansion de texte sur toute page **et** toute l'intégration Aviso, fenêtre d'édition du Clausier Personnel comprise (le plus gros fichier : ~1 150 lignes) |
| `imported-data.js` | Parseur des données « DatAviso AI » (fichier `.txt`) |
| `clausier-fichiers.js` | Import/export du Clausier Personnel en `.xlsx` et `.csv`, zip et XML écrits à la main |
| `sitesecurite-articles.js` | Table des articles ERP → URL sitesecurite.com |
| `background.js` | Service worker : synchro Sheets, sauvegarde du Clausier Personnel, ouverture du tutoriel, alarmes, vérification de MAJ GitHub |
| `options.js/html/css` | Page Paramètres : Clausier Personnel, DatAviso AI, paramètres avancés |
| `popup.js/html/css` | Popup de l'icône : lien du tutoriel, liens vers les deux clausiers, import DatAviso AI, formulaire de retour, partage |
| `tutoriel.js/html/css` | Tutoriel visuel en étapes : maquettes HTML avec les vraies icônes, pas de captures d'écran |
| `partage.js` | Lien d'installation du Store à copier ou envoyer, partagé par le popup et le tutoriel |
| `google-apps-script/Code.gs` | Mini-API côté Sheets. **Copie de référence** : le code qui tourne vit dans l'éditeur Apps Script, ce fichier ne se déploie pas tout seul |

## Invariants — à ne jamais casser

Chacun vient d'un incident réel. Les commentaires du code expliquent le pourquoi : lis-les avant
de « simplifier ».

1. **Le Google Sheets fait autorité, et l'extension n'écrit plus dans l'onglet `Snippets`.** Depuis
   la v2.18.0, le « + » crée le snippet dans le Clausier Personnel. Sa seule écriture est la
   sauvegarde anonyme, confinée à l'onglet `Local_Snippets_Backup`. `createSnippetRow` (background.js) est conservé
   mais sans appelant ; s'il est rebranché, il reste en ajout seul : jamais de suppression,
   jamais de remplacement d'un contenu non vide.
2. **`doPost` reste en ajout seul sur l'onglet `Snippets`.** Une version ancienne faisait
   `clearContents()` puis réécrivait : un POST vers un script non redéployé a réellement vidé le
   tableau (v2.15.0). Seul `sauvegarderClausier_` met à jour des lignes, et uniquement dans
   `Local_Snippets_Backup` (une ligne par couple `Ref_User` + déclencheur), jamais ailleurs.
3. **Sonder avant d'écrire.** `verifierApiAjout()` fait un GET `?probe=append`, la sauvegarde un
   GET `?probe=backup`, et le POST n'est émis que si la signature revient. Un ancien script répond un tableau — `Array.isArray` le démasque.
4. **Une synchro ne remplace jamais des snippets par un tableau vide** (`pullFromSheet`). La copie
   locale est conservée et un bandeau s'affiche dans les Paramètres. La synchro ne touche jamais
   au Clausier Personnel.
5. **Rien n'est écrasé ni effacé dans Aviso sans un clic explicite.** Toute insertion s'ajoute à
   la suite du texte existant (`appendAvisoText`), y compris le report d'un snippet créé par le
   « + » (`reporterCreationDansAviso` n'ajoute que ce qui manque, jamais de remplacement). Le
   seul effacement est la corbeille, et il s'annule (« Annuler l'effacement »). Toute écriture
   dans une cellule passe par `ecrireAvisoValeur`.
6. **Même règle de code des deux côtés.** `extractRefCode` (content.js) et `importedHeader`
   (imported-data.js) doivent calculer le code *à l'identique*. Les désaccorder casse silencieusement
   toute reconnaissance des référentiels.
7. **Aucune permission que n'utilise pas une installation depuis le Store.** La v2.18.0 a été
   refusée pour `activeTab`, demandée mais jamais appelée. `host_permissions` liste les seuls
   hôtes contactés par `fetch` ; ajouter un hôte ou une API, c'est d'abord l'ajouter au manifeste
   et à la justification « Privacy practices » (README, section 6 d).
8. **Le Clausier Personnel ne se restaure que par l'export.** Il vit dans le navigateur, une
   désinstallation l'efface. La copie anonyme du Sheets n'est **jamais relue** par l'extension :
   c'est une matière pour enrichir le Clausier Commun, pas une sauvegarde. Elle reste
   désactivable (`sauvegardeClausier`), ne transmet ni nom ni adresse (`refUser` aléatoire dans
   `storage.sync`), et ne part qu'avec la synchro (empreintes `backupEmpreintes` : seul ce qui
   a changé est envoyé, un échec est retenté). Un import ne remplace jamais un snippet existant sans accord (fenêtre
   de conflit), et n'écrit rien avant la fin.

## Intégration Aviso

Les icônes s'insèrent dans la cellule « Dispositions réalisées », dans l'ordre fixe de
`AVISO_ORDER` :

`AVISO_ADD_CLASS` (grise, « + ») **ou** `AVISO_LOCAL_CLASS` (jaune, Clausier Personnel) →
`AVISO_EDIT_CLASS` (crayon jaune) → `AVISO_ICON_CLASS` (bleue, Clausier Commun) →
`AVISO_LAW_CLASS` (sitesecurite) → `AVISO_IMPORT_CLASS` (verte, DatAviso AI)

- Le « + » et l'icône jaune occupent la même place et ne coexistent jamais : le « + » n'apparaît
  que sans snippet personnel, même si un snippet commun existe.
- L'ordre tient parce que `placerIcone` pose chaque icône en `afterend` de la plus proche
  précédente déjà présente, jamais à une position absolue : les données arrivent dans un ordre
  quelconque. Une nouvelle icône s'ajoute dans `AVISO_ORDER`, pas par un enchaînement à la main.
- La corbeille (`AVISO_CLEAR_CLASS`) est hors de cet ordre : elle flotte au bord droit, sur
  **toutes** les lignes, y compris sans code de Référentiel.
- Quand une source change (`snippets`, `localSnippets`, `importedArticles`), `retirerIconesAviso`
  retire les icônes qui en dépendent et le scan les repose : elles capturent leur snippet à la pose.
- La fenêtre d'édition (crayon, « + ») vit dans un Shadow DOM et stoppe la propagation des
  évènements clavier et souris, pour qu'Aviso n'y réagisse pas.
- Les lignes se chargent en AJAX → `MutationObserver` + `scheduleAvisoScan()` (debounce 150 ms).
  Toute icône doit donc être **idempotente** (`if (container.querySelector(...)) return;`).
- **Piège d'affichage** : le `<textarea class="verification">` et le `<div class="verification">`
  partagent le même id. Après écriture, **recopier** la valeur complète du textarea dans le div,
  ne jamais y concaténer — Aviso resynchronise déjà sur `change`, un ajout afficherait un doublon.
- Les infobulles natives ne défilent pas : prévisualisation tronquée à 700 caractères
  (`tronquerPourInfobulle`). Le texte **inséré** n'est jamais tronqué.
- Après écriture, `ajusterHauteurAviso` agrandit le champ (jamais il ne le rapetisse), plafonné
  à 60 % de la fenêtre. Un élément masqué ne se mesure pas : le textarea se réajuste au `focus`.
- **Liens d'affaire** (`scanLiensAffaire`, appelé par chaque scan) : SGO, SharePoint et
  Explorateur (`search-ms:`, Windows seulement, sur `C:\Users\` : l'Explorateur ne développe pas
  `%USERPROFILE%` dans ce protocole, essayé et abandonné en v2.20.1) à partir du numéro avant « / ». Liste : dans `td.std_links`, empilées après la loupe, avec ses classes `btn btn-primary`
  (couleurs identiques par construction), libellés en texte de 11 px. `disposerLiensListe` les
  pose hors du flux (position absolue) pour ne pas grandir la ligne, ne réserve que la largeur
  (padding-right), et les range côte à côte si la ligne est trop basse. Barre : 22 px, blanc. Barre bleue : numéro lu dans `#cur_plan_aff`, liens à gauche
  de `#metier_header_selector`, dont le parent est en flex `row-reverse` — le côté d'insertion
  suit le sens réel d'affichage. Repli après `#cur_plan_aff` si le sélecteur est absent.
  Un réglage par lien (`lienSgo`, `lienSharepoint`, `lienExplorateur`, actifs par défaut).
- **Champ « Remarque »** : un éditeur TinyMCE dans une iframe sans `src`, que Chrome n'injecte
  pas et que TinyMCE remplit par `document.write` (qui efface les listeners et donne à l'iframe
  l'URL de la page). `lierEditeurRiche` y branche depuis la page parente le listener de saisie,
  rebranché au scan, au survol et au focus. Le critère est l'**attribut** `src` absent, jamais
  l'URL du document. Ne pas ajouter `match_about_blank` : l'expansion s'y ferait deux fois.
- L'intégration est toujours active sur Aviso (le réglage « Intégration Aviso » a été retiré en
  v2.18.0) et sans effet ailleurs (`isAvisoSite`).

## Apps Script

`API_VERSION` dans `Code.gs` (v4 aujourd'hui) est la poignée de main avec l'extension. Après
**toute** modification : Déployer > Gérer les déploiements > crayon > **« Nouvelle version »**.
Choisir « Version la plus récente » laisse l'ancien code en service — c'est l'erreur classique, le
guide complet est en commentaire en tête de `Code.gs`.

Quand tu touches au contrat du POST, prévois toujours le script resté en version précédente :
**dégrader, jamais casser** (la ligne se crée sans contenu, le tableau s'ouvre quand même).

## Tutoriel

- Ouvert par `ouvrirTutorielSiNouveau` (background.js) à l'installation, et à une mise à jour si
  `tutorielVu` < `TUTORIEL_VERSION`. Marqué vu dès l'ouverture : il ne se rouvre pas s'il est fermé.
- **À chaque version destinée au Chrome Web Store, mettre le tutoriel à jour** avec ce qui change
  pour l'utilisateur (étapes, maquettes, icônes). Il n'y a pas de page de notes de mise à jour :
  pour annoncer des nouveautés à tous, on incrémente `TUTORIEL_VERSION`, après avoir demandé
  quoi mettre en avant.

## Conventions de travail

- **Demander avant d'ouvrir une PR.** Toujours. Pas d'auto-push.
- Branches : `feature/...` ou `fix/...`, en français, kebab-case.
- Messages de commit **en français**, sujet à l'impératif, corps qui explique *pourquoi* et quel
  problème observé est corrigé — pas la liste des lignes changées.
- Une fonctionnalité = version `manifest.json` + entrée CHANGELOG + README si le comportement
  visible change. Les trois ensemble, dans le même commit.
- `.DS_Store` et `dist/` sont ignorés. Ne jamais les committer.
- Code et commentaires en français, comme l'existant.

## Piège de synchronisation

**Ne pas éditer un fichier via l'interface GitHub pendant qu'une branche locale est ouverte
dessus.** La v2.17.0 a ainsi été écrite deux fois en parallèle (PR #47 en ligne, commit local) :
deux commits frères du même parent, conflit, et le risque de garder la moitié de chaque version.
En cas de divergence : comparer les arbres avec `git diff origin/main <branche>` avant de résoudre,
pour savoir lequel est un sur-ensemble de l'autre.
