# Changelog — Snippet Expander

## v2.22.0 — 2026-11-07
- **Statistiques d'utilisation anonymes**, pour mesurer l'adoption de l'extension et savoir quelles fonctions servent vraiment. L'extension compte combien de fois chaque fonction a servi, par jour : expansion au clavier (Clausier Commun ou Personnel, et hors Aviso), chaque icône d'Aviso (bleue, jaune, crayon, « + », verte, sitesecurite, corbeille, annulation), liens SGO, SharePoint et Explorateur, imports DatAviso AI, imports et exports du Clausier Personnel, ouvertures du popup, des Paramètres et du tutoriel
  - Les totaux partent avec l'actualisation du Clausier Commun (toutes les heures par défaut) dans un nouvel onglet masqué `Statistiques` du tableau : une ligne par utilisateur (le même `Ref_User` aléatoire que la sauvegarde) et par jour, avec la version, le nombre de snippets personnels et d'articles DatAviso AI. La ligne du jour est remplacée à chaque envoi, jamais additionnée : un envoi retenté ne compte rien deux fois
  - Jamais le texte tapé ou inséré, les pages visitées, les déclencheurs ni les données d'Aviso. Les jours envoyés sont oubliés par le navigateur ; le tableau les garde 24 mois
  - Activées par défaut, désactivables dans Paramètres avancés > Statistiques d'utilisation anonymes (les compteurs pas encore envoyés sont alors effacés). La politique de confidentialité le décrit
  - Côté Google Sheets : **menu « Clausier > Synthèse des statistiques »**, un mois par ligne (installations actives, utilisateurs actifs, versions en service, total de chaque usage), dans l'onglet `Statistiques_Synthèse`
  - ⚠️ **Le script Apps Script doit être redéployé** (API v5) : tant qu'il ne l'est pas, rien n'est envoyé (sonde `?probe=stats`) et les compteurs attendent dans le navigateur
- **Côté Google Sheets : relancer « Préparer la revue » garde le travail en cours.** Les décisions pas encore appliquées et les « Texte final » retouchés à la main étaient effacés : la revue repartait de la proposition, et l'avertissement ne comptait que les décisions, si bien qu'une retouche sans décision se perdait sans prévenir. Ils sont désormais repris par déclencheur, même si la proposition a changé, avec une marque dans la colonne Type (« ✍️ retouche conservée », « 🔄 proposition changée » à relire). Une ligne travaillée qui ne revient pas dans la nouvelle revue est listée avant d'être effacée, sur confirmation
- **Tutoriel : l'étape des icônes Aviso est réécrite.** Les numéros posés sur des icônes de 16 px et la légende à part obligeaient à faire des allers-retours. Les icônes sont plus grandes, sans numéros, et la légende les range par usage (insérer un texte, gérer vos snippets, et aussi), chacune avec son icône ; survoler une ligne la désigne dans la maquette
- Aucune permission ajoutée : le tableau du Clausier Commun était déjà autorisé. À déclarer dans l'onglet « Privacy practices » du Store comme « activité de l'utilisateur » (README, section 6 d)

## v2.21.1 — 2026-11-07
- **Paramètres : la page ne saute plus à la fin de « 🔄 Forcer l'actualisation du Clausier Commun ».** Ouverte depuis le lien « Modifier le Clausier Personnel » du popup (`options.html#clausier`), elle redescendait jusqu'au Clausier Personnel à chaque actualisation : le rechargement des données refaisait le défilement prévu pour l'ouverture. Il n'a plus lieu qu'à l'ouverture de la page, et l'on reste en haut, sur le résultat de l'actualisation
- **Paramètres : la liste « Afficher les snippets » du Clausier Personnel est ouverte par défaut**, au lieu d'être repliée à chaque ouverture de la page. Elle se replie toujours d'un clic
- **Tutoriel** : le titre d'accueil devient « Rédigez vos rapports AVISO beaucoup plus vite »

## Script Google Sheets — 2026-11-07
*`Code.gs` seul, sans nouvelle version de l'extension : à recoller dans l'éditeur Apps Script.*
- **Plus de colonne « folder » dans l'onglet `Snippets`.** L'extension ne s'en servait plus depuis la v2.18.0 (plus d'affichage par dossier dans les Paramètres). Le script ne la lit plus, ne l'écrit plus, et un tableau neuf ne la crée plus ; elle peut être supprimée du tableau sans effet. La colonne « Dossier » de l'onglet `Revue` disparaît aussi
- Une revue préparée avec l'ancien script (11 colonnes) est refusée à l'application, avec un message invitant à la préparer de nouveau : ses colonnes ne correspondent plus

