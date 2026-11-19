# Escale

Escale est un agent autonome qui surveille le prix des vols au départ de Bruxelles et envoie ses alertes sur Telegram. Il tourne seul, toutes les heures, sans serveur à maintenir. Chaque destination est une mission (une « escale ») confiée à un robot : **LisbonIA** pour Lisbonne, puis **PalermoIA** pour Palerme.

## Présentation

Escale répond à un besoin simple : être prévenu au bon moment, sans consulter les sites de réservation chaque jour.

- **Il travaille seul.** GitHub Actions lance un passage toutes les heures. L'agent cherche les prix, les compare à ce qu'il a déjà vu et décide s'il faut prévenir.
- **Il donne le vrai prix.** Les tarifs affichés comprennent le bagage (valise cabine ou valise en soute selon la mission), pas seulement le billet de base.
- **Il croise plusieurs sources.** Les tarifs publics de Ryanair, et Google Flights (via SerpApi) pour les autres compagnies.
- **Il ne fait pas de bruit.** Il écrit seulement quand il y a du nouveau : un record, un prix jugé bas, une source en panne, un rapport hebdomadaire. Le silence veut dire que tout va bien.
- **Il garde sa mémoire dans le dépôt.** Son état et l'historique des prix sont des fichiers de `data/`, enregistrés par le workflow à chaque passage.
- **On peut le regarder travailler.** Une page web, hébergée sur Vercel, montre l'agent sous la forme d'un robot à son bureau, avec ses records, la courbe des prix et le journal de ses passages.

Le projet n'a aucune dépendance à l'exécution : du TypeScript exécuté directement par Node 24, la bibliothèque standard de Node et l'API `fetch`.

## Fonctionnement

### Le cycle d'un passage

1. **Déclenchement.** Le workflow `.github/workflows/veille.yml` démarre à la minute 17 de chaque heure (UTC). Il peut aussi être lancé à la main.
2. **Choix de la mission.** `src/main.ts` appelle `missionActive(date)` (`src/missions.ts`), qui renvoie la mission Lisbonne avant la date de bascule et la mission Palerme ensuite.
3. **Lecture de la mémoire.** L'agent relit son état dans `data/` : records, dernières offres connues, compteurs d'échecs, dernier créneau Google utilisé, dernier rapport.
4. **Recherche des prix.** Il interroge Ryanair (gratuit, sans clé) puis, si le quota le permet, Google Flights via SerpApi. Chaque source est appelée séparément : si l'une échoue, l'autre continue.
5. **Analyse.** Il calcule la meilleure option avec le bagage compris, en comparant les allers-retours et les combinaisons d'un aller et d'un retour séparés.
6. **Décision.** Une fonction pure, sans aucun appel réseau, compare le résultat à la mémoire et produit la liste des messages à envoyer.
7. **Alerte.** Les messages partent sur Telegram par l'API Bot (format HTML, liens de réservation inclus).
8. **Enregistrement.** L'agent réécrit son état et complète son historique (une ligne par passage pour Lisbonne, une ligne par rapport pour Palerme). Le workflow enregistre ensuite `data/` dans le dépôt par un commit, puis le pousse.

### Robustesse

- **Pannes de source.** Chaque échec est compté. L'alerte part au troisième échec d'affilée. Pour Lisbonne, un message confirme ensuite le retour à la normale ; pour Palerme, le rapport suivant indique que Ryanair répond de nouveau.
- **Envoi Telegram raté.** L'état n'avance pas : les alertes sont recalculées et renvoyées au passage suivant. Pour Palerme, le rapport déjà construit est gardé en attente et renvoyé tel quel, sans nouvelle recherche.
- **Mode essai.** Sans `TELEGRAM_BOT_TOKEN` ni `TELEGRAM_CHAT_ID`, l'agent affiche les messages dans la console au lieu de les envoyer, et ne les marque pas comme envoyés.
- **Quota Google protégé.** Avant chaque recherche, l'agent lit le nombre de recherches SerpApi restantes (appel qui ne consomme pas de recherche). Il ne descend jamais sous une réserve de 15.
- **Données fraîches.** Une offre observée il y a plus de 26 heures n'entre plus dans le calcul de la meilleure option.
- **Rien de superflu en mémoire.** Les jetons temporaires renvoyés par Google ne servent que pendant le passage et ne sont jamais enregistrés.
- **Historique toujours conservé.** L'étape d'enregistrement du workflow s'exécute même si le passage a échoué, et deux passages ne peuvent pas tourner en même temps.

