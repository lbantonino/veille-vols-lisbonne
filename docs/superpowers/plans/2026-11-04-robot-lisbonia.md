# Robot LisbonIA, plan de construction

> **Pour les agents qui exécutent ce plan :** compétence requise : superpowers:subagent-driven-development (recommandée) ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** une page web, hébergée sur Vercel et protégée par un code, où le robot LisbonIA se réveille. Il vérifie Ryanair en direct, compare avec les données de l'agent de veille, annonce le résultat, puis retourne se coucher.

**Architecture :**
- **Page :** statique (`site/`), en HTML, CSS et JavaScript ES modules, sans framework.
- **Fonctions Vercel :** des fichiers JavaScript minces dans `api/`, qui importent la logique serveur en TypeScript de `src/robot/`. Node 24 retire les types à l'exécution.
- **Réutilisation :** `src/robot/` réutilise le code de l'agent (`config.ts`, `sources/ryanair.ts`, `analyse.ts`, `decisions.ts`) et lit `data/` dans le dépôt privé par l'API GitHub.
- **Agent :** il ne change pas.

**Technologies :** Node 24 (TypeScript sans compilation), `node:test`, Vercel Hobby (fonctions Node au format Web `Request` → `Response`), API GitHub Contents, SVG et CSS pour la scène.

**Document de conception :** `docs/superpowers/specs/2026-11-04-robot-lisbonia-design.md`. La maquette, option A, se trouve dans `docs/superpowers/specs/2026-11-04-robot-lisbonia-maquette.html`.

## Contraintes globales

- **Gratuité :** 0 €. La page ne lance aucun workflow GitHub et n'appelle jamais SerpApi ni Telegram. Ryanair reçoit au plus 4 appels par visite, et un cache de 60 s s'applique côté serveur.
- **Code d'accès :** il vient de la variable `CODE_ACCES` et fait au moins 12 caractères, sinon tout accès est refusé. Le navigateur l'envoie dans l'en-tête `x-code-acces` et le garde dans `localStorage` sous la clé `lisbonia-code`.
- **Sans code valide :** les fonctions ne renvoient aucune donnée personnelle (dates, prix, vols, journal).
- **Secrets :** le jeton GitHub (`GITHUB_TOKEN`, « fine-grained », Contents en lecture seule sur ce dépôt) ne sort jamais du serveur. Claude ne saisit ni code, ni jeton, ni clé : Antonino les met lui-même dans Vercel.
- **Fichiers servis :** Vercel ne sert que `site/`. `data/` ne doit jamais être accessible publiquement.
- **Affichage :** la page est lisible et utilisable à 375 px de large comme sur ordinateur.
- **Langue :** tout le texte est en français, en tutoyant Antonino.
- **Agent inchangé :** l'agent de veille reste identique, et `npm test` et `npm run typecheck` passent à chaque tâche.
- **Nouvelle visite :** au chargement de la page, ou au retour sur l'onglet après au moins 10 minutes d'absence. Une seule visite à la fois.
- **Prochain passage :** annoncé seulement si les passages automatiques sont réguliers. Le cron est `'17 * * * *'`, en UTC.
- **Commits :** sans aucune ligne de co-auteur ni mention de Claude.

## Points de vigilance

1. **Agent tout jeune :** historique vide ou d'une seule ligne, `records` à `null`. La page s'affiche quand même, avec une courbe « pas encore de données », un journal vide et des écrans vides.
2. **Ryanair sans tarif ou en erreur :** tableau `fares` vide ou réponse 409. La comparaison marche avec Google seul, la conclusion le dit, et le robot retourne se coucher sans planter.
3. **Code d'accès absent, faux ou trop court :** réponse 401 sans donnée. Le formulaire du code revient et l'ancien code est oublié.
4. **Double visite :** onglet rechargé ou retour rapide sur l'onglet. Jamais deux visites en parallèle, et jamais deux appels Ryanair pour la même visite.
5. **Après le 5 mars 2027 :** le robot est « en vacances ». Aucun appel Ryanair, et la page affiche le dernier record et le journal.