## v2.21.0 — 2026-11-06
- **Tutoriel visuel en 8 étapes**, ouvert dans un onglet à l'installation initiale seulement (jamais à une mise à jour). Il présente l'expansion au clavier (avec une démonstration animée), les deux clausiers, les icônes d'Aviso, DatAviso AI, les liens d'affaire et le popup. Les visuels sont des maquettes HTML avec les vraies icônes de l'extension. La dernière étape invite à partager le lien d'installation. Il remplace l'ouverture des Paramètres à l'installation
- **Lien « 🎓 Tutoriel » en haut du popup** pour le revoir à tout moment
- **Sauvegarde anonyme du Clausier Personnel** dans un nouvel onglet `Local_Snippets_Backup` du tableau du Clausier Commun (`trigger | content | Ref_User | Date`), pour repérer les formulations utiles à intégrer au Clausier Commun. Elle part à chaque actualisation du Clausier Commun (toutes les heures par défaut), avec uniquement les snippets ajoutés ou modifiés depuis l'envoi précédent ; les snippets existants partent à l'installation de cette version
  - `Ref_User` est un identifiant aléatoire, créé à l'installation et identique sur tous les postes du même compte Chrome. Aucun nom ni adresse n'est envoyé
  - Une seule ligne par utilisateur et par déclencheur : la version modifiée remplace la précédente. Le même déclencheur peut exister chez plusieurs utilisateurs. Supprimer un snippet ne le retire pas de la sauvegarde
  - Ce n'est pas une restauration : l'extension ne relit jamais cet onglet, l'export reste la copie personnelle de l'utilisateur, et les Paramètres y incitent
  - Désactivable dans Paramètres avancés > Sauvegarde anonyme du Clausier Personnel
  - Le bouton « 🔄 Forcer l'actualisation du Clausier Commun » lance aussi la sauvegarde et en affiche le résultat : nombre de snippets envoyés, « déjà sauvegardé », ou la raison d'une sauvegarde en attente (script pas encore redéployé, par exemple)
  - ⚠️ **Le script Apps Script doit être redéployé** (API v4) : tant qu'il ne l'est pas, rien n'est envoyé (sonde `?probe=backup`) et l'envoi est retenté à chaque actualisation. L'onglet `Snippets` n'est pas modifié : il reste en ajout seul
- **Les snippets fonctionnent dans le champ « Remarque » d'Aviso.** C'est un éditeur TinyMCE, logé dans une iframe sans adresse où Chrome n'injecte pas l'extension : la frappe n'y était pas vue. La page parente écoute désormais ce type d'éditeur, sur Aviso
- **Infobulle des icônes snippet : plus de ligne vide** entre le titre et le texte du snippet
- **Nouveau déploiement du script Apps Script** (API v4) : l'adresse par défaut change. Les installations existantes qui utilisaient l'ancienne adresse par défaut basculent sur la nouvelle à la mise à jour ; une adresse saisie à la main dans Paramètres avancés est conservée
- **Côté Google Sheets : menu « Clausier » de revue pour le garant du Clausier Commun** (`Code.gs`). *Préparer la revue* liste dans un onglet `Revue` les nouveaux déclencheurs et les variantes de snippets communs trouvés dans les sauvegardes, les plus partagés en premier. On décide ligne par ligne d'adopter (texte retouchable) ou d'ignorer ; *Appliquer les décisions* ajoute ou met à jour `Snippets`, garde l'ancien texte dans `Historique` et ne repropose pas ce qui a été traité. Les onglets de travail sont masqués
- Aucune permission ajoutée

