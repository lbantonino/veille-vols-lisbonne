# Veille vols Lisbonne ✈️

Un agent qui surveille tout seul le prix des vols entre Bruxelles et Lisbonne pour un semi-marathon, du 5 au 8 mars 2027, et qui m'envoie une alerte Telegram dès qu'un prix bat le record.

## Ce qu'il fait

- **Ryanair toutes les heures** (Charleroi), via les tarifs publics du site.
- **Google Flights** (TAP, Brussels Airlines et les autres) via SerpApi, au plus une fois toutes les 4 heures.
- **Mes horaires en priorité** : aller avant 12h, retour après 17h. Tous les vols restent surveillés, mais chaque prix est classé « dans mes horaires » ou « hors horaires », avec un record pour chacun.
- **Compare tout** : les allers-retours, mais aussi un aller et un retour séparés, même chez deux compagnies ou dans deux aéroports différents.
- **Le vrai prix** : billet et valise de 10 kg compris, affiché par personne pour 2 adultes.
- **Places pour deux** : il compare le prix pour 1 personne et pour 2, et signale quand il ne reste sans doute qu'une place au prix le plus bas.
- **Des alertes utiles** : nouveau record dans mes horaires, nouveau record hors horaires (marqué ⏰), prix jugé bas par Google, prix cible atteint, source en panne. Le silence veut dire que tout va bien.
- **S'arrête tout seul** le jour du départ.

## La page du robot : LisbonIA

Une page web où l'on voit l'agent travailler sous la forme d'un robot, **LisbonIA**, à son bureau, au milieu des pages de prix qu'il surveille.

- Quand je l'ouvre, il se réveille dans son lit, va à son bureau, relit ses notes, **vérifie Ryanair en direct**, regarde les dernières offres Google Flights, compare avec ses records, annonce le résultat, puis retourne se coucher. Chaque étape affichée correspond à une vraie opération.
- Dessous : ses records (dans mes horaires et tous horaires) avec les liens de réservation, la courbe des prix et le journal de ses derniers passages.
- Protégée par un code d'accès : sans lui, la page ne montre que le robot endormi.
- Lisible sur téléphone comme sur ordinateur.
- La page ne lance jamais l'agent, n'interroge jamais Google et n'envoie aucune alerte : elle regarde, elle ne fait rien d'autre.

Elle est hébergée sur **Vercel** (formule gratuite), à partir de ce même dépôt :

```
site/                 la page (HTML, CSS, JavaScript sans framework)
├── js/scene.js       la scène animée du robot
├── js/visite.js      le déroulé d'une visite
├── js/notes.js       records, courbe et journal
└── js/rendu.js       fonctions d'affichage (testées)
api/*.js              les fonctions Vercel, qui appellent src/robot/
src/robot/            code d'accès, lecture des notes de l'agent, Ryanair en direct, comparaison
```

Variables à mettre dans Vercel (*Settings → Environments → Production*), en « Secret » :

- `CODE_ACCES` : le code de la page, 12 caractères au moins ;
- `GITHUB_TOKEN` : un jeton GitHub « fine-grained », limité à ce dépôt, avec **Contents en lecture seule**. Il sert à lire `data/`, qui est privé.

Pour travailler sur la page en local : `npm run site`, puis http://localhost:4317 (avec un code d'essai local affiché au démarrage).

Le robot de l'agent enregistre `data/` toutes les heures : avant d'envoyer du code, récupérer ses commits avec `git pull --rebase` (ou une fois pour toutes : `git config pull.rebase true`). Vercel ne redéploie pas pour un commit de données seules, mais déploie toujours un commit de code ou une fusion.

## Comment ça marche

```
GitHub Actions, toutes les heures
└── src/main.ts                 un passage de l'agent
    ├── sources/ryanair.ts      tarifs Ryanair (aller et retour)
    ├── sources/google.ts       Google Flights via SerpApi, quota vérifié avant chaque recherche
    ├── analyse.ts              meilleure option : aller-retour ou combinaison
    ├── decisions.ts            quels messages envoyer (aucun appel réseau, entièrement testé)
    ├── alertes.ts              texte des messages
    ├── telegram.ts             envoi sur le téléphone
    └── data/                   mémoire de l'agent (etat.json) et historique des prix (historique.jsonl)
```

Après chaque passage, GitHub enregistre `data/` dans le dépôt : l'historique complet des prix est donc conservé.

## 100 % gratuit, sans dépassement possible

| Service | Formule gratuite | Utilisation de l'agent |
|---|---|---|
| SerpApi (Google Flights) | 250 recherches par mois, sans carte bancaire | 186 au maximum, jamais sous une réserve de 15 |
| GitHub Actions (dépôt privé) | 2 000 minutes par mois | environ 744 |
| Vercel (la page du robot) | formule Hobby | quelques appels par visite |
| Ryanair, Telegram | gratuits | sans limite connue |

## Installation

Il faut Node 24.

1. Copier `.env.example` en `.env` et y mettre la clé SerpApi et le jeton du bot Telegram.
2. Envoyer « bonjour » au bot dans Telegram, puis `npm run telegram:id` pour obtenir `TELEGRAM_CHAT_ID`.
3. `npm run essai:google` : vérifie la clé SerpApi (consomme 2 recherches).
4. `npm run veille` : un passage complet en local.
5. Sur GitHub : ajouter `SERPAPI_KEY`, `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` dans *Settings → Secrets and variables → Actions*.

Sans Telegram configuré, l'agent tourne en mode essai et affiche les messages au lieu de les envoyer.

## Réglages

Tout se trouve dans [`src/config.ts`](src/config.ts) : dates, horaires préférés, aéroports, nombre d'adultes, prix de la valise Ryanair, prix cible, fréquence de Google Flights.

## Tests

```bash
npm test          # 71 tests
npm run typecheck # vérification TypeScript
```

## Limites connues

- Les adresses de tarifs Ryanair ne sont pas officielles : elles peuvent changer. L'agent prévient s'il ne reçoit plus de réponse.
- Ryanair ne dit pas combien de places restent à un prix donné : à revérifier au moment de réserver.
- Le prix de la valise Ryanair (36 € par vol, mesuré le 04/11/2026) est fixé dans `src/config.ts` : Ryanair peut le faire varier.

## Stack

TypeScript exécuté directement par Node 24 (sans compilation), aucune dépendance à l'exécution, tests avec `node:test`, GitHub Actions, API Telegram, SerpApi, Vercel. La page : HTML, CSS et JavaScript sans framework, scène en SVG animée en CSS.