---

### Tâche 1 : socle Vercel et preuve que les fonctions importent le TypeScript de l'agent

**Fichiers :**
- Créer :
  - `vercel.json`
  - `api/sante.js`
  - `src/robot/http.ts`
  - `site/index.html` (provisoire)
  - `test/robot/http.test.ts`
- Modifier :
  - `package.json` (`"engines": { "node": "24.x" }`, script `"test": "node --test \"test/**/*.test.ts\""`, inchangé, qui couvre `test/robot/`)
  - `.gitignore` (ajouter `.vercel/`)

**Interfaces :**
- Produit : `gererSante(): Response`. Elle répond en JSON `{ ok: true, configChargee: true }`, sans aucune date ni aucun prix.

- [ ] **Étape 1 : test.** Dans `test/robot/http.test.ts`, le test `santé : répond sans donnée personnelle` vérifie trois choses :
  - `res.status === 200` ;
  - `await res.json()` vaut `{ ok: true, configChargee: true }` ;
  - `JSON.stringify(corps)` ne contient pas `2027`.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : le test échoue, module introuvable.
- [ ] **Étape 3 :** `src/robot/http.ts` exporte `gererSante()`. Il importe `voyage` depuis `../config.ts` pour prouver l'import, avec `configChargee: typeof voyage.aller === 'string'`, et ajoute `cache-control: no-store`.
- [ ] **Étape 4 :** `api/sante.js` contient exactement :

  ```js
  import { gererSante } from '../src/robot/http.ts';
  export function GET() { return gererSante(); }
  ```

- [ ] **Étape 5 :** `vercel.json` contient :

  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "outputDirectory": "site",
    "ignoreCommand": "git diff --quiet HEAD^ HEAD -- . ':(exclude)data'",
    "functions": { "api/*.js": { "includeFiles": "src/**" } },
    "headers": [{ "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex" }] }]
  }
  ```

  `site/index.html` est une page provisoire : « LisbonIA arrive bientôt ».
- [ ] **Étape 6 :** `npm test && npm run typecheck`. Résultat attendu : tout passe, les 24 anciens tests et le nouveau.
- [ ] **Étape 7 :** commit `Socle Vercel : page provisoire et fonction santé`, puis push.
- [ ] **Étape 8 (Antonino, guidé par Claude) :**
  1. Sur vercel.com, importer le dépôt `lbantonino/veille-vols-lisbonne`, avec le preset « Other », la racine du dépôt et aucune commande de build.
  2. Créer un jeton GitHub « fine-grained » : dépôt `veille-vols-lisbonne` seulement, permission Contents en lecture seule.
  3. Dans Vercel, ajouter les variables `CODE_ACCES` (12 caractères au moins, choisis par lui) et `GITHUB_TOKEN`.
- [ ] **Étape 9 : vérification en ligne.**
  - `curl -s https://<projet>.vercel.app/api/sante` doit renvoyer `{"ok":true,"configChargee":true}`.
  - `curl -s -o /dev/null -w "%{http_code}" https://<projet>.vercel.app/data/etat.json` doit renvoyer `404`.
- [ ] **Étape 10, seulement si l'étape 9 échoue.**
  - Si Vercel ne reconnaît pas l'export `GET`, essayer d'abord `export default { fetch(request) { … } }` dans les fichiers `api/*.js`.
  - Si c'est l'import `.ts` qui échoue, passer à la Build Output API.
  1. Ajouter `esbuild` en dépendance de développement.
  2. Écrire un script `src/outils/construire-vercel.ts` qui regroupe chaque `api/*.js` dans `.vercel/output/functions/api/<nom>.func/index.mjs`, avec `.vc-config.json` à `{ "runtime": "nodejs24.x", "handler": "index.mjs", "launcherType": "Nodejs" }`, et copie `site/` dans `.vercel/output/static/`.
  3. Le brancher comme « Build Command » dans `vercel.json`, puis refaire l'étape 9.

