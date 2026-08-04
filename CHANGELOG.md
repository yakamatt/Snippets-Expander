# Changelog — Snippet Expander

## v2.6.0 — 2026-08-04
- **Ajoute un bouton "✏️ Modifier les données"** dans le popup de l'icône, juste au-dessus de "🔄 Actualiser les données" : lien direct vers le tableau Google Sheets, pour éditer les snippets sans passer par la page Options

## v2.5.0 — 2026-08-04
- **Nouveau logo** : remplace les icônes de l'extension (16/32/48/128px) par le nouveau logo fourni (croix + flèche blanches sur fond bleu)
- **Nouvelle palette de couleurs**, dérivée du bleu du logo (`#2d51b2`), appliquée à `options.css` et `popup.css` en clair comme en sombre — remplace la palette teal introduite au rebranding précédent

## v2.4.0 — 2026-08-04
- **Ajoute une section "Crédits"** en bas de la page Options, avec un lien vers le dépôt GitHub
- **Ajoute un champ "Dossier local de l'extension"** (Paramètres avancés, optionnel) : une fois renseigné, l'étape "remplacez les fichiers" de la marche à suivre pour la mise à jour manuelle affiche un lien cliquable direct vers ce dossier (`file://...`) au lieu d'un simple rappel textuel — Chrome ne permettant pas à une extension de connaître automatiquement son propre chemin sur le disque, ce champ doit être renseigné une fois par l'utilisateur
- **Ajoute une "Zone de test"** : un champ de texte libre dans lequel taper un déclencheur existant pour voir l'expansion se produire en direct, avec une explication pensée pour les débutants — pratique pour vérifier que tout fonctionne sans quitter la page

## v2.3.0 — 2026-08-04
- **Nouveau logo** : remplace les icônes de l'extension (16/32/48/128px) par le nouveau logo fourni, et l'affiche dans l'en-tête de la page Options et du popup (à la place de l'emoji ⚡)
- **Nouvelle palette de couleurs**, dérivée du logo (teinte sarcelle/teal), appliquée à `options.css` et `popup.css` : accent, fond, bordures et ombres repensés en conséquence, pour un rendu plus cohérent avec l'identité visuelle, en clair comme en sombre
- Petites retouches "modernes" : coins plus arrondis sur les cartes/boutons/champs, transitions douces sur les boutons et champs
- **Supprime toute mention de "Blaze.Today"** (`manifest.json`, `README.md`) : l'extension ne se présente plus comme une alternative à un produit tiers

## v2.2.0 — 2026-08-02
- **Ajoute une marche à suivre détaillée pour la mise à jour manuelle** (mode développeur) : quand une nouvelle version est disponible, une liste numérotée avec des liens cliquables apparaît (téléchargement direct du zip, ouverture de `chrome://extensions`) au lieu d'une simple ligne de texte
- **Supprime le champ modifiable "URL du dépôt GitHub"** : l'URL est désormais fixée dans le code (`DEFAULT_GITHUB_URL`), plus besoin de la configurer ni de l'enregistrer
- **Supprime le bouton "Enregistrer" de la section mise à jour** : la case "Vérifier automatiquement les mises à jour" s'enregistre désormais automatiquement au clic, comme les autres réglages de Paramètres avancés
- Le bouton de la bannière "Nouvelle version disponible" ouvre maintenant directement la marche à suivre détaillée (au lieu de lancer le téléchargement sans context)

## v2.1.0 — 2026-08-02
- **Ajoute un popup à l'icône de la barre d'outils** (`popup.html`) : le clic sur l'icône ouvre désormais un menu avec un bouton "🔄 Actualiser les données" et un lien vers les Paramètres, au lieu d'ouvrir directement la page complète
- **Supprime la section "Partage & synchro via Google Sheets"** des Paramètres avancés (URL, synchro auto, récupération manuelle) : l'URL du Sheet n'est plus configurable depuis l'interface (voir README pour la modifier dans le code)
- **Ajoute un champ "Fréquence d'actualisation des données"** dans Paramètres avancés (en minutes, 60 par défaut), qui remplace l'ancien menu déroulant de synchro automatique
- **Renomme le bouton principal** "Mise à jour des données..." en **"Forcer l'actualisation des données depuis le tableau Google Sheets"**, avec un texte précisant que la mise à jour est déjà automatique et que ce bouton ne fait que la forcer immédiatement
- **Corrige l'erreur "Impossible de lire manifest.json sur GitHub (404)"** lors de la vérification de mise à jour : causée par la visibilité privée du dépôt GitHub (`raw.githubusercontent.com` est inaccessible sans authentification sur un dépôt privé) — le dépôt est repassé en public