## v2.20.4 — 2026-11-04
- **Liste Plans Affaires : libellés des boutons empilés plus grands.** « SGO » et « ShP » s'écrivent en vrai texte de 11 px, au lieu d'un dessin d'environ 7 px
- **L'icône de l'Explorateur devient « C:\ »** au lieu d'un dossier, en texte comme « SGO » et « ShP » : elle dit à la fois l'outil et où il cherche. Dans la barre bleue, elle prend le même petit cadre que les deux autres
- **La pile ne fait plus grandir la ligne d'affaire.** Les boutons sont resserrés (13 px de haut, collés comme un groupe de boutons) : la pile passe de 52 à 39 px. Elle est posée hors du flux (position absolue) à droite de la loupe, et ne compte donc plus dans la hauteur de la ligne. Si une ligne est trop basse pour l'empiler, les boutons s'y rangent côte à côte ; la disposition est recalculée quand la fenêtre change de taille
- ⚠️ **Limite connue** : la colonne de la loupe s'élargit de 33 px (de 33 à 66 px) pour accueillir la pile de 31 × 39 px, collée à 2 px de la loupe. Le tableau occupant toute la largeur, ce sont les autres colonnes qui rétrécissent, et une ligne peut alors gagner une ligne de texte : mesuré sur la liste enregistrée, aucune ligne sur 10 à 1 920 et 1 280 px de large, une sur 10 à 1 400 px. Afficher les boutons seulement au survol aurait évité cet effet, mais ils doivent rester visibles en permanence

## v2.20.3 — 2026-11-04
- **L'Explorateur cherche dans `C:\Users\`** au lieu de tout le disque `C:`. Ce dossier contient les profils Windows, donc le dossier « Bureau Veritas » de l'utilisateur : la recherche est plus rapide et ne remonte plus de fichiers système. Le chemin est écrit en dur, sans variable d'environnement, comme le demande un lien `search-ms:` (voir v2.20.2)
- **Sur la liste Plans Affaires, les icônes empilées prennent le style de la loupe voisine** : blanc sur fond bleu, au lieu de gris sur fond blanc. Elles reprennent ses classes Bootstrap (`btn btn-primary`), donc les mêmes couleurs, la même bordure et le même survol, qui suivront si Aviso change son thème. Gabarit resserré, de même largeur pour les trois : la pile mesure 52 px de haut. Sur ces boutons, « SGO » et « ShP » perdent leur petit cadre, le fond bleu suffisant à délimiter l'icône ; il reste dans la barre bleue, où l'icône n'a pas de fond

## v2.20.2 — 2026-11-04
- **Correctif : l'icône de l'Explorateur n'ouvrait plus rien depuis la v2.20.1.** La recherche visait `%USERPROFILE%\Bureau Veritas`, mais l'Explorateur ne développe pas cette variable dans un lien `search-ms:` : le dossier était invalide. Une page web ne pouvant pas connaître l'identifiant Windows, la recherche porte de nouveau sur tout le disque `C:`, comme en v2.20.0
- **L'icône SharePoint affiche « ShP »** au lieu de « SP », dans le même cadre que « SGO »

## v2.20.1 — 2026-11-04
- **L'Explorateur cherche dans le dossier « Bureau Veritas » du profil Windows** (`C:\Users\<identifiant>\Bureau Veritas`), où sont synchronisés les documents, au lieu de tout le disque `C:`, ce qui est plus rapide et plus pertinent. Une page web ne pouvant pas connaître l'identifiant Windows, le lien désigne le dossier par `%USERPROFILE%`, que l'Explorateur remplace lui-même par le profil de l'utilisateur connecté
- **Sur la liste Plans Affaires, les trois icônes sont empilées et resserrées** à droite de la loupe : la colonne est étroite. Les marges haute et basse de chaque dessin sont recadrées pour que la pile tienne en 40 px de haut, moins qu'une ligne d'affaire
- **Dans la barre bleue, les icônes sont agrandies** (22 px au lieu de 16) et plus opaques, pour mieux se voir sur le fond bleu

## v2.20.0 — 2026-11-04
- **Liens vers l'affaire sur Aviso** : à partir du numéro d'affaire, trois petites icônes monochromes ouvrent la fiche de l'affaire dans **SGO**, une recherche du numéro dans **SharePoint**, et une recherche des fichiers et dossiers du disque `C:` dans l'**Explorateur Windows**. Elles sont posées à deux endroits :
  - sur la liste **Plans Affaires**, à droite de la loupe « Consulter » de chaque ligne ;
  - dans la **barre bleue** d'une affaire ouverte, à gauche du sélecteur « BTS ». Cette zone d'Aviso étant affichée en ordre inversé, le placement suit le sens réel d'affichage. Sur un en-tête sans sélecteur de métier, les liens se placent après le titre de l'affaire
- Le numéro est pris tel quel, 8 chiffres en général, 7 pour les affaires les plus anciennes (`9012405`)
- **L'Explorateur passe par le protocole `search-ms:` de Windows** : un navigateur ne peut pas lancer l'Explorateur lui-même. Chrome demande d'abord l'autorisation d'ouvrir l'application, que l'on peut donner une fois pour toutes. L'icône n'est pas posée hors de Windows
- **Une case par lien** dans Paramètres avancés > Liens vers l'affaire, toutes cochées par défaut. Le changement s'applique aussitôt dans les onglets Aviso ouverts
- Aucune permission ajoutée : ce sont de simples liens dans la page

