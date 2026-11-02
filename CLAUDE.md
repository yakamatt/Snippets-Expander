# Snippet Expander

Extension Chrome **Manifest V3** d'expansion de texte, adossée à un Google Sheets, avec une
intégration métier sur l'application **Aviso** (contrôle technique bâtiment).

JavaScript natif, aucune dépendance, **aucune étape de build**. Pas de `node` sur cette machine :
la vérification est manuelle dans Chrome (`chrome://extensions` > « Charger l'extension non
empaquetée », puis ⟳ après chaque modification). Il n'y a pas de suite de tests ; ne prétends
jamais avoir « testé », dis ce que tu as vérifié et comment.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | MV3. La version y est la source de vérité, à monter avec le CHANGELOG |
| `content.js` | Expansion de texte sur toute page **et** toute l'intégration Aviso |
| `imported-data.js` | Parseur des données « DatAviso » (texte collé ou `.txt`) |
| `sitesecurite-articles.js` | Table des articles ERP → URL sitesecurite.com |
| `background.js` | Service worker : synchro Sheets, alarmes, vérification de MAJ GitHub |
| `options.js/html/css` | Page Paramètres (le plus gros fichier : 572 lignes) |
| `popup.js/html/css` | Popup de l'icône : import DatAviso, réglages rapides |
| `google-apps-script/Code.gs` | Mini-API côté Sheets. **Copie de référence** : le code qui tourne vit dans l'éditeur Apps Script, ce fichier ne se déploie pas tout seul |

## Invariants — à ne jamais casser

Chacun vient d'un incident réel. Les commentaires du code expliquent le pourquoi : lis-les avant
de « simplifier ».

1. **Le Google Sheets fait autorité.** L'extension lit. La seule écriture est l'ajout d'une ligne
   par le bouton « + ». Jamais de suppression, jamais de remplacement d'un contenu non vide.
2. **`doPost` reste en ajout seul.** Une version ancienne faisait `clearContents()` puis
   réécrivait : un POST vers un script non redéployé a réellement vidé le tableau (v2.15.0).
3. **Sonder avant d'écrire.** `verifierApiAjout()` fait un GET `?probe=append` et n'émet le POST
   que si la signature revient. Un ancien script répond un tableau — `Array.isArray` le démasque.
4. **Une synchro ne remplace jamais des snippets par un tableau vide** (`pullFromSheet`). La copie
   locale est conservée et un bandeau s'affiche dans les Paramètres.
5. **Rien n'est écrasé dans Aviso.** Toute insertion s'ajoute à la suite du texte existant
   (`appendAvisoText`).
6. **Même règle de code des deux côtés.** `extractRefCode` (content.js) et `importedHeader`
   (imported-data.js) doivent calculer le code *à l'identique*. Les désaccorder casse silencieusement
   toute reconnaissance des référentiels.

## Intégration Aviso

Quatre icônes s'insèrent dans la cellule « Dispositions réalisées », dans cet ordre fixe :

`AVISO_ICON_CLASS` (bleue, snippet) → `AVISO_LAW_CLASS` (sitesecurite) →
`AVISO_IMPORT_CLASS` (verte, DatAviso) → `AVISO_ADD_CLASS` (grise, « + »)

- L'ordre tient parce que chaque icône se place en `afterend` de la précédente existante, jamais
  à une position absolue : les snippets peuvent arriver après le premier scan.
- Les lignes se chargent en AJAX → `MutationObserver` + `scheduleAvisoScan()` (debounce 150 ms).
  Toute icône doit donc être **idempotente** (`if (container.querySelector(...)) return;`).
- **Piège d'affichage** : le `<textarea class="verification">` et le `<div class="verification">`
  partagent le même id. Après écriture, **recopier** la valeur complète du textarea dans le div,
  ne jamais y concaténer — Aviso resynchronise déjà sur `change`, un ajout afficherait un doublon.
- Les infobulles natives ne défilent pas : prévisualisation tronquée à 700 caractères
  (`tronquerPourInfobulle`). Le texte **inséré** n'est jamais tronqué.
- Tout est commandé par le réglage « Intégration Aviso » et sans effet ailleurs.

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
