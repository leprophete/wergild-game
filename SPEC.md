# $WERGILD — Cahier des charges & Direction artistique

Nov 11, 2026 · @L'empereur

## Vue d'ensemble

$WERGILD est un memecoin Solana dont le token sert d'armée dans un jeu de conquête en ligne. La carte est une carte ancienne sur parchemin que cinq Bannières médiévales se disputent. Une règle résume tout : **plus tu détiens de tokens, plus ta Bannière s'étend ; si tu vends, ton territoire s'efface.**

**Le nom.** Dans le droit anglo-saxon, le wergild (« prix de l'homme ») était la valeur en argent d'une personne, que l'on payait pour réparer un meurtre. C'est le principe du jeu : chaque token vaut une part de guerrier. Le slogan : « Every token has a price in blood. »

Le jeu crée la demande. On achète pour attaquer, pour défendre et pour faire gagner son clan, pas parce qu'on promet que le prix va monter.

### Objectifs du site

- Comprendre le jeu en moins de 30 secondes, sans lire de règles.
- Rejoindre une faction et poser ses premiers soldats en moins de 2 minutes après connexion du wallet.
- Afficher une carte vivante qui change toutes les heures et qu'on a envie de capturer en écran.

### Périmètre du MVP

| Dans le MVP | Plus tard |
| --- | --- |
| Carte, factions, déploiement et retrait de soldats | Chat intégré (Telegram au début) |
| Connexion wallet et lecture des soldes on-chain | Application mobile native |
| Score horaire, classements, saisons de 14 jours | Récompenses en tokens aux gagnants (à valider juridiquement) |
| Événements programmés par l'admin | Cartes de formes différentes selon les saisons |
| Archives des saisons passées (Hall of Fame) | Badges NFT de vétéran |

### Comment utiliser ce doc avec Claude Code

1. Exporte ce doc en Markdown et place-le à la racine du projet sous le nom `SPEC.md`.
2. Crée un fichier `CLAUDE.md` qui contient une seule ligne : « Lis SPEC.md avant toute tâche. Les règles du jeu et la DA qui y figurent font foi. »
3. Suis le plan de build de la section 8, une étape à la fois, en collant les prompts fournis. Teste chaque étape avant de passer à la suivante.

Les valeurs chiffrées (taille de la carte, soldats par token, plafonds) sont des points de départ. Elles sont toutes regroupées dans un seul fichier de config pour être réglées après les premiers tests.

## Direction artistique : « les Bannières »

Le site a l'allure d'un vieux grimoire de guerre : fond charbon, filets et ornements dorés, parchemin vieilli, et cinq bannières héraldiques verticales. Les blasons et les devises sont 100 % originaux, ce qui donne au projet une identité propre et évite tout problème de droits. Le slogan : **«** Every token has a price in blood. » (FR : « Chaque token a un prix du sang. »)

Règle d'or de lisibilité : **ce qui est jeu est gravé à la plume, ce qui est interface est net.** La carte, les bannières et les événements ont un style ancien. Les boutons, les chiffres et les panneaux restent propres et lisibles.

### Les cinq Bannières

| Bannière (traduction) | Blason | Couleurs de la bannière | Devise | Terre d'origine |
| --- | --- | --- | --- | --- |
| The Goblins (les Gobelins) | Une tête de gobelin à couronne de pointes sur deux dagues croisées | Vert-de-gris et or sur noir | « All that glitters is ours » | The Gnawing Pits : fosses et galeries qui rongent la terre |
| The Changelings (les enfants échangés par les fées) | Un berceau vide sous un croissant de lune | Argent sur vert sylve | « We were never yours » | The Cradle Fen : marais brumeux des fées |
| The Knaves (les Fripons) | Un masque fendu et une clé | Or sur pourpre | « Nothing belongs to anyone » | Knave's Hollow : ville basse nichée dans un creux |
| The Unburied (les Sans-Sépulture) | Un crâne couronné sur deux pelles de fossoyeur croisées | Os sur noir | « No grave can hold us » | The Weeping Barrows : tumulus qui pleurent |
| The Wretches (les Misérables) | Une fourche et une torche croisées | Rouille et encre sur parchemin | « We are the many » | The Burnt Fields : plaines incendiées |

Chaque Bannière a sa personnalité, pour attirer un type de joueur. Les Wretches parlent aux petits holders, les Goblins aux chasseurs de gains rapides, les Changelings aux vétérans patients, les Knaves aux opportunistes, et les Unburied à ceux qui reviennent toujours après un dump. C'est de la saveur, pas des règles différentes : dans le MVP, toutes les Bannières jouent avec les mêmes règles.

### Le design d'une bannière

- **Format** vertical d'environ 1 × 3,5, avec le bas en pointe.
- **Cadre** : double filet doré et ornements en filigrane dans les angles.
- **Haut** : le blason, gravé en style taille-douce.
- **Centre** : la devise en capitales Cinzel, avec un petit ornement au-dessus et en dessous.
- **Bas** : une vignette de la terre d'origine (galeries, forêt, marais…) qui se fond dans le fond.
- **Fonds** : trois styles alternés pour la variété (noir, couleur de la Bannière, parchemin), avec une texture de tissu légère.
- **Animation** : la bannière ondule très doucement, comme un tissu suspendu.

Où on voit les bannières : les 5 suspendues côte à côte sur `/join`, en en-tête de chaque page de Bannière, en miniatures en haut de la carte, et sur le classement, où chaque bannière descend plus ou moins bas selon ses points.

### La carte

- **Support** : l'illustration public/map/world@4x.webp (6344 × 3968), en style gravure, avec un continent entouré de mer. Le canvas tient compte du devicePixelRatio pour rester net sur écran Retina.
- **Cases** : une grille de 48 × 30 cases posée sur l'illustration, visible seulement sur la case survolée. Un masque terre/mer rend la mer et le fleuve injouables ; les ponts sont jouables.
- **Les 5 terres d'origine** : The Goblins au nord-ouest, The Changelings au sud-ouest, The Unburied au nord-est, The Wretches au sud-est, et The Knaves au centre, sur une île du fleuve. Chaque Bannière y a son camp de base.
- **Le fleuve** descend du nord au sud et se sépare en deux bras autour de l'île de Knave's Hollow. Chaque bras a 2 ponts, soit 4 ponts en tout, qui deviennent des points stratégiques naturels. L'île n'est accessible que par ces ponts.
- **Un cartouche orné** dans un coin porte le nom de la saison ; une rose des vents décore le coin opposé.

### Ce que montre chaque case

| Situation | Rendu |
| --- | --- |
| Case neutre | Parchemin nu |
| Case tenue par une Bannière | Style carte ancienne coloriée à la main : frontière lissée en pointillé fin (1,5 px, version foncée de la couleur), bande d'aquarelle d'environ 12 px le long de l'intérieur qui s'estompe vers le centre, pas de trait le long des côtes, jamais sur l'eau ; petit écu sur les grandes zones, simple fanion pour les zones de moins de 3 cases |
| Force de la garnison | Petits pions à l'encre sépia (1 à 3 selon la force), visibles seulement en zoom fort et seulement sur les cases occupées ; chiffre exact au survol et dans le panneau de la case |
| Mes cases | Contour doré |
| Case disputée (écart de moins de 10 % entre les deux premières Bannières) | Petites épées croisées à l'encre sépia, visibles à partir du zoom moyen |
| Case bonus | Une tour de guet dessinée |
| Soldats récemment déplacés (cooldown) | Pions à l'encre brillante, « encore humide », qui sèche en 1 h |

Les détails s'affichent selon le zoom : en vue d'ensemble, seulement les frontières et les écus ; en zoom moyen, les épées des cases disputées ; en zoom fort, les pions. La carte reste lisible à tous les niveaux. L'encre humide montre le cooldown sans compte à rebours.

### Palette

| Rôle | Couleur | Hex |
| --- | --- | --- |
| Fond du site | Charbon | #141210 |
| Carte, panneaux clairs | Parchemin | #E6D8B8 |
| Ombres du parchemin | Parchemin brûlé | #C9B48A |
| Traits de la carte, texte gravé | Encre sépia | #2A1F14 |
| Filets, ornements, mes cases | Or | #C9A24B |
| Alertes, cases disputées | Rouge sang | #8E1B1B |
| The Goblins (sur la carte) | Vert mousse | #7FA83A |
| The Changelings | Bleu brume | #6FA9C8 |
| The Knaves | Lie-de-vin | #7A2E3B |
| The Unburied | Gris ardoise | #6B6F80 |
| The Wretches | Rouge brique | #C4502F |

Sur la carte, les couleurs des Bannières s'appliquent en bandes d'aquarelle le long des frontières (opacité max 0,45, jamais de remplissage plein) avec le mode de fusion `multiply`, comme de l'encre sur du papier. Les cinq teintes sont choisies pour rester distinctes, y compris pour les daltoniens les plus courants ; les hachures servent de second repère.

### Typographies

- **Cinzel** (Google Fonts) : titres, noms de Bannières, devises, en capitales.
- **IM Fell English** : textes d'ambiance et noms de lieux sur la carte.
- **Inter** : toute l'interface (boutons, panneaux, textes d'aide).
- **JetBrains Mono** : les chiffres (soldats, soldes, scores), pour qu'ils restent alignés et lisibles.