### Limites connues

- Les adresses de tarifs Ryanair utilisées ne sont pas une API officielle : elles peuvent changer. L'agent prévient quand il ne reçoit plus de réponse.
- Ryanair n'indique pas combien de places restent à un prix donné : la disponibilité est à revérifier au moment de réserver.
- Les suppléments bagage de Ryanair sont des valeurs fixées dans le code (`src/config.ts` et `src/missions.ts`). Ryanair peut les faire varier.

## Missions

Chaque mission est décrite dans [`src/missions.ts`](src/missions.ts), qui détermine aussi laquelle est active. Chaque mission a son propre passage et ses propres données. Ajouter une destination revient à ajouter une mission et son passage, sans toucher aux autres.

### Lisbonne (LisbonIA) : veille continue jusqu'au départ

LisbonIA surveille un aller-retour Bruxelles → Lisbonne à dates fixes, en vols directs, pour deux adultes.

- **Ryanair à chaque passage**, depuis Charleroi : quatre appels par heure (tous horaires et dans les horaires préférés, pour le groupe et pour une personne).
- **Google Flights au plus une fois par tranche de 4 heures**, depuis Charleroi et Zaventem, à tour de rôle : aller-retour dans les horaires préférés, aller-retour tous horaires, aller simple, retour simple. Quand un record vient de Google, une recherche complémentaire est permise une fois par jour au maximum : le vol retour exact d'un aller-retour, ou le prix pour une seule personne.
- **Horaires préférés** : aller avant 12h, retour après 17h. Tous les vols restent surveillés, mais chaque prix est classé « dans les horaires » ou « hors horaires », avec un record pour chacun.
- **Comparaison complète** : allers-retours, mais aussi un aller et un retour séparés, même chez deux compagnies ou depuis deux aéroports différents.
- **Prix réel** : billet et valise cabine de 10 kg compris, affiché par personne.
- **Places pour deux** : le prix pour une personne est comparé au prix par personne du groupe, pour signaler quand il ne reste sans doute qu'une place au tarif le plus bas.
- **Alertes** : message de démarrage, nouveau record dans les horaires, nouveau record hors horaires, prix jugé bas par Google, prix cible atteint (désactivé par défaut), source en panne puis rétablie.
- **Fin de mission** : le jour du départ, LisbonIA envoie un dernier message et arrête la surveillance.

Mémoire : `data/etat.json` (état) et `data/historique.jsonl` (une ligne par passage).

### Palerme (PalermoIA) : rapport hebdomadaire

PalermoIA cherche chaque semaine la semaine la moins chère pour un séjour de 7 jours à Palerme, pour un adulte, avec un départ entre 30 et 90 jours après le rapport.

- **Ryanair, gratuit** : une seule requête par aéroport de départ (Charleroi) renvoie l'aller-retour de 7 jours le moins cher de la période.
- **Google Flights, une recherche par rapport** : les mêmes dates chez les autres compagnies, en vols directs, depuis Zaventem et Charleroi.
- **Prix réel** : petit sac et valise de 20 kg en soute compris. Quand le supplément d'une compagnie n'est pas connu, son prix est marqué « valise non comprise ». Le supplément Ryanair est encore une estimation, signalée comme telle dans le rapport.
- **Le rapport** : la semaine retenue, les vols, le prix, la comparaison Google et l'évolution depuis le dernier prix connu, avec les liens de réservation.
- **Rythme** : la semaine de rapport change le lundi à 8h, heure de Bruxelles. Un passage qui n'a rien à faire n'écrit rien.
- **Pannes** : sans réponse de Ryanair, pas de rapport (Google a besoin de ses dates). L'agent réessaie à chaque passage et prévient après 3 échecs, une fois par semaine tant que la panne dure.

Mémoire : `data/palerme/etat.json` et `data/palerme/rapports.jsonl` (un rapport par ligne), créés au premier passage de la mission.

### La bascule

À la date de bascule fixée dans `src/missions.ts`, l'agent passe de LisbonIA à PalermoIA sans intervention. Il envoie un message qui annonce le changement et rappelle les quelques actions manuelles à faire (renouveler le jeton GitHub de la page, renommer le bot Telegram). Le premier rapport de Palerme part juste après. La page du robot suit la mission active et prend le nouveau nom.

## Stack technique