### Tâche 2 : code d'accès

**Fichiers :**
- Créer : `src/robot/acces.ts` et `test/robot/acces.test.ts`.
- Modifier : `src/robot/http.ts`.

**Interfaces :**
- Produit :
  - `codeValide(fourni: string | null, attendu: string | undefined): boolean`. Elle renvoie `false` si `attendu` est absent ou fait moins de 12 caractères. Elle compare les empreintes SHA-256 avec `crypto.timingSafeEqual`.
  - `delaiApresEchecs(echecs: number): number`, en millisecondes : `0` pour 0 échec, puis `min(1000 × 2^(echecs−1), 8000)`.
  - Dans `http.ts`, `verifierAcces(request: Request, env: EnvRobot): Promise<Response | null>`. Elle renvoie `null` si le code est bon. Sinon, elle attend `delaiApresEchecs(n)` et renvoie une 401 `{ "erreur": "code" }`. Le compteur `n` reste en mémoire du module, est remis à 0 en cas de succès et oublié après 15 min sans échec.
  - `interface EnvRobot { CODE_ACCES?: string; GITHUB_TOKEN?: string; GITHUB_DEPOT?: string; DONNEES_LOCALES?: string }`.

- [ ] **Étape 1 : tests.**
  - `codeValide('code-tres-long-1', 'code-tres-long-1') === true`.
  - Faux pour `'autre-code-long1'`, `null` ou `''`.
  - `codeValide('court', 'court') === false`, car moins de 12 caractères.
  - `codeValide('x'.repeat(12), undefined) === false`.
  - `delaiApresEchecs(0) === 0`, `(1) === 1000`, `(3) === 4000` et `(10) === 8000`.
  - Dans `http.test.ts` : une requête sans en-tête donne une 401 dont le corps ne contient pas `2027`.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 3 :** implémenter `acces.ts` et `verifierAcces`.
- [ ] **Étape 4 :** `npm test && npm run typecheck`. Résultat attendu : tout passe.
- [ ] **Étape 5 :** commit `Code d'accès de la page du robot`.

### Tâche 3 : lire les données de l'agent et préparer le résumé de la page

**Fichiers :**
- Créer :
  - `src/robot/donnees.ts`
  - `src/robot/resume.ts`
  - `api/notes.js`
  - `test/robot/resume.test.ts`
  - `test/robot/donnees.test.ts`
  - `test/fixtures/historique-exemple.jsonl` (5 lignes copiées de `data/historique.jsonl`, dont une avec `records.horaires` plus bas que la précédente)
  - `test/fixtures/etat-exemple.json` (copie de `data/etat.json`)
- Modifier : `src/robot/http.ts` et `src/config.ts`. Dans la config, ajouter `export const passage = { minuteUtc: 17 };` avec un commentaire qui renvoie au cron de `.github/workflows/veille.yml`.

