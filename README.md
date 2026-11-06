# Snippet Expander — extension Chrome gratuite

Remplace automatiquement un texte court (ex: `;sig`) par un texte prédéfini, dans n'importe quel champ de texte du navigateur — **100% gratuit**. Les snippets viennent de deux sources : le **Clausier Commun**, un tableau Google Sheets partagé que l'extension lit sans jamais le modifier, et le **Clausier Personnel**, propre à chaque utilisateur et enregistré dans son navigateur.

## 1. Installer l'extension dans Chrome

1. Ouvrez `chrome://extensions`
2. Activez le **Mode développeur** (en haut à droite)
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `snippet-expander` (celui qui contient `manifest.json`)
5. L'icône de l'extension apparaît dans la barre d'outils — **un clic dessus ouvre un petit menu** (voir section 2)
6. À la première installation, la page Options s'ouvre automatiquement avec une bannière 📌 vous invitant à épingler l'extension (clic sur le puzzle 🧩 en haut du navigateur, puis sur l'épingle à côté de Snippet Expander) pour l'avoir toujours sous la main

## 2. Utiliser l'extension

- À l'installation, un **tutoriel** visuel s'ouvre dans un onglet ; le lien **"🎓 Tutoriel"** en haut du popup permet de le revoir.
- Cliquez sur l'icône de l'extension pour ouvrir le petit menu ("popup") : **"📒 Modifier le Clausier Personnel"** (ouvre la page Paramètres sur cette section), **"📄 Consulter le Clausier Commun"** (ouvre le Google Sheets), l'import **DatAviso AI**, un lien **"✉️ Donner mon avis"** vers le formulaire de retour, **"🤝 Partager avec mes collègues"** (copie le lien de la fiche du Chrome Web Store, ou prépare un e-mail qui le contient), et le lien **"⚙️ Paramètres"**.
- Un snippet a un **déclencheur** (ex: `;sig`, `/adresse`) et un **contenu**.
- Tapez le déclencheur dans n'importe quel champ (Gmail, formulaires web, réseaux sociaux, contenteditable, champ « Remarque » d'Aviso...) : après une courte temporisation (1 seconde par défaut, réglable), il se remplace par le contenu — les sauts de ligne et retours à la ligne sont respectés.
- **Deux clausiers** : à déclencheur égal, le snippet du **Clausier Personnel l'emporte** sur celui du Clausier Commun (voir section 2 ter).
- Placeholders disponibles : `{date}`, `{time}`, `{cursor}` (repositionne le curseur après expansion).
- **Clausier Commun en lecture seule** : ses snippets se créent, se modifient et se suppriment dans le tableau Google Sheets partagé (bouton "📄 Consulter le Clausier Commun" du popup ou de la page Paramètres).
- **Mise à jour du Clausier Commun** : il se met à jour automatiquement en arrière-plan (fréquence réglable, toutes les heures par défaut — voir Paramètres avancés). Pour forcer une actualisation immédiate : "🔄 Forcer l'actualisation du Clausier Commun" en haut de la page Paramètres.
- **Zone de test** : sur la page Paramètres, un champ de texte libre permet de taper un déclencheur existant et de voir l'expansion se produire en direct — pratique pour vérifier que tout fonctionne sans avoir à ouvrir un autre site.
- **Intégration Aviso** : sur l'application Aviso, des icônes apparaissent automatiquement à côté de "Dispositions réalisées", selon le code du "Référentiel" de la ligne (ex: "GN 4"). De gauche à droite :
  - l'icône **jaune** **ajoute** le contenu du snippet du Clausier Personnel, et l'affiche au survol pour le relire avant de cliquer. Le **crayon jaune** à sa droite ouvre une fenêtre d'édition par-dessus la page pour le modifier ou le supprimer, sans quitter Aviso ;
  - à leur place, sur une ligne **sans** snippet personnel, l'icône **"+"** (grise) crée ce snippet : la fenêtre d'édition s'ouvre avec un déclencheur qui reprend le Référentiel (`/GN13`) et un contenu prérempli avec **le texte déjà saisi dans "Dispositions réalisées"**. Une fois le snippet enregistré, il est **ajouté aussitôt à la cellule**, sans doublon : tout le snippet si la cellule était vide, ou seulement la suite si vous avez complété le texte prérempli (rien si vous l'avez réécrit). Le "+" laisse ensuite la place à l'icône jaune et au crayon ;
  - l'icône **bleue** **ajoute** le contenu du snippet du Clausier Commun, avec le même aperçu au survol. Elle n'apparaît que si le code correspond au déclencheur d'un snippet du Google Sheets ;
  - l'icône **sitesecurite.com** ouvre dans un nouvel onglet l'article du règlement de sécurité ERP correspondant, ancré directement sur l'article visé. Elle s'affiche dès que le code est un article ERP connu (voir `sitesecurite-articles.js`), **y compris sur les lignes sans snippet** — consulter le texte reste utile quand il n'y a rien à insérer ;
  - l'icône **verte** ajoute les données **DatAviso AI** de cet article (voir ci-dessous), et affiche au survol le texte qui sera inséré. Elle n'apparaît que si un article importé porte le même code.

  Au bord droit de la cellule, une **corbeille** (visible dès que la cellule contient du texte, sur toutes les lignes) efface son contenu d'un clic. Elle devient aussitôt un bouton **"Annuler l'effacement"**, qui remet le texte tant que la cellule est restée vide.

  Toute insertion s'ajoute à la suite du texte existant, sans jamais l'écraser, et le champ s'agrandit pour montrer tout le texte inséré (jusqu'à 60 % de la hauteur de la fenêtre, avec défilement au-delà). L'intégration est toujours active sur Aviso et sans effet sur les autres sites.