## v2.0.0 — 2026-07-24
- **Simplification majeure : l'extension devient un lecteur en lecture seule.** Les snippets ne se gèrent plus que dans le tableau Google Sheets partagé ; toute la gestion locale est supprimée :
  - Suppression de l'ajout, l'édition directe, la suppression, la duplication et le changement de dossier d'un snippet dans l'extension
  - Suppression du renommage/de la suppression de dossier
  - Suppression complète du concept Partagé/Privé (plus de propriété `shared`, plus d'interrupteur)
  - Suppression de l'import/export XLSX (retrait de la bibliothèque SheetJS, `lib/xlsx.full.min.js`)
  - Suppression des sections "Zone à risque" (envoi manuel, priorité de synchronisation) et "Temporisation avant synchronisation" : il n'y a plus rien à envoyer vers Google Sheets
- **Ajoute un bouton "🔄 Mise à jour des données depuis le tableau Google Sheets"** tout en haut de la page, pour récupérer en un clic les dernières données du Sheet
- **Ajoute un lien direct vers le tableau Google Sheets partagé**, pour modifier les snippets directement à la source
- La récupération remplace désormais entièrement les snippets locaux par le contenu du Sheet (plus de fusion : il n'y a plus d'édition locale à préserver)
- Bump v1.9.1 → v2.0.0 (changement de fonctionnement majeur)

## v1.9.1 — 2026-07-24
- **Corrige la distinction visuelle Partagé/Privé, quasi invisible** : le seul changement de couleur de texte passait inaperçu sur fond blanc. Une ligne "Privé" a maintenant un fond distinctement teinté (en plus du texte atténué), rendant le changement d'état évident au premier coup d'œil

## v1.9.0 — 2026-07-24
- **Ajoute un interrupteur Partagé/Privé dans le formulaire "Ajouter un snippet"**, réglé sur **Privé** par défaut : le choix se fait désormais à la création plutôt que systématiquement en tant que "Partagé" puis à re-régler après coup
- Vérifié que l'apparence de chaque snippet créé correspond bien à son état Partagé/Privé dès son premier rendu

## v1.8.0 — 2026-07-24
- **Met en avant (scroll + focus) le snippet créé, dupliqué ou déplacé de dossier**, juste après le rendu qui suit l'action — son dossier est déplié automatiquement si besoin pour que sa ligne soit visible
- **L'apparence d'une ligne suit maintenant son état Partagé/Privé** : un snippet "Privé" a un texte atténué ; dès qu'il redevient "Partagé" (ou inversement), son apparence est recalculée pour correspondre aux autres lignes du même état
- **Ajoute une temporisation avant synchronisation** (nouveau "Paramètre avancé", 5s par défaut, réglable) : les modifications rapprochées (plusieurs éditions à la suite) sont regroupées en un seul envoi vers Google Sheets au lieu d'un envoi immédiat à chaque changement. Un filet de sécurité envoie immédiatement si l'onglet Options est masqué avant la fin du délai

## v1.7.0 — 2026-07-24
- **Renomme les labels de l'interrupteur "Shared"/"Local" en "Partagé"/"Privé"**
- **Change à nouveau le comportement de l'interrupteur**, qui redevient asymétrique : passer un snippet de **Privé à Partagé** le modifie sur place (il rejoint immédiatement la synchro Google Sheets) ; passer de **Partagé à Privé** ne modifie plus l'original mais crée une **copie indépendante** marquée "Privé", jamais envoyée à Google Sheets — une confirmation détaille l'action dans les deux sens
- **Unifie ce comportement avec le bouton "Dupliquer en local"** des snippets synchronisés, renommé "Dupliquer en privé" : il effectue désormais exactement la même action que le passage Partagé → Privé de l'interrupteur
- Renomme la case à cocher "Local uniquement" en "Privé uniquement"

## v1.6.0 — 2026-07-24
- **Supprime le dossier réservé "Local"** : ce n'est plus un dossier qui détermine si un snippet est synchronisé, mais une propriété explicite `shared` portée par chaque snippet (une migration automatique convertit les anciens snippets du dossier "Local" à l'ouverture)
- **Renomme le label de l'interrupteur "Synced" en "Shared"** (labels désormais "Shared"/"Local")
- **Change le comportement de l'interrupteur** : dans les deux sens, il modifie maintenant le snippet **sur place** (plus de duplication ni de changement de dossier automatique) ; passer sur "Local" retire immédiatement le snippet du Google Sheet partagé, passer sur "Shared" l'y envoie immédiatement — une confirmation rappelle la conséquence dans les deux cas
- **Couleur neutre pour la position "Local"** de l'interrupteur (plus de vert vif)
- **Ajoute une case à cocher "Local uniquement"** en haut de la liste des snippets, pour n'afficher que ceux qui ne sont pas partagés

