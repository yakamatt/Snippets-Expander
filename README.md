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
- Un snippet a un **déclencheur** (ex: `;sig`, `/adresse`), un **contenu**, une description optionnelle et un **dossier** optionnel.
- Tapez le déclencheur dans n'importe quel champ (Gmail, formulaires web, réseaux sociaux, contenteditable...) : après une courte temporisation (1 seconde par défaut, réglable), il se remplace par le contenu — les sauts de ligne et retours à la ligne sont respectés.
- Placeholders disponibles : `{date}`, `{time}`, `{cursor}` (repositionne le curseur après expansion).
- **Édition directe** : cliquez dans n'importe quelle cellule du tableau des snippets pour la modifier ; l'enregistrement est automatique dès que vous cliquez ailleurs (blur).
- **Dossiers** : tapez un nom de dossier lors de la création d'un snippet (ou modifiez la cellule "Dossier" plus tard) pour organiser vos snippets ; utilisez le filtre en haut de la liste pour n'afficher qu'un dossier.

## 3. Import / Export Excel (CSV)

Dans la page Options :
- **Exporter en CSV** : télécharge tous vos snippets (`trigger,content,description,folder`) dans un fichier `.csv` ouvrable/éditable dans Excel.
- **Importer un CSV** : les snippets importés sont ajoutés comme snippets **locaux** modifiables ; ceux avec un déclencheur déjà existant sont mis à jour.

## 4. Partage en temps réel avec une équipe (Google Sheets, gratuit)

### a. Créer le Google Sheet
1. Créez un nouveau Google Sheet (sheets.new)
2. Renommez le premier onglet en `Snippets`
3. Ajoutez la ligne d'en-tête : `trigger | content | description | folder`

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

### c. Utiliser GitHub comme source de mise à jour
1. Dans les Options > Paramètres avancés > "Mise à jour de l'extension", renseignez l'URL raw de votre dépôt, par exemple :
   `https://raw.githubusercontent.com/VOTRE-UTILISATEUR/snippet-expander/main`
2. Cochez "Vérifier automatiquement les mises à jour" si souhaité, ou cliquez sur "Vérifier une mise à jour maintenant"
3. L'extension compare le numéro de version de `manifest.json` sur GitHub avec la version installée

⚠️ **Limite technique importante** : une extension chargée en mode développeur ("non empaquetée") ne peut pas se ré-écrire elle-même — Chrome ne l'autorise pas, pour des raisons de sécurité. La vérification GitHub **notifie** donc qu'une nouvelle version existe (badge rouge sur l'icône + notification), mais la mise à jour reste manuelle :
1. Téléchargez la nouvelle version (zip ou `git pull` si vous avez cloné le dépôt)
2. Remplacez les fichiers dans le **même dossier** que celui chargé dans Chrome (ne créez pas un nouveau dossier)
3. Allez sur `chrome://extensions`, cliquez sur l'icône **Actualiser** ⟳ de l'extension

Comme `chrome.storage` est lié à l'identifiant de l'extension (dérivé du chemin du dossier), **vos snippets et paramètres sont automatiquement conservés** tant que vous réutilisez le même dossier — aucune perte de données.

**Mise à jour réellement automatique et silencieuse** : ce n'est possible que si l'extension est publiée sur le **Chrome Web Store** (Chrome gère alors les mises à jour tout seul, comme pour n'importe quelle extension installée normalement). Cela coûte 5 $ US en frais de compte développeur, une seule fois. C'est optionnel et non nécessaire pour un usage interne/équipe.

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