- **Liens vers l'affaire** : à partir du numéro d'affaire (`29462057`, ou 7 chiffres pour les plus anciennes), trois petites icônes, « SGO », « ShP » et « C:\ », ouvrent :
  - **SGO** : la fiche de l'affaire, dans un nouvel onglet ;
  - **SharePoint** : une recherche du numéro, dans un nouvel onglet ;
  - **l'Explorateur Windows** : une recherche des fichiers et dossiers de `C:\Users\` (qui contient le dossier « Bureau Veritas » de chacun) contenant le numéro (Windows uniquement, l'icône n'apparaît pas sur Mac). Chrome demande d'abord « Ouvrir Explorateur Windows ? », autorisable une fois pour toutes.

  Elles apparaissent sur la liste **Plans Affaires**, empilées à droite de la loupe de chaque ligne et dans le même style qu'elle (blanc sur fond bleu), et dans la **barre bleue** d'une affaire ouverte, à gauche du sélecteur « BTS ». Chacune se désactive dans Paramètres avancés > Liens vers l'affaire.

## 2 bis. DatAviso AI — importer des données de dossier par article

Indépendamment des snippets, l'extension peut mémoriser des **données propres à un dossier**, article par article, pour les réinjecter dans Aviso. Ces données et les zones qui les gèrent sont regroupées sous le nom **DatAviso AI**.

**Format attendu** — un bloc par article, séparés par une ligne vide :

```
GN 12 — Justification des classements de comportement au feu
  Exigence      : Les constructeurs, propriétaires... doivent être en mesure de justifier [...]
  Travaux prévus: Néant — le dossier ne décrit aucun travaux relevant de cet article.
  Source        : —
  Statut        : Non renseigné
```

- La **ligne d'en-tête** donne le code de l'article (`GN 12` → `GN12`, la même normalisation que le Référentiel Aviso) et son titre. Le séparateur est un tiret, simple `-`, demi-cadratin `–` ou cadratin `—`. Les codes à suffixe sont acceptés (`CH 12-1` → `CH12-1`), et distincts de l'article de base (`CH 12`).
- **Les référentiels sans code d'article sont acceptés** : les missions solidité (trames LP et LE) listent des rubriques nommées plutôt que des articles. L'en-tête est alors le libellé seul, sur sa propre ligne, et le code en est déduit comme le fait Aviso, texte avant le premier `" - "` sinon le libellé entier, espaces retirés et majuscules :

```
Reconnaissance des sols
  Dispositions prévues : Assise déterminée selon le rapport de sol G2 AVP/PRO [...]
  Source               : LOT 02 p. 41 et p. 42
  Observation          : le rapport de sol n'est pas dans les pièces transmises.
```

- Un en-tête se reconnaît **à sa position** : colonne 0, quand les champs sont indentés. Un fichier d'import ne doit donc contenir **que des blocs**, sans bandeau ni titre de section, faute de quoi ces lignes seraient prises pour des en-têtes.
- Les **lignes de champ** sont de la forme `Libellé : valeur`. Les libellés ne sont pas figés dans le code : toute rubrique est reconnue, jusqu'à 80 caractères et sans point. Une valeur peut contenir des `:` (la découpe se fait au premier), et se poursuivre sur les lignes suivantes.
- **Aucune ligne n'est perdue** : une ligne qui ne ressemble pas à `Libellé : valeur` est rattachée au champ précédent, ou conservée telle quelle si elle ouvre le bloc. Tout le texte situé sous l'en-tête se retrouve donc dans l'article.