### Animations

- **Déploiement** : de petits pions de soldats se dessinent à la plume sur la case (environ 400 ms), puis le lavis se diffuse depuis le centre, comme de l'encre qui boit le papier.
- **Retrait ou vente** : les soldats sont barrés d'un trait de plume et le lavis pâlit.
- **Conquête** : l'ancienne couleur se consume par les bords, puis la nouvelle se diffuse.
- **Fin de saison** : le glas sonne, la carte se roule et reçoit un sceau de cire de la couleur gagnante, puis rejoint les Chroniques.
- **Curseur** : une plume sur la carte, le curseur normal dans l'interface.

Rendu technique : la bibliothèque **rough.js** donne le trait « fait main » aux formes et aux hachures. Elle est seedée par l'identifiant de chaque case pour que le dessin reste identique d'un chargement à l'autre.

### Ornements

Les ornements d'enluminure (or, vert sombre, roses, lunes) sont dans `public/ornaments/`. Les 4 coins (`corner_*.png`) encadrent la carte et sont reliés par un filet doré fin en CSS, sans étirer les images. `border_horizontal.png` décore le haut du panneau « My Army », et `divider_wings.png` sert de séparateur entre les sections. Les ornements restent discrets : la carte et les infos de jeu passent avant.

### Son (désactivé par défaut)

