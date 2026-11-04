# Snippet Expander

Extension Chrome **Manifest V3** d'expansion de texte, avec une intégration métier sur
l'application **Aviso** (contrôle technique bâtiment). Deux sources de snippets :

- le **Clausier Commun** : un Google Sheets partagé, lu par l'extension (clé `snippets`) ;
- le **Clausier Personnel** : propre à chaque utilisateur, dans `chrome.storage.local` (clé
  `localSnippets`). À déclencheur égal, il l'emporte au clavier (`rebuildActiveSnippets`).

JavaScript natif, aucune dépendance, **aucune étape de build**. Pas de `node` sur cette machine :
la vérification est manuelle dans Chrome (`chrome://extensions` > « Charger l'extension non
empaquetée », puis ⟳ après chaque modification). Il n'y a pas de suite de tests ; ne prétends
jamais avoir « testé », dis ce que tu as vérifié et comment.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | MV3. La version y est la source de vérité, à monter avec le CHANGELOG |
| `content.js` | Expansion de texte sur toute page **et** toute l'intégration Aviso, fenêtre d'édition du Clausier Personnel comprise (le plus gros fichier : 853 lignes) |
| `imported-data.js` | Parseur des données « DatAviso AI » (fichier `.txt`) |
| `clausier-fichiers.js` | Import/export du Clausier Personnel en `.xlsx` et `.csv`, zip et XML écrits à la main |
| `sitesecurite-articles.js` | Table des articles ERP → URL sitesecurite.com |
| `background.js` | Service worker : synchro Sheets, alarmes, vérification de MAJ GitHub |
| `options.js/html/css` | Page Paramètres : Clausier Personnel, DatAviso AI, paramètres avancés |
| `popup.js/html/css` | Popup de l'icône : liens vers les deux clausiers, import DatAviso AI, formulaire de retour |
| `google-apps-script/Code.gs` | Mini-API côté Sheets. **Copie de référence** : le code qui tourne vit dans l'éditeur Apps Script, ce fichier ne se déploie pas tout seul |

## Invariants — à ne jamais casser

Chacun vient d'un incident réel. Les commentaires du code expliquent le pourquoi : lis-les avant
de « simplifier ».

1. **Le Google Sheets fait autorité, et l'extension n'y écrit plus.** Depuis la v2.18.0, le « + »
   crée le snippet dans le Clausier Personnel. `createSnippetRow` (background.js) est conservé
   mais sans appelant ; s'il est rebranché, il reste en ajout seul : jamais de suppression,
   jamais de remplacement d'un contenu non vide.
2. **`doPost` reste en ajout seul.** Une version ancienne faisait `clearContents()` puis
   réécrivait : un POST vers un script non redéployé a réellement vidé le tableau (v2.15.0).
3. **Sonder avant d'écrire.** `verifierApiAjout()` fait un GET `?probe=append` et n'émet le POST
   que si la signature revient. Un ancien script répond un tableau — `Array.isArray` le démasque.
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
8. **Le Clausier Personnel ne vit que dans le navigateur.** Une désinstallation l'efface : l'export
   est sa seule sauvegarde. Un import ne remplace jamais un snippet existant sans accord (fenêtre
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
  Explorateur (`search-ms:`, Windows seulement, sur `C:\` : l'Explorateur ne développe pas
  `%USERPROFILE%` dans ce protocole, essayé et abandonné en v2.20.1) à partir du numéro avant « / ». Liste : dans `td.std_links`, empilées après la loupe ; barre : 22 px. Barre bleue : numéro lu dans `#cur_plan_aff`, liens à gauche
  de `#metier_header_selector`, dont le parent est en flex `row-reverse` — le côté d'insertion
  suit le sens réel d'affichage. Repli après `#cur_plan_aff` si le sélecteur est absent.
  Un réglage par lien (`lienSgo`, `lienSharepoint`, `lienExplorateur`, actifs par défaut).
- L'intégration est toujours active sur Aviso (le réglage « Intégration Aviso » a été retiré en
  v2.18.0) et sans effet ailleurs (`isAvisoSite`).

## Apps Script

`API_VERSION` dans `Code.gs` (v3 aujourd'hui) est la poignée de main avec l'extension. Après
**toute** modification : Déployer > Gérer les déploiements > crayon > **« Nouvelle version »**.
Choisir « Version la plus récente » laisse l'ancien code en service — c'est l'erreur classique, le
guide complet est en commentaire en tête de `Code.gs`.

Quand tu touches au contrat du POST, prévois toujours le script resté en version précédente :
**dégrader, jamais casser** (la ligne se crée sans contenu, le tableau s'ouvre quand même).

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
