# Changelog — Snippet Expander

## v1.2.4 — 2026-07-24
- Suppression de la section "Dossiers" (chips) devenue redondante
- Renommer/supprimer un dossier se fait maintenant directement depuis l'en-tête de groupe du tableau des snippets, via deux icônes (✏️ renommer, 🗑️ supprimer) alignées à droite

## v1.2.3 — 2026-07-24
- URL Google Sheets par défaut remplacée par un nouveau déploiement à jour (structure `trigger`/`content`/`folder`, sans `description`) — corrige l'ancien déploiement qui ne renvoyait jamais de dossier et réécrivait une colonne "description" vide à chaque envoi

## v1.2.2 — 2026-07-24
- La synchro automatique "Toutes les heures" est désormais forcée à l'activation si elle est encore sur "Désactivée" — s'applique aussi bien aux nouvelles installations qu'aux installations existantes dont ce réglage datait d'avant l'introduction de ce défaut (recalculé à chaque installation/mise à jour de l'extension)

## v1.2.1 — 2026-07-24
- Les snippets synchronisés (🔒) sont désormais **modifiables directement** dans le tableau (déclencheur et contenu), au lieu d'être en lecture seule
- Toute modification d'un snippet synchronisé déclenche une confirmation explicite ("action non annulable, appliquée à tous les utilisateurs") puis renvoie immédiatement l'ensemble de vos snippets locaux vers le Google Sheet partagé (même mécanisme que "Envoyer vers Google Sheets")
- Le texte d'aide associé a été mis à jour en conséquence (page Options + README)

## v1.2.0 — 2026-07-24
- **Préparation pour la publication sur le Chrome Web Store** (voir README section 7)
- Système de mise à jour adaptatif : la page Options détecte via `chrome.management.getSelf()` si l'extension tourne en mode développeur ou a été installée normalement (Store) — le bloc GitHub/zip manuel n'est affiché qu'en mode développeur ; en mode normal, un message indique que les mises à jour sont automatiques (gérées par Chrome), et l'alarme de vérification GitHub en arrière-plan est également désactivée dans ce cas
- **Champ "description" supprimé partout** (formulaire d'ajout, tableau, CSV, Google Sheets/`Code.gs`) : les snippets n'ont plus que déclencheur + contenu + dossier
  - ⚠️ Changement de structure du Google Sheet partagé : la colonne "folder" passe de la colonne D à la colonne C. Après avoir redéployé `Code.gs`, pensez à supprimer la colonne "description" de votre Sheet (ou faites un "Envoyer vers Google Sheets" depuis l'extension pour reconstruire automatiquement la bonne structure à partir de vos données locales)
- À la première installation, l'extension importe désormais automatiquement les snippets partagés par défaut depuis une URL Google Sheets pré-configurée, avec synchro auto activée toutes les heures

## v1.1.3 — 2026-07-23
- "Vérifier automatiquement les mises à jour" est désormais coché par défaut (nouvelles installations)
- Temporisation avant expansion : 500 ms par défaut (au lieu de 1000 ms)
- Synchro automatique : la première fois que vous renseignez l'URL Google Sheets et enregistrez, l'intervalle passe automatiquement à "Toutes les heures" au lieu de "Désactivée"

## v1.1.2 — 2026-07-23
- Bouton "⬇️ Télécharger la mise à jour" ajouté (bannière + Paramètres avancés) quand une nouvelle version est détectée sur GitHub : télécharge directement le zip du dépôt (via codeload.github.com) pour appliquer la mise à jour manuelle

## v1.1.1 — 2026-07-23
- Correctif : la section "Paramètres avancés" restait visible par défaut (le CSS `display:flex` écrasait l'attribut `hidden`) — elle est maintenant bien repliée au chargement
- Gestion des dossiers repensée graphiquement : chips colorés (couleur déterministe par nom), compteur de snippets par dossier, renommage et dissociation directement depuis les chips
- Le tableau des snippets est désormais groupé par dossier avec des en-têtes de groupe repliables (clic pour plier/déplier)
- La création d'un snippet utilise un menu déroulant de dossiers existants (+ option "Nouveau dossier") au lieu d'un champ texte libre
- Un seul zip fourni par livraison (le zip protégé par mot de passe n'est généré que sur demande, pour contourner un blocage Gmail)

## v1.1.0 — 2026-07-23
- Fusion intelligente lors de la synchro : les snippets locaux ne sont plus jamais effacés par une récupération Google Sheets (fusion par déclencheur, priorité configurable)
- Édition inline directement dans le tableau des snippets (enregistrement automatique au blur)
- Numéro de version + date de build + date de dernière synchro affichés en bas de la page Options
- Dossiers de snippets optionnels (champ "folder" + filtre dans la liste)
- Clic sur l'icône de la barre d'outils → ouvre directement les paramètres (le popup de recherche a été retiré)
- Respect des sauts de ligne et de la mise en forme lors de l'expansion dans les champs contenteditable (Gmail, éditeurs riches, etc.) via insertion de `<br>`
- Les snippets importés depuis Google Sheets sont verrouillés en lecture seule (🔒), avec une note et un bouton "Dupliquer en local" pour les personnaliser
- Nouvelle zone "Paramètres avancés" (masquée par défaut) :
  - Temporisation réglable avant expansion (par défaut 1000 ms)
  - Choix du sens de priorité de synchronisation (Google Sheets vs local)
  - Bouton "Envoyer vers Google Sheets" déplacé ici, avec confirmation obligatoire (action destructive)
  - Vérification de mise à jour depuis un dépôt GitHub (comparaison de version + notification)

## v1.0.0 — 2026-07-23
- Version initiale : expansion de texte, gestion des snippets, import/export CSV, synchro Google Sheets basique (écrasement), popup de recherche rapide