## v2.19.0 — 2026-11-03
- **Partager l'extension depuis le popup** : nouvelle rubrique « 🤝 Partager avec mes collègues », en bas. « Copier le lien » place l'adresse de la fiche du Chrome Web Store dans le presse-papiers, « Par e-mail » ouvre un message prérempli qui la contient. Le collègue installe en un clic et reçoit ensuite les mises à jour automatiquement
- **Paramètres, « Consulter le Clausier Commun » devient un bouton**, au même gabarit que « Forcer l'actualisation du Clausier Commun » mais en bleu-vert, pour ne pas confondre l'ouverture du tableau avec l'actualisation
- **Paramètres, Clausier Personnel** : le formulaire d'ajout est toujours visible, et c'est la liste des snippets qui se replie désormais (« Afficher les snippets »). Elle s'ouvre d'elle-même dès qu'une recherche est saisie. Nouveau bouton **« Supprimer tout le Clausier Personnel »**, en bas de la liste, précédé d'un message d'alerte : la suppression est définitive, et le message invite à exporter d'abord
- **Paramètres, DatAviso AI** : les boutons « Importer un fichier .txt » et « Effacer les données DatAviso AI » du popup sont aussi disponibles ici, et remplacent le lien « Tout supprimer ». La date du dernier import se met à jour aussitôt, y compris après un import fait depuis le popup

## v2.18.1 — 2026-11-03
Permissions réduites au strict nécessaire, après un refus du Chrome Web Store (« Purple Potassium », permission demandée mais non utilisée). L'audit complet demandé par le Store a porté sur toutes les permissions, pour éviter un second cycle de revue :
- **`activeTab` retirée**, c'était celle visée par le refus. Aucune fonction ne s'en servait : les onglets ouverts par l'extension passent par `chrome.tabs.create`, qui n'exige aucune permission, et les scripts de contenu tiennent leur accès aux pages de leur déclaration `matches`
- **`notifications` retirée.** Elle ne servait qu'à la vérification de mise à jour GitHub, réservée au mode développeur : une installation depuis le Store ne l'utilisait jamais. La mise à jour disponible reste signalée par le badge de l'icône et le bandeau de la page Paramètres
- **`host_permissions` réduites de `<all_urls>` aux trois hôtes réellement contactés** : `script.google.com` (lecture du Clausier Commun), `script.googleusercontent.com` (où Apps Script redirige sa réponse) et `raw.githubusercontent.com` (vérification de mise à jour). L'expansion de texte et l'intégration Aviso n'en dépendent pas, elles passent par les scripts de contenu. L'adresse de l'application Web saisie dans Paramètres avancés doit désormais commencer par `https://script.google.com/`
- Réduire des permissions ne déclenche aucune demande d'accord chez les utilisateurs déjà installés