**Importer** : cliquez sur l'icône de l'extension, puis "📄 Importer un fichier .txt" dans "📥 DatAviso AI". Chaque import **remplace entièrement** les données précédentes. Le bouton "🗑️ Effacer les données DatAviso AI", juste en dessous, vide tout après confirmation.

**Consulter / importer / supprimer** : page Paramètres, carte "📥 DatAviso AI" — mêmes boutons d'import (.txt) et d'effacement que dans le popup. Le tableau est replié par défaut ("Afficher les articles"), et s'ouvre de lui-même dès qu'une recherche est saisie. Aperçu ligne par ligne, suppression article par article ou en bloc.

**Utiliser dans Aviso** : sur une ligne dont le Référentiel correspond à un article importé, une icône verte apparaît. La survoler affiche **le texte exact qui sera inséré** (tronqué à 700 caractères dans l'infobulle uniquement) ; un clic ajoute **tous ses champs** dans "Dispositions réalisées", à la suite du texte existant et **sans le titre de l'article** (la ligne Aviso porte déjà son Référentiel).

## 2 ter. Clausier Personnel — vos propres snippets

À côté du Clausier Commun partagé, chaque utilisateur peut tenir ses **propres snippets**, gérés depuis la carte "📒 Clausier Personnel" de la page Paramètres (ou le bouton "Modifier le Clausier Personnel" du popup) :

- **Ajouter** avec le formulaire toujours visible en haut de la carte. **Modifier, supprimer** dans la liste, repliée par défaut ("Afficher les snippets") et ouverte d'elle-même dès qu'une recherche est saisie ; ou depuis Aviso (bouton "+" et crayon jaune, voir section 2).
- **Tout supprimer** : bouton en bas de la liste, après un message d'alerte qui rappelle que la suppression est définitive et invite à exporter d'abord.
- **Priorité** : au clavier, un snippet personnel remplace celui du Clausier Commun qui porte le même déclencheur. Sur Aviso, les deux restent disponibles, l'icône jaune pour le personnel, la bleue pour le commun.
- **Importer** un fichier `.xlsx` ou `.csv` : une ligne par snippet, colonnes `declencheur` et `contenu`, dans n'importe quel ordre. Des **modèles vierges** dans les deux formats se téléchargent depuis la même carte. Le `/` initial est ajouté s'il manque (`GN 4` devient `/GN 4`), et les lignes sans déclencheur ou sans contenu sont ignorées. Si un déclencheur existe déjà avec un autre contenu, l'import affiche les deux et demande **Remplacer**, **Ignorer**, **Remplacer tout**, **Ignorer tout** ou **Annuler l'import** — rien n'est enregistré avant la fin. Le format `.xls` (Excel 97-2003) n'est pas lu : enregistrez le fichier en `.xlsx` ou `.csv`.
- **Exporter** en `.xlsx` ou `.csv` (séparateur `;`, UTF-8, s'ouvre directement dans Excel).

⚠️ Le Clausier Personnel est enregistré **dans ce navigateur** (`chrome.storage.local`). Il est conservé lors des mises à jour de l'extension, mais **effacé si on la désinstalle**, et il ne se retrouve pas sur un autre ordinateur : exportez-le régulièrement, et importez l'export pour le transporter.

**Sauvegarde anonyme** (depuis la v2.21.0) : à chaque actualisation du Clausier Commun, les snippets personnels ajoutés ou modifiés sont copiés dans l'onglet `Local_Snippets_Backup` du Google Sheets (`trigger | content | Ref_User | Date`), pour enrichir le Clausier Commun. `Ref_User` est un identifiant aléatoire, sans nom ni adresse ; une seule ligne par utilisateur et par déclencheur, la dernière version remplaçant la précédente. Cette copie ne sert pas à restaurer : l'extension ne la relit jamais. Désactivable dans Paramètres avancés.

## 3. Partage en temps réel avec une équipe (Google Sheets, gratuit)

À l'installation, l'extension importe automatiquement les snippets partagés par défaut (URL Google Sheets pré-configurée dans le code, synchro auto activée toutes les heures). Il n'y a pas d'interface pour changer cette URL depuis l'extension : pour utiliser votre propre Google Sheet, modifiez la constante `DEFAULT_WEBAPP_URL` dans `background.js` (voir étape c ci-dessous).

### a. Créer le Google Sheet
1. Créez un nouveau Google Sheet (sheets.new)
2. Renommez le premier onglet en `Snippets`
3. Ajoutez la ligne d'en-tête : `trigger | content | folder`

### b. Déployer le script gratuit (Google Apps Script)
1. Dans le Sheet : **Extensions > Apps Script**
2. Collez le contenu de `google-apps-script/Code.gs`
3. **Déployer > Nouveau déploiement > Application Web**
4. "Exécuter en tant que" : **Moi** — "Qui a accès" : **Tout le monde**
5. Déployez, autorisez les permissions, copiez l'**URL de l'application Web** (`.../exec`)

### c. Configurer l'extension
1. Ouvrez **Paramètres avancés > Tableau de référence** et renseignez les deux adresses :
   - **Adresse du tableau Google Sheets** : l'URL du Sheet lui-même (`https://docs.google.com/spreadsheets/d/.../edit`), utilisée pour l'ouvrir depuis l'extension
   - **Adresse de l'application Web** : l'URL `.../exec` obtenue à l'étape b, celle qui sert réellement les données

   (Les valeurs par défaut restent celles définies dans le code, `DEFAULT_WEBAPP_URL` et `DEFAULT_SHEET_URL` ; ces champs permettent d'en changer sans toucher aux fichiers.)
2. Ajustez si besoin la fréquence d'actualisation automatique dans **Paramètres avancés > Fréquence d'actualisation des données** (optionnel, toutes les heures par défaut)

⚠️ **Après toute modification de `Code.gs`**, redéployez : **Déployer > Gérer les déploiements > (crayon) > Version : "Nouvelle version" > Déployer**. Sans nouvelle version, l'URL `/exec` continue de servir l'ancien code.

Le code d'écriture de l'extension s'en protège : avant toute écriture, il interroge le script (`?probe=append` pour l'ajout de ligne, `?probe=backup` pour la sauvegarde du Clausier Personnel) pour vérifier qu'il gère l'ajout de ligne, et n'envoie rien si la réponse ne le confirme pas. Cette vérification existe parce qu'une version antérieure de `Code.gs` réécrivait le tableau entier sur n'importe quel POST : un client récent parlant à un script ancien effaçait tous les snippets.

### d. Mise à jour des données
L'extension lit le Sheet à chaque récupération ("🔄 Forcer l'actualisation du Clausier Commun" de la page Paramètres, ou synchro automatique en arrière-plan) : les snippets du Clausier Commun sont alors **entièrement remplacés** par le contenu actuel du Sheet. Le Clausier Personnel n'est jamais touché par cette synchro.

**Depuis la v2.18.0, l'extension n'écrit plus dans l'onglet `Snippets`** : le bouton "+" d'Aviso crée le snippet dans le Clausier Personnel. Sa seule écriture est la sauvegarde anonyme dans l'onglet `Local_Snippets_Backup` (section 2 ter), créé par le script au premier envoi. Le chemin d'ajout de ligne (`createSnippetRow` dans `background.js`, `doPost` dans `Code.gs`) est conservé, avec ses garde-fous, mais n'est plus appelé. Il ne supprime jamais une ligne existante et ne complète une ligne déjà présente que si sa cellule de contenu est vide.

**Garde-fou** : si le tableau distant revient vide alors que des snippets sont enregistrés localement, la synchro est refusée et la copie locale conservée — un bandeau d'alerte s'affiche alors dans la page Paramètres. Un tableau vidé par accident ne fait donc pas disparaître la dernière copie des snippets. Pour vider délibérément le tableau, supprimez d'abord les snippets locaux (ou réinstallez l'extension).

Pour ajouter, modifier ou supprimer un snippet du Clausier Commun : faites-le directement dans le Google Sheet (lien "📄 Consulter le Clausier Commun" du popup ou de la page Paramètres), puis forcez l'actualisation pour récupérer le résultat sans attendre la synchro automatique.

## 4. Paramètres avancés

Accessibles via le bouton "⚙️ Paramètres avancés" en bas de la page Options :
- **Fréquence d'actualisation des données** : intervalle entre deux récupérations automatiques depuis le Google Sheet (minutes, 60 par défaut)
- **Liens vers l'affaire** : une case par lien (SGO, SharePoint, Explorateur Windows), tous activés par défaut
- **Temporisation avant expansion** : délai (ms) après la fin de la frappe avant remplacement (évite qu'un mot plus long contenant un déclencheur ne s'expanse par erreur)
- **Mise à jour de l'extension** : voir section suivante

## 5. Mettre l'extension sur GitHub

### a. Créer le dépôt
1. Sur [github.com](https://github.com), créez un compte si nécessaire (gratuit)
2. Cliquez sur **New repository**, donnez-lui un nom (ex: `snippet-expander`), laissez-le **Public** (nécessaire pour que l'extension puisse lire les fichiers "raw" gratuitement) ou **Privé** si vous avez un compte payant, puis **Create repository**

### b. Pousser le code
Un dépôt Git a déjà été initialisé localement dans le dossier fourni. Depuis un terminal, dans le dossier `snippet-expander` :

```bash
git remote add origin https://github.com/VOTRE-UTILISATEUR/snippet-expander.git
git branch -M main
git push -u origin main
```

(Remplacez l'URL par celle de votre dépôt. Git vous demandera de vous authentifier — utilisez un token d'accès personnel GitHub si le mot de passe classique est refusé : **Settings > Developer settings > Personal access tokens**.)

### c. Utiliser GitHub comme source de mise à jour (mode développeur uniquement)
Cette section ne s'applique que si l'extension reste chargée en **mode développeur** ("non empaquetée"). Si vous l'avez publiée sur le Chrome Web Store (voir section 6), ignorez-la : Chrome gère les mises à jour tout seul et ce bloc de paramètres est automatiquement masqué dans la page Options.

L'URL du dépôt (`DEFAULT_GITHUB_URL`, dans `background.js` et `options.js`) est fixée dans le code — il n'y a pas de champ à renseigner dans l'interface. Si vous forkez ce dépôt, remplacez cette constante par l'URL raw du vôtre avant de charger l'extension, par exemple :
`https://raw.githubusercontent.com/VOTRE-UTILISATEUR/snippet-expander/main`

Dans Options > Paramètres avancés > "Mise à jour de l'extension (mode développeur)" :
1. **Optionnel mais recommandé** : renseignez le chemin absolu du dossier contenant l'extension dans "Dossier local de l'extension" (ex : `/Users/vous/snippet-expander`) — Chrome ne permet pas à une extension de connaître ce chemin automatiquement, ce champ le mémorise une bonne fois pour toutes pour générer un lien direct lors des prochaines mises à jour
2. Cochez "Vérifier automatiquement les mises à jour" si souhaité (s'enregistre automatiquement), ou cliquez sur "Vérifier une mise à jour maintenant"
3. L'extension compare le numéro de version de `manifest.json` sur GitHub avec la version installée

⚠️ **Limite technique importante** : une extension chargée en mode développeur ne peut pas se ré-écrire elle-même — Chrome ne l'autorise pas, pour des raisons de sécurité. Quand une nouvelle version est détectée (badge rouge sur l'icône), l'extension affiche une **marche à suivre détaillée avec liens cliquables** (dans la bannière en haut de la page Options, ou dans "Paramètres avancés > Mise à jour de l'extension") :
1. Cliquez sur le lien **"⬇️ Télécharger le zip de la version..."** — le téléchargement démarre directement
2. Décompressez-le et remplacez les fichiers dans **le dossier de l'extension** — un lien direct est affiché si vous avez renseigné son chemin à l'étape précédente, sinon un rappel générique s'affiche à la place (ne créez pas un nouveau dossier)
3. Cliquez sur le lien **"chrome://extensions"** affiché dans la liste (ouvre directement la page)
4. Cliquez sur l'icône **Actualiser** ⟳ de la carte "Snippet Expander"

Comme `chrome.storage` est lié à l'identifiant de l'extension (dérivé du chemin du dossier), **vos snippets et paramètres sont automatiquement conservés** tant que vous réutilisez le même dossier — aucune perte de données.

## 6. Publier sur le Chrome Web Store

Une fois publiée, l'extension se met à jour **automatiquement et silencieusement** — Chrome vérifie et installe les nouvelles versions tout seul, comme pour n'importe quelle extension du Store. La page Options détecte ce mode d'installation (`chrome.management.getSelf()`) et masque alors tout le bloc "mise à jour manuelle via GitHub" décrit ci-dessus, qui ne concerne que le mode développeur.

### a. Créer un compte développeur Chrome Web Store
1. Rendez-vous sur [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
2. Connectez-vous avec un compte Google, payez les frais d'inscription unique de **5 $ US**

### b. Préparer le package
1. Incrémentez `version` dans `manifest.json` si besoin
2. Depuis le dossier `snippet-expander` (celui qui contient `manifest.json`), créez un zip du contenu du dossier (**pas** du dossier lui-même) :
   ```bash
   zip -r snippet-expander.zip . -x ".git/*" -x ".DS_Store" -x "*.md"
   ```

### c. Créer la fiche sur le Developer Dashboard
1. **New Item** > uploadez `snippet-expander.zip`
2. Renseignez : description courte/longue, catégorie ("Outils de productivité"), langue
3. Icônes déjà incluses dans `icons/` (16/32/48/128px) — fournissez en plus une image promo 440×280 (obligatoire) et idéalement 1400×560 (facultative)
4. Ajoutez 1 à 5 captures d'écran de la page Options et d'un exemple d'expansion en action

### d. Déclarer les pratiques de confidentialité (obligatoire)
Dans l'onglet **"Privacy practices"** du dashboard :
- **Chaque permission est à justifier** ; le Store refuse toute permission demandée mais non utilisée (refus « Purple Potassium » en v2.18.0, pour `activeTab`). Justifications à reprendre :
  - **Scripts de contenu sur `<all_urls>`** : détecter la frappe d'un déclencheur et le remplacer par son texte dans n'importe quel champ, sur n'importe quel site ; intégration Aviso
  - **`host_permissions`** (`script.google.com`, `script.googleusercontent.com`, `raw.githubusercontent.com`) : lire le Clausier Commun depuis le script Apps Script (qui redirige sa réponse vers `googleusercontent.com`), y envoyer la sauvegarde anonyme du Clausier Personnel, et vérifier les mises à jour sur GitHub en mode développeur
  - **`storage`** : enregistrer les snippets, les réglages et les données DatAviso AI
  - **`unlimitedStorage`** : le Clausier Personnel et les données DatAviso AI, conservés dans le navigateur, peuvent dépasser la limite de 10 Mo de `chrome.storage.local`
  - **`alarms`** : actualiser périodiquement le Clausier Commun (toutes les heures par défaut)
- **Avant chaque soumission**, vérifier que toute nouvelle permission est réellement utilisée par une installation depuis le Store, pas seulement en mode développeur
- **Usage des données** : l'extension lit du texte dans les champs des pages visitées (fonctionnalité cœur), sans jamais l'envoyer, et récupère vos snippets depuis l'URL Google Sheets que *vous* configurez. La seule donnée envoyée est la **copie anonyme du Clausier Personnel** (déclencheur, contenu, identifiant aléatoire, date) vers ce même Google Sheets ; elle est désactivable. À déclarer dans le formulaire comme « contenu généré par l'utilisateur » transmis à l'éditeur, non vendu ni utilisé à d'autres fins que l'amélioration du Clausier Commun
- Fournissez une **URL de politique de confidentialité** (une simple page expliquant les points ci-dessus suffit ; ce README peut servir de base)
- Cochez la case de certification de conformité au programme développeur

### e. Soumettre pour examen
1. **Submit for review**
2. Le délai d'examen est généralement de quelques heures à quelques jours pour une première soumission
3. Une fois approuvée, l'extension est disponible publiquement (ou en accès restreint si vous choisissez une visibilité "non répertoriée"/"privée" pour un usage interne à une équipe)

## Structure du projet

```
snippet-expander/
├── manifest.json          # Configuration de l'extension (Manifest V3)
├── background.js          # Récupération Google Sheets, sauvegarde du Clausier Personnel, tutoriel, alarmes, MAJ GitHub
├── content.js              # Détection, temporisation et remplacement du texte + intégration Aviso
├── sitesecurite-articles.js # Table code d'article ERP -> page sitesecurite.com (générée, cf. en-tête)
├── imported-data.js         # Analyse du texte importé (données de dossier par article)
├── clausier-fichiers.js     # Import/export du Clausier Personnel (.xlsx, .csv), sans dépendance
├── popup.html/css/js       # Popup de l'icône (barre d'outils) : clausiers, DatAviso AI, avis, Paramètres
├── tutoriel.html/css/js    # Tutoriel visuel, ouvert à l'installation et depuis le popup
├── partage.js              # Lien d'installation à partager (popup et tutoriel)
├── options.html/css/js     # Page Paramètres : Clausier Personnel, DatAviso AI, paramètres avancés
├── icons/                  # Icônes de l'extension
├── CHANGELOG.md             # Historique des versions
└── google-apps-script/
    └── Code.gs               # Script à déployer sur Google Sheets (backend gratuit)
```