**Interfaces :**
- Produit :
  - `interface LigneHistorique { le: string; meilleurDansHoraires: number | null; meilleurTousHoraires: number | null; records?: { horaires: number | null; tous: number | null }; pannes: string[] }`
  - `lireDonneesAgent(env: EnvRobot, fetchImpl?: typeof fetch): Promise<{ etat: Etat; historique: LigneHistorique[] }>`. Si `env.DONNEES_LOCALES === '1'`, la fonction lit `data/` sur le disque. Sinon, elle appelle `GET https://api.github.com/repos/${env.GITHUB_DEPOT ?? 'lbantonino/veille-vols-lisbonne'}/contents/data/<fichier>?ref=main` avec `Authorization: Bearer <GITHUB_TOKEN>` et `Accept: application/vnd.github.raw+json`. Les lignes vides et illisibles de l'historique sont ignorées, et l'état passe par la même fusion avec `etatInitial()` que `lireEtat`.
  - `interface LigneJournal { le: string; dansHoraires: number | null; tous: number | null; record: boolean; pannes: string[] }`. `record` est vrai quand `records.horaires` ou `records.tous` baisse par rapport à la ligne précédente.
  - `interface PointCourbe { le: string; dansHoraires: number | null; tous: number | null }`
  - `interface Resume { voyage: { aller: string; retour: string; horaires: string }; records: Etat['records']; dernierPassage: string | null; prochainPassage: string | null; journal: LigneJournal[]; courbe: PointCourbe[]; ryanair: { offres: Offre[]; vuLe: string | null }; google: { offres: Offre[]; vuLe: string | null }; echecs: Etat['echecs']; termine: boolean }`
  - `resumer(etat: Etat, historique: LigneHistorique[], maintenant: Date): Resume`. Le journal contient les 10 dernières lignes, la plus récente d'abord. La courbe garde au plus 240 points : au-delà, l'historique est découpé en paquets consécutifs dont on garde le minimum de chaque série. `termine` vaut `maintenant` (au format AAAA-MM-JJ) `>= voyage.aller`. `vuLe` est le plus récent `observeLe` de la source.
  - `passagesReguliers(historique: LigneHistorique[], maintenant: Date): boolean`. Elle est vraie si les 3 derniers passages sont espacés de 75 min au plus et que le dernier date de moins de 75 min. `prochainPassage` est alors la prochaine heure HH:17 UTC après `maintenant`, au format ISO. Sinon, il vaut `null`.
  - `gererNotes(request: Request, env: EnvRobot, deps?: { lire?: typeof lireDonneesAgent; maintenant?: () => Date }): Promise<Response>`. Elle répond en GET, protégée par code, avec le corps `Resume`. En cas d'échec de lecture, elle renvoie 502 `{ "erreur": "donnees" }`.

- [ ] **Étape 1 : tests (avec les fixtures).**
  - `resumer` renvoie un journal de 5 éléments, avec `journal[0].le` égal au `le` de la dernière ligne, et `record: true` sur la ligne où le record a baissé.
  - Avec 300 lignes générées, `courbe.length <= 240`.
  - Avec `historique: []` et `records` vides (point de vigilance 1), le journal et la courbe sont vides, `dernierPassage === null` et aucune exception n'est levée.
  - `termine` vaut `true` pour `maintenant = 2027-03-05T08:00Z` et `false` pour `2026-11-05`.
  - `passagesReguliers` : vrai pour 3 passages à 20:17, 21:17 et 22:17 avec `maintenant` à 22:40 ; faux avec un trou de 3 h.
  - `prochainPassage` vaut `2026-11-04T23:17:00.000Z` pour `maintenant` à 22:40Z.
  - `lireDonneesAgent` avec un `fetchImpl` simulé envoie les bons en-têtes et la bonne adresse, et ignore une ligne `{cassé`.
  - `gererNotes` : sans code, 401 ; avec le code et des données injectées, 200 et un `Resume`.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 3 :** implémenter `donnees.ts`, `resume.ts`, `gererNotes` et `api/notes.js` (une fonction `GET(request)` qui appelle `gererNotes(request, process.env)`).
- [ ] **Étape 4 :** `npm test && npm run typecheck`. Résultat attendu : tout passe.
- [ ] **Étape 5 :** commit `Lecture des données de l'agent pour la page du robot`.

### Tâche 4 : vérification Ryanair en direct et comparaison

**Fichiers :**
- Créer :
  - `src/robot/direct.ts`
  - `api/ryanair.js`
  - `api/comparer.js`
  - `test/robot/direct.test.ts`
- Modifier : `src/robot/http.ts`.

