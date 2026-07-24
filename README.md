# Snippet Expander — extension Chrome gratuite (alternative à Blaze.Today)

Remplace automatiquement un texte court (ex: `;sig`) par un texte prédéfini, dans n'importe quel champ de texte du navigateur. Snippets illimités, organisés en dossiers, import/export Excel (CSV), et partage d'équipe via Google Sheets avec fusion intelligente — **100% gratuit**.

## 1. Installer l'extension dans Chrome

1. Ouvrez `chrome://extensions`
2. Activez le **Mode développeur** (en haut à droite)
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `snippet-expander` (celui qui contient `manifest.json`)
5. L'icône ⚡ apparaît dans la barre d'outils — **un clic dessus ouvre directement les paramètres**

## 2. Utiliser l'extension

- Cliquez sur l'icône ⚡ pour ouvrir les paramètres et gérer vos snippets.
- Un snippet a un **déclencheur** (ex: `;sig`, `/adresse`), un **contenu** et un **dossier** optionnel.
- Tapez le déclencheur dans n'importe quel champ (Gmail, formulaires web, réseaux sociaux, contenteditable...) : après une courte temporisation (1 seconde par défaut, réglable), il se remplace par le contenu — les sauts de ligne et retours à la ligne sont respectés.
- Placeholders disponibles : `{date}`, `{time}`, `{cursor}` (repositionne le curseur après expansion).
- **Édition directe** : cliquez dans n'importe quelle cellule du tableau des snippets pour la modifier ; l'enregistrement est automatique dès que vous cliquez ailleurs (blur).
- **Dossiers** : tapez un nom de dossier lors de la création d'un snippet (ou modifiez la cellule "Dossier" plus tard) pour organiser vos snippets ; utilisez le filtre en haut de la liste pour n'afficher qu'un dossier.

## 3. Import / Export Excel (CSV)

Dans la page Options :
- **Exporter en CSV** : télécharge tous vos snippets (`trigger,content,folder`) dans un fichier `.csv` ouvrable/éditable dans Excel.
- **Importer un CSV** : les snippets importés sont ajoutés comme snippets **locaux** modifiables ; ceux avec un déclencheur déjà existant sont mis à jour.

## 4. Partage en temps réel avec une équipe (Google Sheets, gratuit)

À l'installation, l'extension importe automatiquement les snippets partagés par défaut (URL Google Sheets pré-configurée dans les paramètres, synchro auto activée toutes les heures). Vous pouvez remplacer cette URL par la vôtre à tout moment dans **Paramètres avancés > Partage & synchro**.

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
1. Options de l'extension > collez l'URL dans la section "Partage & synchro"
2. Choisissez une fréquence de synchro automatique (optionnel)

### d. Fusion des données (important)
Contrairement à la v1.0, **la récupération ne supprime plus jamais vos snippets créés localement**. Au moment de la récupération :
- vos snippets locaux sont conservés
- les snippets provenant du Sheet sont ajoutés/mis à jour, marqués 🔒 (lecture seule — modifiez-les sur Google Sheets, ou cliquez sur "Dupliquer en local" pour en faire une copie éditable)
- en cas de déclencheur identique entre un snippet local et un snippet synchronisé, la **priorité de synchronisation** (réglable dans Paramètres avancés) décide qui l'emporte : Google Sheets par défaut, ou vos snippets locaux si vous le préférez

L'envoi **vers** Google Sheets (qui écrase le contenu du Sheet) a été déplacé dans **Paramètres avancés > Zone à risque**, avec confirmation obligatoire, car c'est une action destructive pour les autres utilisateurs du Sheet partagé.

## 5. Paramètres avancés

Accessibles via le bouton "⚙️ Paramètres avancés" en bas de la page Options :
- **Temporisation avant expansion** : délai (ms) après la fin de la frappe avant remplacement (évite qu'un mot plus long contenant un déclencheur ne s'expanse par erreur)
- **Priorité de synchronisation** : Google Sheets ou snippets locaux en cas de doublon
- **Envoi vers Google Sheets** : bouton à risque, confirmation obligatoire
- **Mise à jour de l'extension** : voir section suivante

## 6. Mettre l'extension sur GitHub

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
Cette section ne s'applique que si l'extension reste chargée en **mode développeur** ("non empaquetée"). Si vous l'avez publiée sur le Chrome Web Store (voir section 7), ignorez-la : Chrome gère les mises à jour tout seul et ce bloc de paramètres est automatiquement masqué dans la page Options.

1. Dans les Options > Paramètres avancés > "Mise à jour de l'extension (mode développeur)", renseignez l'URL raw de votre dépôt, par exemple :
   `https://raw.githubusercontent.com/VOTRE-UTILISATEUR/snippet-expander/main`
2. Cochez "Vérifier automatiquement les mises à jour" si souhaité, ou cliquez sur "Vérifier une mise à jour maintenant"
3. L'extension compare le numéro de version de `manifest.json` sur GitHub avec la version installée

⚠️ **Limite technique importante** : une extension chargée en mode développeur ne peut pas se ré-écrire elle-même — Chrome ne l'autorise pas, pour des raisons de sécurité. La vérification GitHub **notifie** donc qu'une nouvelle version existe (badge rouge sur l'icône + notification), mais la mise à jour reste manuelle :
1. Cliquez sur le bouton **"⬇️ Télécharger la mise à jour"** (dans la bannière en haut de la page Options, ou dans "Paramètres avancés > Mise à jour de l'extension") — le zip du dépôt se télécharge automatiquement
2. Décompressez-le et remplacez les fichiers dans le **même dossier** que celui chargé dans Chrome (ne créez pas un nouveau dossier)
3. Allez sur `chrome://extensions`, cliquez sur l'icône **Actualiser** ⟳ de l'extension

Comme `chrome.storage` est lié à l'identifiant de l'extension (dérivé du chemin du dossier), **vos snippets et paramètres sont automatiquement conservés** tant que vous réutilisez le même dossier — aucune perte de données.

## 7. Publier sur le Chrome Web Store

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
- **Usage des données** : l'extension lit/écrit du texte dans les champs des pages visitées (fonctionnalité cœur) et envoie vos snippets à l'URL Google Sheets que *vous* configurez — aucune donnée n'est envoyée à un serveur tiers appartenant au développeur
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
├── background.js          # Synchro (fusion), clic icône, vérification MAJ GitHub
├── content.js              # Détection, temporisation et remplacement du texte
├── options.html/css/js     # Page de gestion complète (édition inline, dossiers, avancé)
├── icons/                  # Icônes de l'extension
├── CHANGELOG.md             # Historique des versions
└── google-apps-script/
    └── Code.gs               # Script à déployer sur Google Sheets (backend gratuit)
```