## v2.18.0 — 2026-11-02
- **Nouveau : le Clausier Personnel**, des snippets propres à chaque utilisateur, enregistrés dans le navigateur (`chrome.storage.local`, clé `localSnippets`, permission `unlimitedStorage`). Il coexiste avec le Google Sheets, rebaptisé **Clausier Commun**. Au clavier, à déclencheur égal, **le snippet personnel l'emporte**
- **Sur Aviso, deux boutons jaunes en tête de rangée.** L'icône jaune insère le snippet personnel, avec le même aperçu au survol que l'icône bleue. Le crayon jaune ouvre une fenêtre d'édition par-dessus la page, sans quitter Aviso : modifier, supprimer, Ctrl+Entrée pour enregistrer, Échap pour annuler. L'ordre devient : jaune (ou « + »), crayon, bleu, sitesecurite, vert. Chaque icône se place désormais d'après une liste d'ordre unique (`AVISO_ORDER`), toujours après la précédente déjà posée
- **Le bouton « + » crée le snippet dans le Clausier Personnel**, et non plus dans le Google Sheets. Il prend la place de l'icône jaune, ouvre la fenêtre d'édition préremplie avec le texte de « Dispositions réalisées », et n'apparaît que sur les lignes sans snippet personnel, y compris celles qui ont déjà un snippet commun. Plus aucune écriture vers le Sheets n'est émise. `createSnippetRow` et ses garde-fous restent dans `background.js`, inutilisés
- **Un snippet créé par le « + » s'ajoute aussitôt à la cellule Aviso**, sans doublon. La fenêtre étant préremplie avec le texte de la cellule, seul ce qui manque est ajouté : tout le snippet si la cellule était vide, la seule suite si le snippet prolonge le texte de la cellule, rien si le texte a été réécrit (la cellule n'est jamais remplacée). Une modification au crayon ne touche pas le rapport
- **Le champ « Dispositions réalisées » s'agrandit après une insertion** pour montrer tout le texte, jusqu'à 60 % de la hauteur de la fenêtre, avec une barre de défilement au-delà. Il ne rapetisse jamais sous sa taille d'origine. Un champ masqué au moment de l'insertion (mode lecture) prend la bonne hauteur quand on le rouvre pour l'éditer
- **Corbeille au bord droit de chaque cellule** pour en effacer le contenu d'un clic, sur toutes les lignes, même sans code de Référentiel. Elle n'apparaît que si la cellule contient du texte. Pas de confirmation : elle devient aussitôt un bouton « Annuler l'effacement », qui remet le texte et reste disponible tant que la cellule est vide. C'est le seul effacement possible dans Aviso, toujours à l'initiative de l'utilisateur
- **Import et export du Clausier Personnel en .xlsx et .csv**, depuis la page Paramètres, avec un modèle vierge dans les deux formats. Il n'y a aucune bibliothèque : le .xlsx est écrit et lu directement (archive zip, décompression native de Chrome). Le .csv utilise `;` et l'UTF-8 avec BOM pour Excel en français, et un CSV enregistré en Windows-1252 se lit correctement. Le `.xls` (Excel 97-2003) est refusé avec la marche à suivre
- **Un import ne remplace rien sans accord.** Pour chaque déclencheur déjà présent avec un contenu différent, une fenêtre montre les deux contenus et propose Remplacer, Ignorer, Remplacer tout, Ignorer tout ou Annuler l'import. Rien n'est écrit avant la fin
- **Popup refondu.** Il propose désormais « Modifier le Clausier Personnel », qui ouvre les Paramètres sur cette section, et « Consulter le Clausier Commun ». Pour DatAviso AI, il reste l'import de fichier .txt et « Effacer les données DatAviso AI ». S'y ajoutent un lien vers un formulaire de retour, où laisser ses coordonnées si l'on souhaite être recontacté, et le lien Paramètres. Le bouton « Actualiser les données » et le champ de texte collé sont retirés : la synchro automatique continue, et la page Paramètres garde un bouton d'actualisation forcée
- **Le réglage « Intégration Aviso » est supprimé** (popup et Paramètres avancés) : l'intégration est toujours active sur Aviso, et reste sans effet ailleurs
- **Page Paramètres.** L'en-tête présente désormais un résumé des fonctions. La liste « Mes snippets » (Clausier Commun) n'est plus affichée et la section Clausier Personnel prend sa place. « DatAviso » devient « DatAviso AI », et son tableau d'articles est replié par défaut ; il s'ouvre au clic, ou de lui-même dès qu'une recherche est saisie
- ⚠️ **Les snippets du Clausier Personnel ne quittent pas le navigateur** : ils survivent aux mises à jour, mais une désinstallation les efface. La page Paramètres le signale et invite à exporter