**Interfaces :**
- Consomme :
  - `chercherRyanair(maintenant: Date): Promise<Offre[]>` (agent) ;
  - `fusionnerOffres` et `choisir` (`src/analyse.ts`) ;
  - `bat` (`src/decisions.ts`) ;
  - `alertes` et `fraicheurMaxHeures` (`src/config.ts`) ;
  - `lireDonneesAgent` (tâche 3).
- Produit :
  - `verifierRyanair(maintenant: Date, chercher?: typeof chercherRyanair): Promise<{ offres: Offre[]; verifieLe: string; depuisCache: boolean }>`, avec un cache de module de 60 000 ms.
  - `interface Comparaison { choix: Choix; nouveauRecord: { horaires: boolean; tous: boolean }; records: { horaires: number | null; tous: number | null }; googleVuLe: string | null }`
  - `comparerEnDirect(etat: Etat, offresRyanair: Offre[], maintenant: Date): Comparaison`. Elle fusionne avec `fusionnerOffres(etat.dernieresOffres, offresRyanair, ['ryanair:aller', 'ryanair:retour'], maintenant, fraicheurMaxHeures)`, choisit avec `choisir`, et calcule les records avec `bat(etat.records.x, choix.x, { baisseMinimale: alertes.baisseMinimale, prixCible: null, echecsAvantAlerte: 3 })`.
  - `lireOffres(corps: unknown): Offre[]`. Elle ne garde que les objets dont `source === 'ryanair'`, `sens` vaut `'aller'` ou `'retour'`, avec un `prixParPersonne` fini et positif, et au plus 20 offres.
  - `gererRyanair(request, env, deps?)` : en POST, protégée. Elle répond 200 `{ offres, verifieLe, depuisCache }`, ou 502 `{ "erreur": "ryanair", "message": string }`.
  - `gererComparer(request, env, deps?)` : en POST, protégée, avec le corps `{ offres: Offre[] }`. Elle répond 200 `Comparaison`. Si `termine`, elle répond 409 `{ "erreur": "termine" }` sans rien appeler, et `gererRyanair` fait de même.

- [ ] **Étape 1 : tests.**
  - Deux appels à `verifierRyanair` à moins de 60 s n'appellent `chercher` qu'une fois, et le second a `depuisCache: true`. À 61 s, un nouvel appel est fait.
  - `comparerEnDirect` avec l'état d'exemple et des offres Ryanair dans les horaires à 50 € par jambe donne `nouveauRecord.horaires === true` et `choix.horaires.prixParPersonne === 100`.
  - Avec `offresRyanair = []`, le choix vient de Google seul (point de vigilance 2).
  - `lireOffres([{ source: 'google' }, { source: 'ryanair', sens: 'aller', prixParPersonne: -3 }])` renvoie `[]`.
  - `gererRyanair` avec un `chercher` qui lance `Error('Ryanair a répondu 409 pour CRL')` renvoie 502 `{ erreur: 'ryanair' }`.
  - Après la date de départ, la réponse est 409 `termine` et `chercher` n'est jamais appelé (point de vigilance 5).
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 3 :** implémenter `direct.ts`, les gestionnaires, et `api/ryanair.js` et `api/comparer.js` (chacun une fonction `POST(request)`).
- [ ] **Étape 4 :** `npm test && npm run typecheck`. Résultat attendu : tout passe.
- [ ] **Étape 5 :** commit `Vérification Ryanair en direct pour le robot`.

### Tâche 5 : serveur local pour développer la page

**Fichiers :**
- Créer : `src/outils/serveur-local.ts`.
- Modifier : `package.json`, en ajoutant le script `"site": "node --env-file-if-exists=.env src/outils/serveur-local.ts"`.

