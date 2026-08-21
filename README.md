# Snippet Expander — extension Chrome gratuite

Remplace automatiquement un texte court (ex: `;sig`) par un texte prédéfini, dans n'importe quel champ de texte du navigateur. Les snippets sont gérés dans un tableau Google Sheets partagé et l'extension les affiche en **lecture seule** — **100% gratuit**.

## 1. Installer l'extension dans Chrome

1. Ouvrez `chrome://extensions`
2. Activez le **Mode développeur** (en haut à droite)
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `snippet-expander` (celui qui contient `manifest.json`)
5. L'icône de l'extension apparaît dans la barre d'outils — **un clic dessus ouvre un petit menu** avec un bouton "Actualiser les données" et un lien vers les paramètres complets
6. À la première installation, la page Options s'ouvre automatiquement avec une bannière 📌 vous invitant à épingler l'extension (clic sur le puzzle 🧩 en haut du navigateur, puis sur l'épingle à côté de Snippet Expander) pour l'avoir toujours sous la main

## 2. Utiliser l'extension

- Cliquez sur l'icône de l'extension pour ouvrir le petit menu ("popup"), avec un bouton **"🔄 Actualiser les données"** et un lien **"⚙️ Paramètres"** vers la page complète (liste des snippets, filtres, réglages avancés).
- Un snippet a un **déclencheur** (ex: `;sig`, `/adresse`), un **contenu** et un **dossier** optionnel.
- Tapez le déclencheur dans n'importe quel champ (Gmail, formulaires web, réseaux sociaux, contenteditable...) : après une courte temporisation (1 seconde par défaut, réglable), il se remplace par le contenu — les sauts de ligne et retours à la ligne sont respectés.
- Placeholders disponibles : `{date}`, `{time}`, `{cursor}` (repositionne le curseur après expansion).
- **Lecture seule** : les snippets ne se créent, se modifient ou se suppriment plus depuis l'extension. Toute la gestion se fait directement dans le tableau Google Sheets partagé (bouton "📄 Ouvrir le tableau Google Sheets" en haut de la page Options).
- **Mise à jour des données** : les données se mettent à jour automatiquement en arrière-plan (fréquence réglable, toutes les heures par défaut — voir Paramètres avancés). Pour forcer une actualisation immédiate : bouton "🔄 Actualiser les données" dans le popup de l'icône, ou "🔄 Forcer l'actualisation des données depuis le tableau Google Sheets" en haut de la page Options.
- **Dossiers** : les snippets sont groupés par dossier (colonne `folder` du Sheet) pour la navigation ; utilisez le filtre en haut de la liste pour n'afficher qu'un dossier, ou la recherche pour filtrer par texte.
- **Zone de test** : sur la page Options, un champ de texte libre permet de taper un déclencheur existant et de voir l'expansion se produire en direct — pratique pour vérifier que tout fonctionne sans avoir à ouvrir un autre site.
- **Intégration Aviso** : sur l'application Aviso, des icônes apparaissent automatiquement à côté de "Dispositions réalisées", selon le code du "Référentiel" de la ligne (ex: "GN 4") :
  - l'icône **Snippet Expander** **ajoute** le contenu du snippet à la suite du texte déjà saisi, sans jamais l'écraser. Elle n'apparaît que si le code correspond au déclencheur d'un snippet ;
  - l'icône **sitesecurite.com** ouvre dans un nouvel onglet l'article du règlement de sécurité ERP correspondant, ancré directement sur l'article visé. Elle s'affiche dès que le code est un article ERP connu (voir `sitesecurite-articles.js`), **y compris sur les lignes sans snippet** — consulter le texte reste utile quand il n'y a rien à insérer.

  Désactivable via le réglage **Intégration Aviso**, accessible depuis le popup de l'icône ou dans Paramètres avancés. Sans effet sur les autres sites.

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
1. Dans `background.js`, remplacez la valeur de la constante `DEFAULT_WEBAPP_URL` par l'URL de votre application Web
2. Rechargez l'extension (`chrome://extensions` > icône **Actualiser** ⟳)
3. Ajustez si besoin la fréquence d'actualisation automatique dans **Paramètres avancés > Fréquence d'actualisation des données** (optionnel, toutes les heures par défaut)

### d. Mise à jour des données (lecture seule)
L'extension ne modifie jamais le Sheet : elle se contente de le lire. À chaque récupération (bouton "🔄 Actualiser les données" du popup, "🔄 Forcer l'actualisation..." de la page Options, ou synchro automatique en arrière-plan), les snippets affichés dans l'extension sont **entièrement remplacés** par le contenu actuel du Sheet.

Pour ajouter, modifier ou supprimer un snippet : faites-le directement dans le Google Sheet (lien "📄 Ouvrir le tableau Google Sheets" en haut de la page Options), puis actualisez les données dans l'extension pour récupérer le résultat.

## 4. Paramètres avancés

Accessibles via le bouton "⚙️ Paramètres avancés" en bas de la page Options :
- **Fréquence d'actualisation des données** : intervalle entre deux récupérations automatiques depuis le Google Sheet (minutes, 60 par défaut)
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

⚠️ **Limite technique importante** : une extension chargée en mode développeur ne peut pas se ré-écrire elle-même — Chrome ne l'autorise pas, pour des raisons de sécurité. Quand une nouvelle version est détectée (badge rouge sur l'icône + notification), l'extension affiche une **marche à suivre détaillée avec liens cliquables** (dans la bannière en haut de la page Options, ou dans "Paramètres avancés > Mise à jour de l'extension") :
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
- **Permission `host_permissions: <all_urls>`** : à justifier — nécessaire pour détecter la frappe et remplacer le texte dans n'importe quel champ, sur n'importe quel site
- **Usage des données** : l'extension lit du texte dans les champs des pages visitées (fonctionnalité cœur) et récupère vos snippets depuis l'URL Google Sheets que *vous* configurez — aucune donnée n'est envoyée à un serveur tiers appartenant au développeur
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
├── background.js          # Récupération Google Sheets, alarmes, vérification MAJ GitHub
├── content.js              # Détection, temporisation et remplacement du texte + intégration Aviso
├── sitesecurite-articles.js # Table code d'article ERP -> page sitesecurite.com (générée, cf. en-tête)
├── popup.html/css/js       # Popup de l'icône (barre d'outils) : actualisation + lien Paramètres
├── options.html/css/js     # Page de consultation (lecture seule) et paramètres avancés
├── icons/                  # Icônes de l'extension
├── CHANGELOG.md             # Historique des versions
└── google-apps-script/
    └── Code.gs               # Script à déployer sur Google Sheets (backend gratuit)
```