Plume qui gratte au déploiement, roulement de tambour à la conquête, cor de chasse au début d'un événement, et le glas à la fin de chaque saison.

### Ton et vocabulaire

Le ton est celui d'un crieur de place médiéval : court, solennel, avec une pointe d'humour. Tout le site est en anglais : seuls les noms EN s'affichent, les noms FR servent de traduction de travail.

| Concept du jeu | Nom FR | Nom EN |
| --- | --- | --- |
| Faction | Bannière | Banner |
| Zone ×3 du jour | Le Tribut | The Tithe |
| Zone remise à neutre | La Peste | The Plague |
| Cooldowns levés pendant 1 h | La Ruée | The Rush |
| Fin de saison | Le Glas | The Knell |
| Archives | Les Chroniques | The Chronicles |
| Profil joueur | Mon Écu | My Shield |
| Score individuel | Renommée | Renown |

L'onboarding tient en 3 parchemins illustrés : 1) Achète du $WERGILD pour lever ton armée. 2) Prête serment à une Bannière. 3) Conquiers la carte.

## Règles du jeu exactes

Toutes les règles sont calculées côté serveur et sont déterministes : aucun hasard n'intervient dans le jeu. Les valeurs entre crochets sont des paramètres de config.

### 1. Soldats

Un joueur possède 1 soldat par tranche de \[1 000\] $WERGILD détenus dans son wallet. Avec une supply de 1 milliard (standard pump.fun), le maximum théorique est donc de 1 million de soldats. La conversion est linéaire, si bien que découper ses tokens sur plusieurs wallets n'apporte aucun avantage. Vérification avec 1 milliard de tokens : 0,001 soldat par token fonctionne. La bonding curve puis le pool de liquidité détiennent une grosse part de la supply et ne jouent pas, donc il y aura plutôt 300 000 à 700 000 soldats en jeu, soit quelques centaines par case en moyenne. À 100 000 $ de market cap, un soldat vaut environ 0,10 $ et un achat de 20 $ lève 200 soldats. Un wallet de moins de 1 000 tokens a 0 soldat, ce qui reste négligeable.

### 2. Ancienneté et bonus vétéran

Chaque soldat a une force qui dépend de l'ancienneté du wallet :

```latex
\text{force} = \text{soldats} \times \left(1 + \frac{\min(\text{ancienneté en jours},\ 30)}{30}\right)
```

Un soldat vaut donc ×1 à l'achat et ×2 après 30 jours de détention. L'ancienneté est une moyenne pondérée qui se calcule à chaque changement de solde :

- **Achat** : nouvelle ancienneté = ancienne ancienneté × ancien solde / nouveau solde. Les tokens fraîchement achetés diluent l'ancienneté.
- **Vente** : l'ancienneté ne change pas, mais les soldats vendus disparaissent (règle 6).
- **Transfert vers un autre wallet** : le wallet qui reçoit est traité comme un acheteur. Déplacer ses tokens fait donc perdre le bonus vétéran.

### 3. Factions

- Il y a \[5\] factions, les Bannières (voir Direction artistique).
- À la première connexion, le joueur choisit sa faction. Il peut en changer \[1\] fois par saison ; dans ce cas, tous ses soldats repassent en réserve.
- Une faction ne peut pas dépasser \[35\] % de la force totale de tous les joueurs inscrits, réserve comprise. Au-delà, elle est fermée aux nouveaux arrivants jusqu'à repasser sous ce seuil. Cela évite qu'un seul clan écrase la saison.

