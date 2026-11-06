# Politique de confidentialité — Snippet Expander

*Dernière mise à jour : 7 novembre 2026 (version 2.21.0)*

Snippet Expander est une extension Chrome gratuite qui remplace un raccourci court (un « déclencheur », par exemple `/GN4`) par un texte complet, dans les champs de texte du navigateur, et ajoute des raccourcis à l'application Aviso. Cette page explique quelles données l'extension utilise, où elles vont, et comment garder la main dessus.

## Ce qui reste dans votre navigateur

- **Ce que vous tapez dans les pages web.** L'extension lit le texte saisi dans un champ uniquement pour repérer un déclencheur et le remplacer par son texte. Ce texte n'est **jamais envoyé** nulle part, ni enregistré.
- **Le Clausier Personnel** (vos propres snippets), les **données DatAviso AI** que vous importez et vos **réglages** sont enregistrés dans le stockage de Chrome (`chrome.storage`), sur votre ordinateur. Les réglages peuvent être synchronisés par Chrome entre vos appareils si vous avez activé la synchronisation de votre compte Chrome.
- **Les liens d'affaire** (SGO, SharePoint, Explorateur Windows) sont de simples liens construits à partir du numéro d'affaire affiché dans Aviso. L'extension n'envoie rien elle-même : c'est votre clic qui ouvre la page ou l'application visée.

## Ce qui est échangé avec Google Sheets

- **Lecture du Clausier Commun.** L'extension télécharge régulièrement (toutes les heures par défaut) les textes types partagés par l'équipe, depuis un tableau Google Sheets, via un script Google Apps Script (`script.google.com`, `script.googleusercontent.com`).

### Sauvegarde anonyme du Clausier Personnel

Depuis la version 2.21.0, l'extension envoie au Google Sheets du Clausier Commun une copie des snippets personnels ajoutés ou modifiés : déclencheur, texte, identifiant aléatoire et date. L'identifiant est créé à l'installation et ne contient ni nom, ni adresse e-mail, ni information sur le compte. Cette copie ne sert qu'à enrichir le Clausier Commun ; elle n'est ni vendue, ni partagée avec des tiers, ni relue par l'extension. L'utilisateur peut la désactiver dans Paramètres avancés > Sauvegarde anonyme du Clausier Personnel. Le texte saisi dans les pages web n'est jamais envoyé.

## Ce que l'extension ne fait pas

- Aucune publicité, aucun outil de mesure d'audience, aucun traceur.
- Aucune donnée vendue ou cédée à des tiers.
- Aucune donnée utilisée à d'autres fins que le fonctionnement de l'extension et l'amélioration du Clausier Commun, ni pour évaluer une solvabilité ou accorder un crédit.
- Aucun historique de navigation collecté.

## Permissions demandées

| Permission | Pourquoi |
|---|---|
| Accès aux pages (`<all_urls>`) | Repérer un déclencheur dans le champ où vous tapez, sur n'importe quel site, et afficher les icônes sur Aviso |
| `storage`, `unlimitedStorage` | Enregistrer les snippets, les données DatAviso AI et les réglages dans le navigateur |
| `alarms` | Actualiser le Clausier Commun et envoyer la sauvegarde anonyme à intervalle régulier |
| `script.google.com`, `script.googleusercontent.com` | Lire le Clausier Commun et y envoyer la sauvegarde anonyme |
| `raw.githubusercontent.com` | Vérifier les mises à jour d'une installation en mode développeur uniquement |

## Vos choix

- **Désactiver la sauvegarde anonyme** : Paramètres avancés > Sauvegarde anonyme du Clausier Personnel.
- **Effacer vos données locales** : bouton « Supprimer tout le Clausier Personnel » et effacement des données DatAviso AI dans les Paramètres, ou désinstallation de l'extension, qui efface tout ce qu'elle a enregistré dans le navigateur.
- **Garder votre propre copie** : l'export `.xlsx` ou `.csv` du Clausier Personnel, dans les Paramètres. La sauvegarde anonyme ne permet pas de restaurer vos snippets.

## Contact

Une question sur cette politique : utilisez le formulaire « ✉️ Donner mon avis » du popup de l'extension, ou ouvrez un ticket sur [github.com/yakamatt/Snippets-Expander/issues](https://github.com/yakamatt/Snippets-Expander/issues).