## v2.17.0 — 2026-09-05
- **L'import DatAviso accepte les référentiels sans code d'article.** Les trames solidité d'Aviso (LP, ouvrages et éléments d'équipement, et LE, existants) listent des rubriques nommées — « Reconnaissance des sols », « Fondations profondes » — là où la trame sécurité incendie ERP donne des codes d'article. Côté Aviso, `extractRefCode` savait déjà les traiter : faute de `" - "` dans la cellule, il prend le libellé entier. Côté import, aucun en-tête ne pouvait produire un tel code, et ces trames restaient inutilisables
- **Un en-tête peut désormais être un libellé seul**, reconnu à sa position : colonne 0, quand les champs sont indentés. Deux garde-fous, une ligne de champ n'est jamais un en-tête, une ligne commençant par un caractère de séparation ou de puce non plus. Le code est calculé exactement comme dans `content.js`, pour que les deux côtés se recoupent sans conversion
- **Correctif : les codes à suffixe étaient tronqués.** `CH 12-1`, `M 50-1` et `T 38-1` étaient lus `CH12`, `M50` et `T38`, entrant en collision avec l'article de base du même numéro. Le second bloc écrasait le premier à l'affichage et l'icône verte pointait sur le mauvais texte. `(\d+)` devient `(\d+(?:-\d+)?)`
- ⚠️ **Un fichier d'import ne doit contenir que des blocs**, sans bandeau, titre de section ni tableau de synthèse : depuis que la colonne 0 signale un en-tête, une ligne de titre y serait prise pour un article. Un rapport complet se génère donc en deux fichiers, l'un pour la lecture, l'autre pour l'import
- **Correctif : deux rubriques d'un même groupe se confondaient.** Le code d'un référentiel sans code d'article était coupé au premier `" - "`, si bien que « Dallage - données relatives au sol support » et « Dallage - Exigences d'utilisation et conception » donnaient tous deux `DALLAGE`. Le premier bloc importé s'insérait alors dans les deux lignes Aviso. La coupure n'a désormais lieu que si le texte qui précède est bien un code d'article (`CO 24`, `CH 12-1`) ; sinon le libellé entier fait le code. Même règle des deux côtés, `extractRefCode` dans `content.js` et `importedHeader` dans `imported-data.js`. Sur la trame LP complète (175 rubriques), les collisions passent de 6 à 2, les deux restantes étant de vrais homonymes de la trame Aviso (« Alimentation en eau » sous Réseaux divers et sous Plomberie sanitaire, « Portails » à la fois groupe et rubrique), qu'aucun code calculé depuis la seule cellule Référentiel ne peut distinguer
- Compatibilité ascendante vérifiée : les blocs à en-tête `GN 12 — Titre` de l'ancien format sont analysés comme avant

## v2.16.0 — 2026-09-02
- **Le bouton "+" reprend le texte déjà saisi dans "Dispositions réalisées"** pour remplir la colonne `content` du tableau Google Sheets. C'est le geste courant : la disposition est rédigée une fois dans Aviso, puis capitalisée en snippet réutilisable d'un clic, sans copier-coller. La cellule vide donne, comme avant, une ligne au contenu à saisir
- **L'infobulle de l'icône bleue affiche le contenu qui sera inséré**, sous le libellé « Ajouter le contenu du snippet "…" » — de quoi le relire avant de cliquer, comme le fait déjà l'icône verte DatAviso. Recalculée au survol, les `{date}` et `{time}` du contenu étant résolus à l'instant présent ; tronquée à 700 caractères, les infobulles natives ne défilant pas (le texte inséré, lui, n'est jamais tronqué)
- Le texte est lu **au moment du clic**, pas à l'affichage de l'icône : la saisie en cours est bien celle qui part dans le tableau. L'infobulle du "+" indique laquelle des deux situations s'applique
- **Un contenu déjà présent dans le tableau n'est jamais remplacé** : si le déclencheur existe déjà avec un contenu, la ligne est renvoyée telle quelle. Le pré-remplissage ne s'applique qu'à une cellule `content` vide
- ⚠️ **Le script Apps Script doit être redéployé en "Nouvelle version"** (API v3) pour que le pré-remplissage fonctionne. Un script resté en v2 crée la ligne sans contenu — dégradé, mais sans perte : le tableau s'ouvre de toute façon sur la cellule à saisir

## v2.15.1 — 2026-08-25
- **Correctif critique : le bouton "+" pouvait effacer tout le tableau Google Sheets.** Si le script Apps Script n'avait pas encore été redéployé, le POST atteignait l'ancienne version, qui commençait par `sheet.clearContents()` avant d'échouer sur le nouveau format de requête. Le tableau était vidé et aucun snippet n'était créé
- **L'extension vérifie désormais le script AVANT d'écrire** : une requête de contrôle (`?probe=append`) confirme que la version déployée gère l'ajout de ligne. Sans cette confirmation, **aucun POST n'est émis** et l'utilisateur est invité à redéployer. La consigne de redéploiement, en v2.15.0, ne reposait que sur la documentation — elle est maintenant appliquée par le code
- **Une synchro ne peut plus remplacer des snippets par un tableau vide** : si le tableau distant revient vide alors que des snippets sont enregistrés localement, la synchro est refusée, la copie locale conservée, et un bandeau d'alerte s'affiche dans la page Paramètres. Un tableau accidentellement vidé ne se propage donc plus à l'extension, qui garde la dernière copie utilisable

## v2.15.0 — 2026-08-25
- **Nouveau bloc "Tableau de référence"** dans Paramètres avancés : deux champs pour pointer l'extension vers un autre tableau Google Sheets (adresse du tableau, et adresse de l'application Web Apps Script qui sert les données). Les adresses sont validées avant enregistrement ; les liens "Ouvrir le tableau" du popup et de la page Paramètres suivent désormais ce réglage au lieu d'être figés
- **Nouvelle icône "+" sur Aviso**, sur les lignes dont le Référentiel n'a **pas** encore de snippet : elle crée la ligne correspondante dans le tableau Google Sheets (déclencheur `/GN13` par exemple, contenu laissé vide), actualise les données de l'extension, puis ouvre le tableau directement sur la cellule à saisir. Une fois le snippet créé, le "+" s'efface au profit de l'icône bleue habituelle
- **`google-apps-script/Code.gs` : le `doPost` destructif est remplacé par un ajout de ligne.** L'ancienne version vidait tout le tableau avant de le réécrire — un héritage d'avant le passage en lecture seule de l'extension, qui ne l'appelait plus. Un appel inattendu aurait effacé tous les snippets. Le nouveau `doPost` n'ajoute qu'une ligne, et renvoie la ligne existante si le déclencheur est déjà présent plutôt que de créer un doublon
- ⚠️ **Le script Apps Script doit être redéployé en "Nouvelle version"** pour que le bouton "+" fonctionne. Sans cela, l'extension signale un script obsolète au lieu d'ouvrir le tableau à tort

