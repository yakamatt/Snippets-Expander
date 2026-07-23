# Changelog — Snippet Expander

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