## v1.5.0 — 2026-07-24
- **Remplace le tag "synced"/"local" par un interrupteur à bascule** sur chaque ligne (fusionne l'ancien tag de provenance et l'indicateur de synchro en un seul contrôle interactif, basé sur le dossier plutôt que l'origine — c'est le dossier qui gouverne réellement la synchro)
  - Passer de **Synced à Local** : duplique le snippet dans le dossier "Local" (jamais synchronisé), sans modifier l'original synchronisé
  - Passer de **Local à Synced** : sort simplement ce snippet du dossier "Local" (pas de copie), il rejoint immédiatement la synchro Google Sheets
  - Une confirmation explique l'action avant de la valider, dans les deux sens

## v1.4.4 — 2026-07-24
- **Rend visibles les erreurs de synchronisation automatique**, jusqu'ici affichées uniquement dans "Paramètres avancés" (masqué par défaut) : un échec (URL non configurée, erreur réseau, erreur du script Google) restait invisible pour qui crée un snippet depuis le formulaire principal, donnant l'impression que la synchro "ne marche pas" sans jamais montrer pourquoi. Le statut apparaît désormais aussi juste sous "Mes snippets", et les erreurs sont loguées dans la console pour diagnostic
- Distingue maintenant explicitement le cas "aucune URL Google Sheets configurée" (le snippet reste local, avertissement clair) d'une véritable erreur réseau/serveur (`chrome.runtime.lastError` détecté séparément)

## v1.4.3 — 2026-07-24
- **Supprime le délai de 10s avant synchro automatique** : toute modification (ajout, édition, changement de dossier, suppression) envoie désormais immédiatement vers Google Sheets, sans debounce. Rend inutile le filet de sécurité `visibilitychange` de la v1.4.2 (plus de délai à couvrir), qui est retiré

## v1.4.2 — 2026-07-24
- **Corrige une perte silencieuse de synchro automatique** : créer un snippet (ou toute autre modification) puis fermer l'onglet Options avant la fin des ~10s de délai faisait disparaître la synchro vers Google Sheets — le snippet restait bien enregistré localement, dans le bon dossier, mais ne partait jamais en ligne. Un filet de sécurité déclenche maintenant l'envoi immédiatement dès que la page devient masquée (`visibilitychange`), au lieu d'attendre la fin du délai