## v2.14.1 — 2026-08-24
- **Corrige des lignes perdues à l'import DatAviso.** Le libellé d'un champ était limité à 29 caractères : une ligne comme `Travaux prévus dans le cadre du projet : …` (38 caractères) n'était pas reconnue comme un champ et, s'agissant de la première ligne du bloc, elle n'était rattachée à rien — elle disparaissait purement et simplement. La limite passe à 80 caractères
- **Plus aucune ligne ne peut être perdue** : une ligne située sous un en-tête d'article et non reconnue comme "Libellé : valeur" est désormais conservée telle quelle, sans libellé, au lieu d'être écartée. C'est le vrai correctif — le plafond de longueur n'était que le déclencheur
- Un libellé contenant un point n'est plus traité comme un champ : c'est ce qui distingue un vrai libellé d'une phrase qui se poursuit et comporte un `:`

## v2.14.0 — 2026-08-24
- **Les zones d'import de données s'appellent désormais "DatAviso"** (popup et page Paramètres)
- **L'infobulle de l'icône verte sur Aviso affiche le texte qui sera inséré**, au lieu de "Ajouter les données importées pour…" — de quoi le relire avant de cliquer. Tronquée à 700 caractères, les infobulles natives ne défilant pas ; le texte inséré, lui, n'est jamais tronqué
- **Nouveau bouton "🗑️ Effacer les données DatAviso"** dans le popup, sous "Ou choisir un fichier .txt". Masqué tant qu'il n'y a rien à effacer, et confirmé avant suppression

## v2.13.0 — 2026-08-24
- **Import de données de dossier par article** : depuis le popup de l'icône, collez un texte (ou choisissez un fichier `.txt`) décrivant les articles sous la forme `GN 12 — Titre` suivie de lignes `Libellé : valeur`. Les libellés ne sont pas figés : toute rubrique est reconnue
- **Nouvelle carte "Données de dossier importées"** dans la page Paramètres : aperçu ligne par ligne (un champ par ligne), recherche, suppression article par article ou en bloc
- **Troisième icône sur Aviso** (verte) sur les lignes dont le Référentiel correspond à un article importé : un clic **ajoute** tous ses champs dans "Dispositions réalisées", à la suite du texte existant et **sans le titre de l'article**
- Chaque import **remplace entièrement** les données précédentes, pour éviter que des articles d'un dossier antérieur ne réapparaissent dans Aviso
- Les trois icônes Aviso (snippet, texte réglementaire, données importées) restent commandées par le même réglage "Intégration Aviso"

## v2.12.0 — 2026-08-21
- **L'icône "texte réglementaire" s'affiche désormais même sans snippet correspondant** : elle ne dépend plus que du Référentiel de la ligne. Une ligne "AM 13", sans snippet `/AM13` défini, propose donc quand même le lien vers l'article — consulter le texte reste utile quand il n'y a rien à insérer. L'icône d'insertion, elle, continue de n'apparaître que si un snippet correspond