### 4. Déploiement

- Le joueur répartit sa force entre des cases. Ce qui n'est pas déployé reste en réserve.
- On peut déployer sur une case neutre ou ennemie seulement si elle touche (par un côté) une case tenue par sa faction. Au début de chaque saison, chaque Bannière reçoit un camp de base de 2 × 2 cases dans sa terre d'origine. Ce camp est imprenable : les autres factions ne peuvent pas y déployer, il appartient toujours à sa Bannière et ne rapporte aucun point. Une faction balayée de la carte garde ainsi un point de départ pour revenir.
- Un joueur peut placer au plus \[20 000\] de force sur une même case. Une baleine doit donc s'étaler, et une armée étalée est plus facile à attaquer.
- Des soldats déployés ou déplacés sont bloqués \[1 h\] sur leur case (« encre humide ») avant de pouvoir être retirés.

### 5. Contrôle d'une case et combats

Une case appartient à la faction qui y a la plus grande force totale, en additionnant tous ses membres. En cas d'égalité, la faction qui tenait déjà la case la garde. Attaquer revient simplement à déployer plus de force que le défenseur sur une case adjacente. La résolution est immédiate.

Les soldats d'une faction perdante ne meurent pas. Ils restent sur la case et peuvent la reprendre avec des renforts. Une case peut donc avoir plusieurs factions présentes, mais une seule propriétaire.

### 6. Vente et baisse de solde

Quand le solde d'un joueur baisse sous ce qu'il a déployé, le serveur retire des soldats sur toutes ses cases, au prorata. Il commence par la réserve, puis enlève la même proportion partout. C'est l'animation de rature.

### 7. Score

- À chaque heure pleine UTC, chaque faction gagne 1 point par case tenue. Une case bonus (tour de guet) vaut \[3\] points.
- Pour empêcher d'acheter juste avant le calcul et de revendre juste après, le score d'une heure utilise la force **minimale** observée pour chaque joueur pendant cette heure. Le propriétaire de chaque case pour ce tick est recalculé à partir de ces forces minimales, il n'est pas repris de la carte en direct.
- Score individuel (« Renown ») : les points d'une case sont partagés entre les membres de la faction propriétaire au prorata de leur force sur cette case.

### 8. Saisons

- Une saison dure \[14\] jours et commence le lundi à 17:00 UTC (18:00 à Paris en hiver, 19:00 en été). Toutes les heures du jeu sont stockées et calculées en UTC, puis affichées dans le fuseau du joueur.
- Le vainqueur est la faction qui a le plus de points **cumulés** sur toute la saison. Il ne suffit pas d'être premier à la dernière heure.
- Au glas, la carte est archivée dans les Chroniques, la carte est remise à zéro et tous les soldats retournent en réserve. L'ancienneté est conservée.
- La Bannière gagnante est brodée au Hall of Fame et donne son nom à la carte de la saison suivante. Le top 10 individuel reçoit un badge permanent sur son profil.

### 9. Événements

Les événements sont programmés par l'admin et annoncés au moins \[6 h\] à l'avance sur la carte, ce qui laisse aux factions le temps de s'organiser.

| Événement | Effet | Fréquence |
| --- | --- | --- |
| Le Tribut | Une zone de 3 × 3 cases rapporte ×3 points pendant 24 h | 1 par jour |
| La Peste | Une zone de 4 × 4 cases est remise à neutre ; les soldats qui y étaient retournent en réserve | 1 par saison |
| La Ruée | Les cooldowns sont levés pendant 1 h | 1 par semaine |

### 10. Comptes exclus

Le pool de liquidité, la bonding curve pump.fun, le wallet du développeur et les adresses d'exchanges connues ne peuvent pas jouer. Le wallet du développeur est publié sur la page des règles.

## Pages et écrans

Le site compte 7 pages publiques et 1 page admin. La carte est le cœur du produit : toutes les autres pages y renvoient.