## v1.4.1 — 2026-07-24
- **Annule le glisser-déposer** introduit en v1.4.0 pour changer un snippet de dossier
- Remplacé par une **icône 📁 dédiée**, juste à côté de "Dupliquer en local"/"Supprimer" : au clic, elle se transforme temporairement en sélecteur de dossier (même liste que le formulaire d'ajout, "Nouveau dossier..." inclus), qui redevient une icône une fois le choix fait — pas de `<select>` toujours visible sur chaque ligne, et aucune interférence avec l'édition directe du déclencheur/contenu

## v1.4.0 — 2026-07-24
- **Changement de dossier par glisser-déposer**, à la place du menu déroulant par ligne : une poignée ⠿ dédiée est seule "draggable" (jamais les cellules éditables), pour ne jamais perturber l'édition directe du déclencheur/contenu. On peut lâcher sur l'en-tête d'un dossier ou directement sur une autre ligne de ce dossier
- **Colonne "Contenu" nettement élargie** : `table-layout: fixed` avec largeurs fixes pour Déclencheur/Actions, le reste revenant au Contenu
- Corrige un bug de rendu découvert au passage : `display:flex` posé directement sur le `<td colspan="3">` de l'en-tête de groupe cassait le calcul de largeur de `table-layout:fixed` (Chrome le réduisait à la largeur de la 1re colonne au lieu de sommer les 3 colonnes couvertes) — le flex est maintenant posé sur un wrapper interne, le `<td>` reste un élément de tableau normal

## v1.3.3 — 2026-07-24
- **Corrige l'import automatique à l'installation**, qui n'affichait jamais les snippets importés au premier lancement de la page Options : `chrome.runtime.openOptionsPage()` était appelé sans attendre la fin de `pullFromSheet()` (fetch réseau), donc la page se chargeait et lisait le storage avant que l'import ne soit terminé. Toute la séquence d'installation (réglages par défaut, import, ouverture des paramètres) est maintenant strictement enchaînée avec `await`
- Supprime une condition de course annexe : l'initialisation de `snippets: []` et l'écriture de `pullFromSheet()` visaient la même clé de storage depuis deux chaînes asynchrones indépendantes, sans garantie d'ordre
- La page Options se rafraîchit désormais automatiquement si les snippets changent en arrière-plan (import différé, synchro auto horaire, autre onglet...), au lieu de rester figée jusqu'au prochain rechargement manuel

## v1.3.2 — 2026-07-24
- **Export XLSX : les sauts de ligne sont désormais visibles à l'ouverture.** La bibliothèque XLSX gratuite (SheetJS Community) ne peut pas écrire de style de cellule (wrap text, gras...) — silencieusement ignoré à l'export, vérifié en inspectant le fichier généré. Les sauts de ligne réels étaient déjà conservés dans la donnée, mais restaient invisibles faute de hauteur de ligne suffisante. Correction : largeur de colonnes + hauteur de ligne calculée selon le nombre de lignes de chaque snippet (propriétés de feuille, pas des styles de cellule, donc bien écrites par la version gratuite)

## v1.3.1 — 2026-07-24
- **Refonte visuelle complète** de la page Options : palette chaude (fond parchemin, accent ambre au lieu de l'indigo générique), typographie monospace pour les titres/labels/déclencheurs (en écho au caractère "code" des snippets) associée à une police système soignée pour le corps de texte
- Prise en charge du **mode sombre** (`prefers-color-scheme`), y compris pour les couleurs de dossier générées dynamiquement (posées en style inline, donc gérées explicitement en JS)
- Palette de couleurs de dossier resserrée à un jeu de teintes choisies (au lieu d'un arc-en-ciel de teinte aléatoire), plus harmonieuse avec le reste de l'interface
- Note de synchronisation par ligne remplacée par une puce compacte avec infobulle, moins envahissante visuellement que le paragraphe précédent

## v1.3.0 — 2026-07-24
- **Export/Import remplacés par du XLSX natif** (via SheetJS, incluse localement dans `lib/`) au lieu du CSV
- **Dossier "Local" réservé** : les snippets qu'il contient ne sont jamais envoyés à Google Sheets, quoi qu'il arrive ; tous les autres dossiers sont synchronisés. Toujours proposé dans les listes de dossiers, marqué 🔒
- **Synchro automatique après modification** : tout ajout/édition/suppression/changement de dossier programme un envoi vers Google Sheets ~10s plus tard (debounce), sans confirmation, sauf pour le dossier "Local" qui en reste exclu — remplace l'ancienne confirmation systématique sur les snippets synchronisés
- **Bouton "+" sur chaque en-tête de dossier** pour ajouter rapidement un snippet dans ce dossier précis
- **Changement de dossier d'un snippet existant** : un petit sélecteur de dossier apparaît maintenant sur chaque ligne du tableau
- **Vérification d'unicité à la création** : si le déclencheur existe déjà côté synchronisé, une confirmation prévient que la version locale sera prioritaire sur la version en ligne
- `content.js` : à longueur de déclencheur égale, un snippet local gagne désormais toujours face à un snippet synchronisé (résout une ambiguïté d'ordre lors de doublons)
- **Bannière d'incitation à épingler l'extension** dans la barre d'outils, affichée à la première installation (page Options ouverte automatiquement)

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