- **Langage** : TypeScript exécuté directement par Node 24 (suppression des types à l'exécution, sans étape de compilation). `tsc` sert seulement à la vérification des types.
- **Exécution** : aucune dépendance à l'exécution. Les seules dépendances de développement sont `typescript` et `@types/node`.
- **Tests** : `node:test` et `node:assert`, intégrés à Node.
- **Planification** : GitHub Actions (tâche planifiée toutes les heures).
- **Sources de prix** : tarifs publics de Ryanair, Google Flights via SerpApi.
- **Alertes** : API Bot de Telegram.
- **Page du robot** : HTML, CSS et JavaScript en modules, sans framework. La scène est un SVG animé en CSS, qui respecte le réglage « réduire les animations ».
- **Hébergement de la page** : Vercel (fichiers statiques et fonctions serveur, région Paris).

## Architecture

```text
GitHub Actions (chaque heure, minute 17 UTC)
└── src/main.ts                   choisit la mission active
    ├── src/missions/lisbonne.ts  ou  src/palerme/passage.ts
    │   ├── src/sources/ryanair.ts      tarifs publics Ryanair
    │   ├── src/sources/google.ts       Google Flights via SerpApi, quota vérifié avant chaque recherche
    │   ├── src/analyse.ts              meilleure option (Lisbonne)
    │   ├── src/decisions.ts            messages à envoyer (Lisbonne), logique pure
    │   ├── src/palerme/rapport.ts      rapport hebdomadaire (Palerme), logique pure
    │   ├── src/alertes.ts, src/palerme/messages.ts   texte des messages
    │   └── src/telegram.ts             envoi sur Telegram
    └── data/                     mémoire, enregistrée dans le dépôt par le workflow

Vercel
├── site/                         page statique du robot
└── api/*.js                      fonctions serveur, qui appellent src/robot/
    ├── src/robot/donnees.ts      lit data/ via l'API GitHub (jeton en lecture seule)
    ├── src/robot/direct.ts       interroge Ryanair en direct et compare aux records
    └── src/robot/resume.ts       prépare ce que la page affiche
```

### Séparation des responsabilités

Le code de l'agent sépare ce qui touche le réseau de ce qui décide :

- `src/sources/` parle aux services externes et convertit leurs réponses en offres.
- `src/analyse.ts`, `src/decisions.ts` et `src/palerme/rapport.ts` ne font aucun appel réseau ni aucune écriture. Ils reçoivent des données et renvoient un résultat, ce qui les rend entièrement testables.
- `src/telegram.ts`, `src/stockage.ts` et `src/palerme/stockage.ts` gèrent les effets : envoi des messages et écriture des fichiers.

Le passage Palerme reçoit ses dépendances (recherches, envoi, dossier de données) en paramètre, ce qui permet de le tester de bout en bout sans réseau.

### La page du robot

Quand on ouvre la page, le robot se réveille, va à son bureau, relit ses notes, vérifie Ryanair en direct, regarde les dernières offres Google Flights enregistrées, compare avec ses records, annonce le résultat et retourne se coucher. Chaque étape affichée correspond à une vraie opération. Dessous : les records avec leurs liens de réservation, la courbe des prix et le journal des derniers passages.

La page observe seulement : elle ne lance jamais l'agent, n'interroge jamais Google et n'envoie aucune alerte.

Les fichiers de `api/` sont de simples points d'entrée. Ils appellent les fonctions de `src/robot/http.ts`, écrites au format Web standard (`Request` vers `Response`) et réutilisées telles quelles par le serveur local.

| Route | Méthode | Accès | Rôle |
| --- | --- | --- | --- |
| `/api/sante` | GET | public | indique que le code est chargé et donne le nom du robot actif ; avec `?notes=1`, dit si les données sont lisibles (oui ou non, et la raison technique) |
| `/api/notes` | GET | code requis | résumé de la mémoire : records, courbe, journal, dernières offres ou dernier rapport |
| `/api/ryanair` | POST | code requis | Ryanair interrogé en direct, au plus une fois par minute (cache) |
| `/api/comparer` | POST | code requis | compare les offres trouvées en direct aux records de l'agent |

### Sécurité de la page

- La page est protégée par un code d'accès, envoyé dans un en-tête HTTP. Sans code valide, elle ne montre que le robot endormi.
- Le code est comparé en temps constant (empreintes SHA-256 et `timingSafeEqual`). Le code configuré doit faire au moins 12 caractères, sinon tout accès est refusé.
- Après des erreurs successives, la réponse est retardée de plus en plus (1 s, 2 s, 4 s, puis 8 s au maximum).
- Les offres renvoyées par le navigateur sont validées champ par champ, et leur nombre est limité.
- Le jeton GitHub reste côté serveur. La route publique de santé ne renvoie jamais le contenu des données.
- Toutes les réponses portent l'en-tête `X-Robots-Tag: noindex`.
- Un test vérifie qu'aucune donnée personnelle (dates du voyage, nom) n'apparaît dans les fichiers publics de `site/`.

## Structure du projet

```text
.
├── .github/workflows/veille.yml   passage horaire et enregistrement de data/
├── api/                           fonctions Vercel : sante, notes, ryanair, comparer
├── data/                          mémoire de l'agent, écrite par le workflow
├── site/                          page du robot
│   ├── index.html, style.css
│   └── js/                        scène animée, déroulé d'une visite, notes, fonctions d'affichage
├── src/
│   ├── main.ts                    point d'entrée d'un passage
│   ├── missions.ts                missions, mission active, calendrier des rapports
│   ├── config.ts                  réglages de la mission Lisbonne
│   ├── missions/lisbonne.ts       passage de la mission Lisbonne
│   ├── palerme/                   passage, rapport, messages et mémoire de la mission Palerme
│   ├── sources/                   Ryanair et Google Flights (SerpApi)
│   ├── analyse.ts, decisions.ts   choix de la meilleure option et des alertes
│   ├── alertes.ts, telegram.ts    texte et envoi des messages
│   ├── stockage.ts                lecture et écriture de data/ (Lisbonne)
│   ├── horaires.ts, format.ts, types.ts
│   ├── robot/                     logique serveur de la page : accès, données, Ryanair en direct, résumés
│   └── outils/                    serveur local, essai SerpApi, identifiant Telegram
├── test/                          tests, avec des réponses enregistrées dans test/fixtures/
├── .env.example                   variables de l'agent pour un lancement local
├── vercel.json                    configuration du déploiement Vercel
└── package.json, tsconfig.json
```

## Installation et configuration

### Prérequis

- Node 24 (champ `engines` de `package.json`).
- Un compte SerpApi pour Google Flights (facultatif : sans clé, l'agent travaille avec Ryanair seul).
- Un bot Telegram et l'identifiant de la conversation où il écrit (facultatif : sans eux, l'agent tourne en mode essai).

### Mise en place

```bash
npm install                 # TypeScript et les types Node, utiles pour la vérification des types
cp .env.example .env        # puis renseigner les valeurs
```

1. Mettre dans `.env` la clé SerpApi et le jeton du bot Telegram.
2. Envoyer un premier message au bot dans Telegram, puis lancer `npm run telegram:id` pour obtenir la valeur de `TELEGRAM_CHAT_ID`.
3. Lancer `npm run essai:google` pour vérifier la clé SerpApi. Cet essai consomme 2 recherches.
4. Lancer `npm run veille` pour faire un passage complet en local.

Le fichier `.env` n'est jamais versionné (il figure dans `.gitignore`).

### Variables de l'agent

À mettre dans `.env` en local, et dans les secrets du dépôt GitHub (*Settings → Secrets and variables → Actions*) pour le workflow.

| Variable | Rôle |
| --- | --- |
| `SERPAPI_KEY` | clé SerpApi, pour Google Flights |
| `TELEGRAM_BOT_TOKEN` | jeton du bot Telegram |
| `TELEGRAM_CHAT_ID` | identifiant de la conversation qui reçoit les alertes |

### Variables de la page (Vercel)

À mettre dans Vercel (*Settings → Environments → Production*), en tant que secrets.

- `CODE_ACCES` : le code d'accès de la page, 12 caractères au moins.
- `GITHUB_TOKEN` : un jeton GitHub « fine-grained », limité à ce dépôt, avec la permission **Contents en lecture seule**. Il sert à lire `data/`.
- `GITHUB_DEPOT` (facultatif) : le dépôt à lire, au format `propriétaire/nom`. Par défaut, ce dépôt.

### Variables du serveur local

Le serveur local (`npm run site`) lit les données sur le disque et accepte quelques variables d'essai :

- `CODE_ACCES` : code de la page. Sans lui, un code d'essai local est affiché au démarrage.
- `PORT_LOCAL` : port d'écoute, 4317 par défaut.
- `ESCALE_MAINTENANT` : date simulée (format ISO), par exemple pour voir la mission Palerme avant la bascule.
- `DOSSIER_DONNEES` : dossier de données à utiliser pour la mission Palerme, par exemple `test/fixtures/escale-demo` (données d'exemple).
- `SIMULER_PANNE_RYANAIR=1` : simule une panne de Ryanair.

### Réglages de l'agent

Les réglages de la mission Lisbonne sont dans [`src/config.ts`](src/config.ts) : dates, horaires préférés, aéroports, nombre d'adultes, supplément valise Ryanair, prix cible, baisse minimale pour annoncer un record, nombre d'échecs avant alerte, fréquence et réserve de Google Flights. Ceux de la mission Palerme sont dans [`src/missions.ts`](src/missions.ts) : date de bascule, aéroports, durée du séjour, fenêtre de départ, suppléments valise.

La minute de passage (`passage.minuteUtc` dans `src/config.ts`) doit rester égale à celle du cron du workflow : la page s'en sert pour annoncer le prochain passage.

## Lancer en local et tests

| Commande | Effet |
| --- | --- |
| `npm run veille` | un passage complet de l'agent (mission active selon la date) |
| `npm run site` | serveur local de la page et de ses fonctions, sur <http://localhost:4317> |
| `npm run telegram:id` | affiche l'identifiant de la conversation Telegram |
| `npm run essai:google` | vérifie la clé SerpApi (consomme 2 recherches) |
| `npm test` | lance tous les tests |
| `npm run typecheck` | vérification TypeScript (`tsc`, sans génération de fichiers) |

Les commandes de l'agent, des outils et du serveur local chargent `.env` s'il existe.

Exemple pour voir la page de PalermoIA avec les données d'exemple :

```bash
ESCALE_MAINTENANT=2027-03-16T10:00:00Z DOSSIER_DONNEES=test/fixtures/escale-demo npm run site
```

### Ce que couvrent les tests

Les 126 tests tournent sans service externe : les réponses de Ryanair et de Google sont rejouées depuis `test/fixtures/`, et les appels réseau sont remplacés par des dépendances injectées. Ils couvrent :

- la conversion des réponses Ryanair et Google, l'analyse des offres et les décisions d'alerte ;
- le passage et le rapport de la mission Palerme, y compris les pannes et les envois ratés ;
- le choix de la mission active et le calendrier des rapports ;
- les fonctions serveur de la page : code d'accès, lecture des données, Ryanair en direct, résumés ;
- les fonctions d'affichage de la page, et l'absence de données personnelles dans `site/` ;
- la configuration : le workflow ne se désactive pas tout seul, et la règle de Vercel qui ignore les commits de données est vérifiée dans un dépôt Git jetable.

## Déploiement

### GitHub Actions : l'agent

Le workflow `.github/workflows/veille.yml` :

- se déclenche toutes les heures à la minute 17 (UTC), ou à la main (*Run workflow*) ;
- installe Node 24 et lance `node src/main.ts` avec les trois secrets de l'agent ;
- enregistre `data/` dans le dépôt après chaque passage, même en cas d'échec : commit « données : passage du … UTC » par `github-actions[bot]`, puis `git pull --rebase` et `git push` ;
- dispose de la permission `contents: write` (pour ce commit), d'une limite de 5 minutes et d'un groupe de concurrence qui empêche deux passages simultanés.

Pour l'activer sur un nouveau dépôt, il suffit d'ajouter les secrets `SERPAPI_KEY`, `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`.

### Vercel : la page du robot

Le projet Vercel est relié à ce dépôt. `vercel.json` définit :

- `site/` comme dossier des fichiers statiques ;
- les fonctions `api/*.js`, avec le code de `src/` inclus, une durée maximale de 60 secondes et la région `cdg1` (Paris) ;
- l'en-tête `X-Robots-Tag: noindex` sur toutes les réponses ;
- une règle de déploiement (`ignoreCommand`) : un commit qui ne modifie que `data/` ne déclenche pas de déploiement, alors qu'un commit de code ou une fusion est toujours déployé.

Les fonctions lisent les données à chaque appel dans le dépôt (branche `main`), via l'API GitHub. La page affiche donc le dernier passage sans redéploiement. Les variables `CODE_ACCES` et `GITHUB_TOKEN` sont à configurer dans Vercel (voir plus haut).

### Travailler avec les commits de l'agent

L'agent pousse un commit de données à chaque passage. Avant d'envoyer du code, récupérer ses commits avec `git pull --rebase`, ou une fois pour toutes :

```bash
git config pull.rebase true
```

---

Antonino Lo Bianco · 2026