**Interfaces :**
- Consomme : `gererSante`, `gererNotes`, `gererRyanair` et `gererComparer`.
- Produit : un serveur sur `http://localhost:4317`.
  - Il sert `site/`, avec les bons types MIME pour html, css, js et svg, et refuse tout chemin qui sort de `site/`.
  - Il transforme chaque requête `/api/<nom>` en objet `Request` pour le gestionnaire correspondant.
  - Il force `DONNEES_LOCALES=1`.
  - Si `SIMULER_PANNE_RYANAIR=1`, il injecte un `chercher` qui lance une erreur.

- [ ] **Étape 1 : lancer le serveur.** `CODE_ACCES=code-local-essai-2026 npm run site`, en arrière-plan.
- [ ] **Étape 2 : vérifier avec curl.**
  - `/api/sante` renvoie 200.
  - `/api/notes` sans en-tête renvoie 401.
  - `/api/notes` avec `x-code-acces: code-local-essai-2026` renvoie 200 et un JSON avec `journal`.
  - `/../data/etat.json` renvoie 404.
- [ ] **Étape 3 :** commit `Serveur local pour la page du robot`.

### Tâche 6 : fonctions d'affichage, pures et testées

**Fichiers :**
- Créer : `site/js/rendu.js` et `test/site/rendu.test.ts`.

**Interfaces :**
- Produit :
  - `formaterPrix(n)` renvoie par exemple `"212,00 €"` (avec `Intl` en `fr-BE`, en EUR).
  - `heureBruxelles(iso)` renvoie par exemple `"22h17"`, dans le fuseau `Europe/Brussels`.
  - `texteAge(iso, maintenant)` renvoie, selon l'écart :
    - moins de 60 s : `"à l'instant"` ;
    - moins de 60 min : `"il y a 4 min"` ;
    - moins de 48 h : `"il y a 2 h"` ;
    - au-delà : `"il y a 3 j"`.
  - `lignesEcran(offres)` renvoie au plus 4 lignes `{ texte, prix, meilleur }`, triées par heure de départ.
    - `texte` prend la forme `"ven 08:10 FR3610"` : le jour en abrégé français, puis l'heure et le numéro du premier vol.
    - `prix` vaut `formaterPrix(prixParPersonne)`.
    - `meilleur` est vrai pour la ligne la moins chère.
  - `cheminCourbe(valeurs, largeur, hauteur)` renvoie un `d` SVG. Chaque `null` coupe la ligne et la suite reprend par un nouveau `M`. Si toutes les valeurs sont `null`, la fonction renvoie `""`.
  - `conclusion(c, erreurRyanair)` renvoie l'un de ces textes :
    - si `erreurRyanair` : `"Ryanair ne répond pas en ce moment. Je réessaierai au prochain passage."` ;
    - si `c.nouveauRecord.horaires` : `` `🎉 ${prix} dans tes horaires, nouveau record ! Je t'envoie l'alerte au prochain passage.` `` ;
    - si `c.nouveauRecord.tous && !c.choix.tous.dansHoraires` : `` `⏰ Hors de tes horaires : ${prix}, nouveau record. Alerte au prochain passage.` `` ;
    - sinon : `` `Pas de nouveau record. Meilleur prix dans tes horaires : ${prix}.` ``, ou `"Pas de nouveau record."` si `c.choix.horaires` est `null`.

- [ ] **Étape 1 : tests,** avec ces valeurs exactes :
  - `formaterPrix(212)` est ressemblant à `/^212,00\s€$/` ;
  - `heureBruxelles('2026-11-04T21:17:00Z') === '22h17'` ;
  - `texteAge` donne :
    - `"il y a 4 min"` pour un écart de 4 min 10 s ;
    - `"il y a 2 h"` pour 2 h 05 ;
    - `"à l'instant"` pour 20 s.
  - `lignesEcran` avec les offres Ryanair de `test/fixtures/etat-exemple.json` donne la première ligne `ven 08:10 FR3610` ;
  - `cheminCourbe([3, null, 1, 2], 100, 50)` contient deux `M` ;
  - chacun des quatre cas de `conclusion` est couvert.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 3 :** implémenter `site/js/rendu.js` en JavaScript ES module, sans dépendance.