| Page | URL | Contenu | Connexion wallet |
| --- | --- | --- | --- |
| Accueil | `/` | Grimoire fermé « $WERGILD — Season N » qui s'ouvre au clic sur un aperçu en direct de la carte. Onboarding en 3 parchemins, compte à rebours de fin de saison, bouton « Buy $WERGILD » (lien pump.fun ou Jupiter) et bouton « Play » | Non |
| Carte | `/map` | Carte plein écran, zoom et déplacement, panneau latéral (voir ci-dessous) | Pour jouer ; spectateur sinon |
| Choix de faction | `/join` | Les 5 Bannières suspendues côte à côte, avec pour chacun la force, le nombre de membres et un statut « fermé » si la faction dépasse 35 % | Oui |
| Faction | `/banner/[name]` | Territoire, membres, top contributeurs, historique des points de la saison, lien vers le Telegram de la faction | Non |
| Classement | `/ranking` | Factions (points de la saison) et joueurs (Renown), affichés en bannières qui descendent plus ou moins bas selon les points | Non |
| Mon Écu | `/me` | Soldats, force, ancienneté, bonus vétéran, cases tenues, Renown, badges | Oui |
| Chroniques | `/archive` | Les pages des saisons passées en lecture seule, avec la faction gagnante et le top 10 | Non |
| Règles | `/rules` | Les règles en une page illustrée, le wallet du développeur, l'avertissement sur les risques | Non |
| Admin | `/admin` | Création des saisons, programmation des événements, réglage des paramètres, liste des comptes exclus | Wallet admin uniquement |

### L'écran carte en détail

- **En haut** : nom de la saison, temps restant, 5 petites bannières dont la longueur suit le score.
- **À droite (ordinateur) ou en tiroir du bas (mobile)** : « My army » avec force totale, réserve, ancienneté et faction.
- **Clic sur une case** : propriétaire, force de chaque faction présente, mes soldats sur la case, et deux actions « Deploy » et « Withdraw » avec un curseur de quantité.
- **Filtres** : « My cells », « Contested », « Events ».
- **Fil d'activité** discret en bas à gauche, écrit à la plume : « The Goblins took C-14 ».
- **Bouton de capture** : génère une image de la carte avec le logo et le score, prête à partager sur X.

### Parcours d'un nouveau joueur

1. Il arrive sur l'accueil, voit la carte bouger et lit les 3 parchemins d'onboarding.
2. Il clique sur « Play » et connecte son wallet (Phantom, Solflare ou Backpack), puis signe un message gratuit.
3. S'il n'a pas de $WERGILD, il voit « You have 0 soldiers » et un bouton « Recruit » vers l'achat. Il peut quand même choisir une faction.
4. Il choisit sa faction sur `/join`.
5. Sur la carte, les cases où il peut déployer clignotent doucement. Un premier déploiement guidé conclut l'onboarding.

## Stack technique et architecture

La stack repose sur Next.js, Supabase et Helius : trois services avec une offre gratuite pour démarrer, que Claude Code maîtrise bien. Il n'y a aucun smart contract à écrire. Le jeu lit seulement les soldes on-chain, ce qui évite les failles de contrat et les frais d'audit.

| Brique | Choix | Rôle |
| --- | --- | --- |
| Front + API | Next.js 15 (App Router), TypeScript, Tailwind CSS | Pages, API routes, rendu |
| Rendu de la carte | Canvas 2D + rough.js | Dessin « fait main » de 1 440 cases à 60 images/seconde |
| Base de données | Supabase (Postgres) | Joueurs, cases, déploiements, scores |
| Temps réel | Supabase Realtime | La carte se met à jour sans recharger la page |
| Tâches planifiées | Supabase Cron (pg\_cron) | Score horaire, réconciliation des soldes, événements |
| Données Solana | Helius : webhooks sur les transferts du token + RPC | Savoir en quelques secondes qu'un joueur a acheté ou vendu |
| Connexion wallet | Solana Wallet Adapter + Sign-In With Solana | Prouver qu'on possède le wallet, sans transaction ni frais |
| Hébergement | Vercel (ou Cloudflare Pages via OpenNext) | Mise en ligne en un clic depuis GitHub |

&#91;embedded content: architecture · 5 briques, flux d'un achat\]

Le joueur achète sur Solana, Helius prévient le serveur, le serveur relit le solde et applique les règles, puis Supabase diffuse la nouvelle carte à tout le monde.

### Comment un achat devient des soldats

1. Le joueur achète du $WERGILD sur pump.fun ou sur un DEX.
2. Helius détecte le transfert et appelle le webhook `/api/webhooks/helius`.
3. Le serveur relit le solde exact par RPC, met à jour le joueur (solde, ancienneté, force) et applique la règle de vente si le solde a baissé.
4. Supabase Realtime pousse le changement : la carte et le panneau « My army » se mettent à jour chez tout le monde.
5. En filet de sécurité, une tâche toutes les \[10\] minutes relit les soldes de tous les joueurs actifs, au cas où un webhook aurait été manqué.

Toutes les règles du jeu tournent côté serveur. Le navigateur affiche et envoie des demandes, mais ne décide jamais du résultat.

## Modèle de données et API

La base compte 10 tables. La force par case et par faction n'est pas stockée : une vue SQL la calcule à partir des déploiements, ce qui évite les incohérences.