## v2.11.0 — 2026-08-21
- **Nouveau bouton "texte réglementaire" sur Aviso** : à côté de l'icône d'insertion, une seconde icône (la favicon de sitesecurite.com, même taille de 16 px) ouvre dans un nouvel onglet l'article du règlement de sécurité ERP correspondant au Référentiel de la ligne — par exemple `GN 4` renvoie vers `sitesecurite.com/contenu/_erp/erpgn/gn04a10.php?id=GN4`, ancré directement sur l'article
- Le bouton n'apparaît que si le code correspond à un article ERP connu : un Référentiel hors règlement ERP n'affiche aucun lien, plutôt qu'un lien menant à une page inexistante
- **Renomme le réglage "Afficher l'icône de suggestion" en "Intégration Aviso"** (il commande désormais les deux icônes)
- **Ce réglage est aussi accessible depuis le popup de l'icône** de la barre d'outils, pour l'activer/désactiver en un clic sans ouvrir la page Paramètres

## v2.10.0 — 2026-08-17
- **Les dossiers de "Mes snippets" démarrent désormais fermés par défaut** (auparavant tous ouverts)
- **Ajoute deux boutons discrets "▾ Tout ouvrir" / "▸ Tout fermer"** au-dessus du tableau, pour déplier/replier tous les dossiers en un clic
- **Corrige le contenu ajouté en double** au clic sur l'icône de suggestion Aviso : l'évènement `input` émis après l'insertion réveillait l'expansion automatique de l'extension (qui réécrivait le snippet), et le `<div>` d'affichage, déjà resynchronisé par Aviso, recevait une seconde copie de notre côté

## v2.9.0 — 2026-08-16
- **Agrandit l'icône de suggestion Aviso** : 8px → 16px
- **La case "Afficher l'icône de suggestion" (Intégration Aviso) est de nouveau cochée par défaut**

## v2.8.3 — 2026-08-14
- **Corrige l'icône de suggestion Aviso qui ne s'affichait pas** (carré gris à la place) : `icons/icon16.png` n'était pas déclarée comme ressource accessible aux pages web (`web_accessible_resources`), une exigence de Manifest V3 pour qu'un script de contenu puisse injecter une image de l'extension dans une page. Ajoutée, restreinte à l'application Aviso uniquement

## v2.8.2 — 2026-08-14
- **Retire l'affichage du domaine** dans Paramètres avancés > Intégration Aviso (texte reformulé en "l'application Aviso")
- **Réduit de moitié la taille de l'icône de suggestion** affichée sur Aviso (16px → 8px)

## v2.8.1 — 2026-08-14
- **Supprime toute mention de l'entreprise** dans les titres/commentaires (le domaine technique nécessaire au fonctionnement est conservé)
- **La case "Afficher l'icône de suggestion" (Intégration Aviso) est désormais décochée par défaut** : il faut l'activer explicitement dans Paramètres avancés pour voir apparaître les icônes sur l'application Aviso

## v2.8.0 — 2026-08-14
- **Inverse l'ordre** des liens/boutons en haut de la page Options : "📄 Ouvrir le tableau Google Sheets" apparaît maintenant avant "🔄 Forcer l'actualisation..."
- **Ajoute une case à cocher "Afficher l'icône de suggestion"** (Paramètres avancés > Intégration Aviso), pour activer/désactiver l'icône de suggestion de snippet sur l'application Aviso sans avoir à désinstaller l'extension. Désactivée par défaut ; il faut l'activer explicitement pour voir apparaître les icônes

## v2.7.0 — 2026-08-14
- **Intégration Aviso** : sur `l'application Aviso`, quand le code du "Référentiel" d'une ligne (ex: "GN 4" dans "GN 4 - Procédure d'adaptation...") correspond au déclencheur d'un snippet, une icône apparaît à côté de "Dispositions réalisées". Un clic **ajoute** le contenu du snippet à la suite du texte déjà présent, sans jamais l'écraser. N'a aucun effet en dehors de ce site

## v2.6.1 — 2026-08-04
- **Corrige `Uncaught (in promise) TypeError: Failed to fetch`** dans `background.js` : les alarmes périodiques (`snippet-sync`, `snippet-update-check`) appelaient `pullFromSheet()`/`checkForUpdates()` sans intercepter les rejets, transformant toute erreur réseau normale (hors ligne, Web App ou GitHub temporairement injoignable) en promesse rejetée non gérée. Ces échecs sont désormais interceptés et simplement journalisés dans la console

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