- [ ] **Étape 4 :** `npm test`. Résultat attendu : tout passe.
- [ ] **Étape 5 :** commit `Fonctions d'affichage de la page du robot`.

### Tâche 7 : la scène du robot

**Fichiers :**
- Créer : `site/index.html` (remplace la page provisoire), `site/style.css` et `site/js/scene.js`.

**Interfaces :**
- Produit : `creerScene(figure: HTMLElement)` renvoie un objet avec :
  - `passerA(etat: 'dort' | 'reveil' | 'travail' | 'coucher'): Promise<void>`, qui se résout à la fin de la transition CSS correspondante ;
  - `dire(texte: string): void` pour la bulle ;
  - `allumer(ecran: 'ryanair' | 'google' | 'courbe', lignes): void` ;
  - `eteindreEcrans(): void`.

**Cahier des charges de la scène :**
- Elle part de l'option A de la maquette : le robot de face derrière son portable, trois écrans flottants (Ryanair à gauche, courbe au centre, Google à droite), des fils lumineux, une lampe et le lit au fond à droite.
- Elle est **enrichie** :
  - des mains qui tapent sur le portable pendant `travail` ;
  - une ligne qui défile sur l'écran actif ;
  - des yeux qui clignent ;
  - une respiration au repos ;
  - un étirement au `reveil` ;
  - une marche visible entre le lit et le bureau (aller et retour) ;
  - des « z » pendant `dort`.
- Les couleurs viennent de jetons CSS, dans le même univers que la maquette.
- `prefers-reduced-motion` est respecté.
- Sous la scène, trois cartes lisibles (« Ce que LisbonIA consulte » : Ryanair, Google Flights, Courbe et record) reprennent le contenu des écrans. La carte de l'écran actif est mise en évidence.
- Les cartes sont toujours visibles : en ligne sur ordinateur, empilées sous 720 px.

- [ ] **Étape 1 :** construire la scène et les quatre états. Ajouter, en développement seulement, `?etat=travail|dort` pour figer un état.
- [ ] **Étape 2 : vérification visuelle,** en lançant le serveur local et en utilisant l'aperçu du navigateur intégré.
  - Prendre une capture de chaque état à 375 px et à 1280 px de large.
  - Contrôler que rien ne déborde, que le texte des cartes est lisible à 375 px, que la marche est visible et qu'il n'y a pas d'erreur dans la console.
- [ ] **Étape 3 :** commit `Scène animée du robot LisbonIA`.

### Tâche 8 : la visite, le code d'accès et le dessous de la scène

**Fichiers :**
- Créer : `site/js/api.js` et `site/js/visite.js`.
- Modifier : `site/index.html` et `site/style.css`.

**Interfaces :**
- Consomme : `creerScene` (tâche 7), le module `rendu.js` (tâche 6), et les fonctions `/api/notes`, `/api/ryanair` et `/api/comparer` (tâches 3 et 4).
- Produit :
  - `appeler(chemin, { methode, corps })`. Elle ajoute l'en-tête `x-code-acces`. Sur une réponse 401, elle oublie le code, affiche le formulaire et rejette avec `Error('code')`.
  - `lancerVisite(): Promise<void>`, protégée par un verrou : un appel pendant une visite en cours ne fait rien (point de vigilance 4).

**Déroulé de `lancerVisite`,** en conservant chaque libellé au moins 1 200 ms pour qu'il soit lisible :
1. Le robot est en `dort`, puis passe en `reveil`, puis en `travail`.
2. « Je relis mes notes… » pendant `/api/notes`. Ensuite :
   - tracer la courbe, avec les deux séries et le record de chaque série mis en évidence ;
   - remplir le journal, puis les meilleurs prix avec leurs liens de réservation ;
   - allumer l'écran de la courbe.