| Table | Champs principaux | Notes |
| --- | --- | --- |
| `players` | wallet (clé), faction\_id, balance, age\_days, force, reserve, faction\_switches, is\_excluded, created\_at | Une ligne par wallet connecté |
| `factions` | id, name, color, base\_x, base\_y | 5 lignes fixes |
| `seasons` | id, number, starts\_at, ends\_at, status, winner\_faction\_id | Une seule saison active à la fois |
| `cells` | id, season\_id, x, y, kind (normal, bonus, bridge, blocked), owner\_faction\_id, contested | 1 440 lignes par saison |
| `deployments` | wallet, cell\_id, season\_id, force, locked\_until | Clé unique (wallet, cell\_id) |
| `balance_history` | wallet, balance, observed\_at | Sert au calcul de la force minimale horaire |
| `score_ticks` | season\_id, faction\_id, hour, points | Une ligne par faction et par heure |
| `player_scores` | season\_id, wallet, renown | Mis à jour à chaque tick |
| `events` | id, season\_id, type, zone (x, y, w, h), announced\_at, starts\_at, ends\_at | Programmés depuis /admin |
| `auth_nonces` | wallet, nonce, expires\_at | Nonce à usage unique, valable 5 min |

Vue `cell_strength` : pour chaque case, la somme de force par faction. Le propriétaire de la case est recalculé dans la même transaction que chaque déploiement ou retrait.

### API

| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/api/auth/nonce` | Renvoie un message à signer |
| POST | `/api/auth/verify` | Vérifie la signature et ouvre une session (cookie httpOnly) |
| GET | `/api/me` | Profil, force, réserve, déploiements |
| POST | `/api/faction/join` | Rejoindre ou changer de faction |
| GET | `/api/map` | État complet de la carte de la saison en cours |
| POST | `/api/deploy` | `{ cellId, amount }` : place de la force depuis la réserve |
| POST | `/api/withdraw` | `{ cellId, amount }` : renvoie de la force en réserve si le cooldown est fini |
| POST | `/api/move` | `{ fromCellId, toCellId, amount }` : déplacement en une action |
| GET | `/api/ranking` | Classements factions et joueurs |
| GET | `/api/archive/[season]` | Page archivée |
| POST | `/api/webhooks/helius` | Réception des transferts (secret vérifié) |
| POST | `/api/admin/*` | Saisons, événements, paramètres (wallet admin) |

Chaque action de jeu (`deploy`, `withdraw`, `move`) passe par une fonction Postgres unique. Elle verrouille la ligne du joueur, vérifie toutes les règles, écrit et recalcule le propriétaire de la case dans une seule transaction.

### Fichier de config

Tous les paramètres entre crochets des règles vivent dans `config/game.ts` : `TOKENS_PER_SOLDIER`, `VETERAN_MAX_DAYS`, `MAX_FORCE_PER_CELL`, `COOLDOWN_MINUTES`, `FACTION_CAP_PCT`, `SEASON_DAYS`, `BONUS_CELL_POINTS`, `GRID_W`, `GRID_H`, `TOKEN_MINT`, FACTION\_TELEGRAM\_LINKS, `EXCLUDED_WALLETS`.

## Anti-triche et sécurité

Le risque principal est qu'un même token compte deux fois. Les règles du jeu en bloquent déjà l'essentiel ; ce tableau liste les attaques restantes et leur parade.

| Attaque | Parade |
| --- | --- |
| Déployer avec le wallet A, envoyer les tokens au wallet B, redéployer avec B | Le webhook retire les soldats de A en quelques secondes. Chaque déploiement relit aussi le solde on-chain avant d'écrire. Et B arrive sans ancienneté, donc avec une force divisée par deux au mieux |
| Acheter juste avant le calcul du score, revendre juste après | Le score utilise la force minimale de l'heure écoulée |
| Spammer des déplacements pour harceler une faction | Cooldown de 1 h et limite de \[30\] actions par minute et par wallet |
| Envoyer deux déploiements en même temps pour dépasser sa réserve | Verrou sur la ligne du joueur dans la transaction Postgres |
| Rejouer une signature volée | Nonce à usage unique, expiré au bout de 5 minutes |
| Envoyer de faux webhooks | Secret partagé vérifié, et le solde est toujours relu par RPC : le contenu du webhook n'est jamais cru tel quel |
| Lire ou modifier la base depuis le navigateur | Row Level Security activée sur toutes les tables, lecture publique seulement sur la carte et les classements. Le navigateur n'a aucun droit d'écriture : aucune politique INSERT, UPDATE ou DELETE pour les rôles anon et authenticated. Toutes les écritures passent par l'API serveur, si bien qu'aucune colonne (force, réserve, is\_excluded…) ne peut être modifiée depuis l'extérieur. Il n'y a pas de colonne is\_admin : l'admin est défini par une variable d'environnement côté serveur. La clé « service » de Supabase n'existe que côté serveur |
| Faire jouer le pool de liquidité ou un exchange | Liste d'adresses exclues dans la config |

### Bonnes pratiques à imposer à Claude Code

- Aucune clé secrète dans le code : tout passe par des variables d'environnement (`.env.local` en local, réglages Vercel en ligne). Le fichier `.env.local` est dans `.gitignore`.
- Toute entrée d'API est validée avec la bibliothèque Zod.
- Des tests automatiques couvrent chaque règle du jeu : adjacence, plafond par case, cooldown, vente au prorata, égalité, force minimale horaire.
- Avant le lancement, demande à Claude Code une revue de sécurité complète du projet (prompt fourni à l'étape 9 du plan).

## Plan de build pour Claude Code

Le build se découpe en 9 étapes. Chacune se teste avant de passer à la suivante. Les étapes 1 à 7 n'ont pas besoin du token : elles utilisent un token de test, si bien que le jeu peut être terminé avant le lancement. Lance une nouvelle conversation Claude Code à chaque étape et colle le prompt tel quel.

**Avant de commencer** : installe Node.js 20+, Git et Claude Code. Crée un dossier `wergild-game`, places-y `SPEC.md` et `CLAUDE.md` (section 1), puis crée un compte gratuit sur Supabase, Helius, Vercel et GitHub.

### Étape 1 : squelette et DA de la carte (fausses données)

```text
Lis SPEC.md. Crée un projet Next.js 15 (App Router, TypeScript, Tailwind) avec le fichier config/game.ts décrit dans la spec. Construis uniquement la page /map avec des données factices générées localement : une carte ancienne sur parchemin 48x30 cases dessinée en Canvas 2D avec rough.js (seedé par id de case), les 5 terres d'origine dessinées à la plume (fosses des Goblins, marais brumeux des Changelings, creux des Knaves, tumulus des Unburied, champs brûlés des Wretches), le fleuve nord-sud qui se sépare en deux bras autour de l'île centrale de Knave's Hollow, avec 2 ponts par bras, le cartouche et la rose des vents, le lavis des 5 couleurs de Bannière en multiply à 50 % d'opacité, la densité des hachures selon la force, la bordure pointillée rouge des cases disputées, les tours de guet des cases bonus, l'encre humide. Ajoute les 5 bannières miniatures en haut. Respecte exactement la palette, les typos et le design des bannières de la section Direction artistique. Zoom, déplacement et clic sur une case qui ouvre le panneau latéral. Doit rester fluide sur mobile.
```

### Étape 2 : base de données Supabase

```text
Lis SPEC.md. Crée les migrations Supabase pour les tables, la vue cell_strength et les politiques Row Level Security décrites dans la section Modèle de données. Ajoute un script de seed qui crée les 5 factions, une saison de test et ses 1440 cases (camps de base, cases bonus, 4 ponts, fleuve infranchissable ailleurs, terres d'origine). Branche /map sur ces vraies données en lecture, avec Supabase Realtime.
```

### Étape 3 : connexion wallet

```text
Lis SPEC.md. Ajoute Solana Wallet Adapter (Phantom, Solflare, Backpack) et Sign-In With Solana : /api/auth/nonce et /api/auth/verify avec nonce unique de 5 minutes, session en cookie httpOnly. Crée la page /join (choix de faction avec plafond de 35 %) et la page /me. Valide toutes les entrées avec Zod.
```

### Étape 4 : lecture des soldes on-chain

```text
Lis SPEC.md. Implémente la synchronisation des soldes avec Helius pour le mint TOKEN_MINT de la config : webhook /api/webhooks/helius (secret vérifié, solde toujours relu par RPC), calcul de l'ancienneté pondérée et de la force selon les règles 1, 2 et 6, historique dans balance_history, tâche de réconciliation toutes les 10 minutes. Pour les tests, utilise un token SPL que je créerai sur devnet.
```

### Étape 5 : déployer, retirer, déplacer

```text
Lis SPEC.md. Implémente /api/deploy, /api/withdraw et /api/move via une fonction Postgres transactionnelle unique qui verrouille le joueur et applique les règles 4 et 5 (adjacence, plafond par case, cooldown, recalcul du propriétaire, égalité au défenseur). Relis le solde on-chain avant chaque déploiement. Ajoute les animations de la DA (pions dessinés à la plume, lavis qui se diffuse, bords qui se consument, trait de plume). Écris des tests pour chaque règle.
```

### Étape 6 : score et classements

```text
Lis SPEC.md. Implémente le tick de score horaire avec pg_cron (règle 7, force minimale de l'heure, cases bonus, Renown individuel), la page /ranking et la page de chaque Bannière /banner/[name] : bannière et vignette de la terre d'origine en en-tête, territoire actuel (mini-carte et nombre de cases), membres, top 10 des contributeurs en Renown, historique des points de la saison en graphique, et lien Telegram de la faction (FACTION_TELEGRAM_LINKS dans la config). Affiche le score des factions en haut de /map (5 bannières miniatures) et dans le panneau latéral. Toutes les heures en UTC. Ajoute des tests.
```

### Étape 7 : saisons, événements, archives, admin

```text
Lis SPEC.md. Implémente le cycle de saison (règle 8 : glas, archivage, reset, retour en réserve, Hall of Fame, badges), les événements Le Tribut, La Peste et La Ruée (règle 9, annoncés 6 h avant), la page /archive et la page /admin réservée au wallet admin défini en variable d'environnement. Animation de carte roulée et scellée à la cire.
```

### Étape 8 : accueil, onboarding, finitions

```text
Lis SPEC.md. Crée la page d'accueil (grimoire qui s'ouvre sur la carte en direct, onboarding en 3 parchemins, compte à rebours), la page /rules illustrée avec l'avertissement sur les risques, le parcours guidé du premier déploiement, le bouton de capture de carte pour X et les sons optionnels. Vérifie le rendu mobile de chaque page.
```

### Étape 9 : revue de sécurité et mise en ligne

```text
Fais une revue de sécurité complète du projet en te basant sur la section Anti-triche de SPEC.md : RLS, secrets, validation des entrées, transactions, rate limiting, webhooks. Ensuite, attaque le site de l'extérieur comme le ferait un hacker : avec seulement l'URL et la clé publique Supabase, essaie de lire, créer, modifier et supprimer des lignes dans chaque table et chaque colonne, d'appeler chaque route API sans session ou avec la session d'un autre wallet, et de dépasser les règles du jeu. Lance aussi les Security Advisors de Supabase. Corrige tout ce que tu trouves, puis lance tous les tests. Prépare ensuite le déploiement sur Vercel et liste-moi les variables d'environnement à renseigner.
```

## Lancement du token et points juridiques

Le token se lance seulement quand le jeu tourne déjà, après une saison 0 de test. Le premier acheteur doit pouvoir jouer dans la minute.

### Séquence de lancement

1. **Saison 0 (7 jours, sans token)** : le jeu tourne sur devnet avec des « soldats d'entraînement » distribués aux testeurs. Tu corriges les bugs, règles les paramètres et récupères des captures de la carte.
2. **Jour J** : création du token sur pump.fun. Pas de presale. Le dev buy est petit et annoncé publiquement, avec l'adresse du wallet.
3. **Jour J + 5 min** : le mint est renseigné dans la config, l'adresse de la bonding curve est ajoutée aux comptes exclus, et le site est redéployé.
4. **Jour J + 24 h** : début de la saison 1. Les premiers acheteurs ont 24 h pour choisir leur faction et s'organiser.
5. **Migration vers un DEX** (quand la bonding curve est complète) : ajoute l'adresse du nouveau pool aux comptes exclus.

Utilisation des frais créateur : annonce publiquement qu'ils financent l'hébergement et le développement des saisons suivantes. C'est cohérent avec le projet et rassurant pour les acheteurs.

### Points juridiques à vérifier

Je ne suis pas avocat. Ces points sont des pistes à creuser, pas des conclusions.

- **Jeux d'argent (ANJ)** : en France, un jeu qui combine sacrifice financier, espérance de gain et intervention du hasard peut être qualifié de jeu d'argent. Le design a donc été pensé sans hasard et sans récompense monétaire (Hall of Fame et badges uniquement). Avant d'ajouter des récompenses en tokens, il faut vérifier ce point.
- **MiCA** : le règlement européen sur les crypto-actifs peut imposer des obligations, comme un livre blanc, à celui qui offre un crypto-actif au public. Il faut vérifier si un lancement sur pump.fun te qualifie d'offreur et si une exemption s'applique.
- **Communication** : ne jamais présenter le token comme un investissement ni promettre de hausse. La page /rules affiche clairement que le token n'a pas de valeur garantie et que l'on peut tout perdre.
- **CGU et confidentialité** : le site stocke des adresses de wallet. Il faut des conditions d'utilisation et une politique de confidentialité conformes au RGPD.
- **Nom** : vérifier que « $WERGILD » et le nom du site ne reprennent pas une marque existante avant de dépenser du temps sur l'identité.

### Questions ouvertes

- Soldats par token : 0,001 est validé. Le plafond de 20 000 de force par case reste à ajuster après la saison 0.
- Noms des 5 Bannières : validés (The Goblins, The Changelings, The Knaves, The Unburied, The Wretches). Reste à vérifier qu'aucun ne reprend une marque existante.