3. Si `termine` : bulle « Je suis en vacances. Bon semi-marathon et joyeux anniversaire ! », retour au lit, fin.
4. « Je vérifie Ryanair… » pendant `/api/ryanair`, puis allumer l'écran Ryanair.
   - Si `depuisCache` : bulle `` `Ryanair vérifié ${texteAge(verifieLe, new Date())}` ``.
   - En cas d'erreur : afficher les offres Ryanair du résumé et noter l'erreur.
5. `` `Je regarde Google Flights… vu ${texteAge(google.vuLe, new Date())}` ``, puis allumer l'écran Google. Si `google.vuLe` est `null`, la bulle dit plutôt « Google Flights : pas encore de données ». Aucun appel réseau ici.
6. « Je compare… » pendant `/api/comparer`.
7. Afficher `conclusion(...)` pendant 4 s.
8. Passer en `coucher` puis en `dort`. La bulle affiche `` `Dernier passage de l'agent : ${heureBruxelles(dernierPassage)}` ``, avec en plus `` ` · prochain vers ${heureBruxelles(prochainPassage)}` `` si `prochainPassage` existe.

**Le reste de la page :**
- **Sans code :** la scène reste en `dort`, avec un formulaire « Code d'accès » par-dessus (`input type="password"` d'`id` `code`, bouton « Réveiller LisbonIA ») et aucune autre section.
- **Code mémorisé :** la visite part au chargement.
- **Retour sur l'onglet :** sur `visibilitychange`, si l'onglet a été caché au moins 10 minutes, une nouvelle visite part.
- **Erreur réseau à l'étape 2 :** bulle « Je n'arrive pas à relire mes notes. », puis retour au lit.

- [ ] **Étape 1 :** implémenter.
- [ ] **Étape 2 : vérification au navigateur,** avec le serveur local, à 375 px et à 1280 px.
  1. Sans code, il n'y a que le robot endormi et le formulaire.
  2. Un code faux remet le formulaire, sans aucune donnée visible.
  3. Avec le bon code, la visite complète va du réveil au coucher, avec les étapes dans l'ordre.
  4. Avec `SIMULER_PANNE_RYANAIR=1`, la conclusion parle de Ryanair et le robot retourne au lit.
  5. Recharger 2 fois rapidement ne produit qu'une visite, un seul appel `/api/ryanair` étant visible dans le réseau.
  6. La console est sans erreur.
- [ ] **Étape 3 :** commit `Visite du robot : réveil, vérification en direct, coucher`.

### Tâche 9 : mise en ligne et vérifications finales

**Fichiers :**
- Modifier : `README.md`, avec une section « La page du robot » : à quoi elle sert, les variables Vercel `CODE_ACCES` et `GITHUB_TOKEN`, `npm run site`, la gratuité.

- [ ] **Étape 1 : passages automatiques de l'agent.** `gh run list --workflow veille.yml --json event --jq '[.[] | select(.event=="schedule")] | length'` doit être supérieur à 0. Si c'est 0 :
  1. Faire un commit qui modifie seulement le commentaire du cron dans `veille.yml`, pour réenregistrer la planification.
  2. Revérifier après 2 heures.
  3. Si c'est toujours 0, prévenir Antonino avant la mise en ligne.
- [ ] **Étape 2 :** `npm test && npm run typecheck`. Résultat attendu : tout passe.
- [ ] **Étape 3 :** commit `Page du robot : documentation`, puis push. Vercel déploie.
- [ ] **Étape 4 : vérification en ligne** sur l'URL Vercel, à 375 px et à 1280 px, avec le code d'Antonino saisi par lui.
  - La visite complète fonctionne.
  - `/data/etat.json` renvoie 404.
  - `/api/notes` sans code renvoie 401.
- [ ] **Étape 5 :** un commit de données seul (passage horaire de l'agent) ne déclenche pas de déploiement Vercel, d'après la liste des déploiements.
