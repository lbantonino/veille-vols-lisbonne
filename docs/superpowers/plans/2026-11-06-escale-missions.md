# Escale : plan de construction

> **Pour les agents qui exécutent ce plan :** compétence requise : superpowers:subagent-driven-development (recommandée) ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** l'agent enchaîne les missions. Il fait la veille Lisbonne (LisbonIA) jusqu'au départ, puis, à partir du 9 mars 2027 à 8h (heure de Bruxelles), il envoie un rapport hebdomadaire Palerme (PalermoIA). La page suit la mission active.

**Architecture :**
- `src/missions.ts` décrit les missions et dit laquelle est active.
- `src/main.ts` devient un aiguillage : la logique Lisbonne actuelle passe telle quelle dans `src/missions/lisbonne.ts`, et la mission Palerme vit dans `src/palerme/`. Elle a ses propres données dans `data/palerme/`.
- **Lisbonne garde ses fichiers `data/etat.json` et `data/historique.jsonl`.** Pas de migration, donc aucun risque pour la veille en cours.
- La page et ses fonctions serveur lisent la mission active et affichent ses données.

**Technologies :** les mêmes qu'aujourd'hui. TypeScript exécuté par Node 24, `node:test`, aucune dépendance à l'exécution, GitHub Actions, SerpApi, Ryanair (farfnd), Telegram et Vercel.

**Document de conception :** `docs/superpowers/specs/2026-11-06-escale-missions-design.md`

## Contraintes globales

- **Lisbonne inchangée jusqu'au 5 mars 2027 :** les tests existants passent à chaque tâche (`npm test`, `npm run typecheck`).
- **Bascule :** le **9 mars 2027 à 8h, heure de Bruxelles**, soit `2027-03-09T07:00:00Z`. L'heure d'été belge ne commence que le 28 mars 2027.
- **Palerme :**
  - **trajet :** destination `PMO` ; Ryanair depuis `CRL` seulement ; Google depuis `BRU,CRL` ;
  - **voyageur :** 1 adulte, petit sac, valise de 20 kg en soute ;
  - **séjour :** 7 jours ;
  - **départ :** entre J+30 et J+90, comptés depuis le jour du rapport ;
  - **rapport :** le lundi à partir de 8h, heure de Bruxelles, une fois par semaine. Le premier part le jour de la bascule ;
  - **valise de 20 kg :** supplément par vol. Ryanair : **40 € par vol, en estimation**, à mesurer avant mars. Compagnie inconnue : affichée « valise non comprise » et exclue du « meilleur prix ».
- **Gratuité :** au plus 1 recherche SerpApi par rapport, jamais sous la réserve de 15. Un passage qui n'a rien à faire n'écrit **aucun** fichier, donc ne fait aucun commit.
- **Pas d'alerte « record » pour Palerme.** Les pannes suivent la règle actuelle : 3 échecs d'affilée.
- **Sans code, la page ne montre aucune date, aucun prix, aucun vol.** Seul le nom du robot de la mission active peut s'afficher. Le test `test/site/public.test.ts` doit toujours passer.
- **Messages en français, ton actuel de LisbonIA.** Commits sans co-auteur ni mention de Claude.

## Points de vigilance

1. **Plusieurs passages dans la même semaine :** un seul rapport. Un passage suivant n'écrit rien.
2. **Ryanair ne trouve aucun vol dans la fenêtre :** un rapport part quand même, avec « aucune semaine trouvée entre … et … », et la semaine est comptée comme faite.
3. **Google en panne ou quota trop bas :** le rapport part sans Google et dit pourquoi.
4. **Telegram en échec :** le rapport n'est pas compté comme fait, il repart au passage suivant.
5. **La page en mission Palerme sans aucune donnée Palerme,** par exemple dans les premières heures : la page s'affiche avec des écrans et un journal vides, sans planter.

---

### Tâche 1 : les missions et l'horloge

**Fichiers :** créer `src/missions.ts` et `test/missions.test.ts`.

**Interfaces, produites ici :**
- `interface MissionLisbonne { id: 'lisbonne'; robot: 'LisbonIA'; trajet: string }`
- `interface MissionPalerme`, avec les champs :
  - `id: 'palerme'; robot: 'PalermoIA'; trajet: string; debutUtc: string;`
  - `vers: string; depuisRyanair: string[]; depuisGoogle: string[];`
  - `adultes: number; dureeJours: number; fenetre: { minJours: number; maxJours: number };`
  - `valise20kgParVol: Record<string, number>; valiseEstimee: boolean;`
  - `lienPage: string`
- `type Mission = MissionLisbonne | MissionPalerme`
- Les constantes `LISBONNE` et `PALERME`, avec les valeurs des contraintes globales :
  - `trajet` vaut `'Bruxelles → Lisbonne'` et `'Bruxelles → Palerme'` ;
  - `valise20kgParVol` vaut `{ Ryanair: 40 }` ;
  - `valiseEstimee` vaut `true` ;
  - `lienPage` vaut `'https://lisbonia.vercel.app'`.
- `missionActive(maintenant: Date): Mission` renvoie `LISBONNE` avant `PALERME.debutUtc`, et `PALERME` à partir de cette date.
- `semaineDeRapport(maintenant: Date): string`, au format `'2027-W11'` : la semaine ISO de l'instant décalé de 8 heures en arrière, à l'heure de Bruxelles. Une nouvelle semaine de rapport commence donc le lundi à 8h.
- `fenetreDeDepart(maintenant: Date, m: MissionPalerme): { debut: string; fin: string }` : les dates `AAAA-MM-JJ` de J+30 et J+90.

- [ ] **Étape 1 : tests.**
  - `missionActive` :
    - `new Date('2027-03-04T12:00Z')` donne `'lisbonne'` ;
    - `'2027-03-09T06:59:59Z'` donne `'lisbonne'` ;
    - `'2027-03-09T07:00:00Z'` donne `'palerme'`.
  - `semaineDeRapport` :
    - mardi `'2027-03-09T10:00Z'` donne `'2027-W10'` ;
    - lundi `'2027-03-15T06:59Z'`, soit 7h59 à Bruxelles, donne `'2027-W10'` ;
    - lundi `'2027-03-15T07:00Z'` donne `'2027-W11'` ;
    - un lundi d'été, `'2027-06-07T06:00Z'`, soit 8h00 à Bruxelles, donne `'2027-W23'`.
  - `fenetreDeDepart(new Date('2027-03-09T07:00Z'), PALERME)` donne `{ debut: '2027-04-08', fin: '2027-06-07' }`.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec, module introuvable.
- [ ] **Étape 3 :** implémenter, avec l'heure de Bruxelles via `Intl.DateTimeFormat` et le fuseau `'Europe/Brussels'`.
- [ ] **Étape 4 :** `npm test && npm run typecheck`. Résultat attendu : tout passe.
- [ ] **Étape 5 :** commit `Escale : les missions et l'horloge des rapports`.

### Tâche 2 : l'aiguillage, Lisbonne déplacée sans changement

**Fichiers :**
- Créer : `src/missions/lisbonne.ts`, `src/palerme/passage.ts` (provisoire : `export async function passagePalerme(): Promise<void> {}`) et `test/workflow.test.ts`.
- Modifier : `src/main.ts` et `.github/workflows/veille.yml`.

**Interfaces, produites ici :**
- `passageLisbonne(maintenant: Date): Promise<void>` contient le corps actuel de `main()`, à l'identique, **sans** `signalerFinAGitHub` ni l'écriture dans `GITHUB_OUTPUT`.
- `main.ts` appelle `passageLisbonne` ou `passagePalerme(maintenant)` selon `missionActive(new Date())`.

- [ ] **Étape 1 : test `test/workflow.test.ts`.** Le fichier `veille.yml` ne contient plus `gh workflow disable`, ni `actions: write`, ni `steps.veille.outputs.termine`.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : ce test échoue.
- [ ] **Étape 3 :** déplacer le code, retirer l'étape « Arrêter la veille après le départ » et la permission `actions: write` du workflow.
- [ ] **Étape 4 :** `npm test && npm run typecheck` passent. Faire ensuite un passage réel en mode essai : `node src/main.ts` sans `.env`, en sauvegardant puis en restaurant `data/`. Il doit afficher la même ligne « Dans tes horaires … » qu'avant.
- [ ] **Étape 5 :** commit `Escale : aiguillage des missions, Lisbonne inchangée, le workflow ne s'arrête plus`, puis push.

### Tâche 3 : Ryanair, la semaine la moins chère

**Fichiers :**
- Modifier : `src/sources/ryanair.ts`.
- Créer : `test/fixtures/ryanair-semaine-palerme.json` (réponse réelle) et `test/palerme/sources.test.ts`.

**Interfaces, produites ici :**
- `interface SemaineRyanair { aller: Vol; retour: Vol; prixParPersonne: number /* hors valise */; lien: string }`
- `convertirSemaineRyanair(reponse: ReponseRyanair, adultes: number): SemaineRyanair | null` : le tarif le moins cher de `fares` (`summary.price.value / adultes`), ou `null` si `fares` est vide.
- `chercherSemaineRyanair(p: { depuis: string[]; vers: string; debut: string; fin: string; dureeJours: number; adultes: number }): Promise<SemaineRyanair | null>`.
  - Elle appelle `roundTripFares` pour chaque origine, avec `outboundDepartureDateFrom=debut`, `outboundDepartureDateTo=fin`, `inboundDepartureDateFrom=debut`, `inboundDepartureDateTo=fin + dureeJours`, `durationFrom=durationTo=dureeJours`, `adultPaxCount=adultes` et `market=fr-be`.
  - Elle garde la moins chère. Le lien est `lienRyanair(de, vers, aller, adultes, retour)`.

- [ ] **Étape 1 : enregistrer la réponse réelle,** gratuite, de `roundTripFares` CRL→PMO pour 1 adulte, avec la fenêtre `2027-04-08`→`2027-06-07` et une durée de 7, dans la fixture.
- [ ] **Étape 2 : tests.**
  - `convertirSemaineRyanair(fixture, 1)` renvoie un aller de `CRL` à `PMO`, un retour de `PMO` à `CRL` 7 jours plus tard, et un `prixParPersonne` égal à `summary.price.value`.
  - `convertirSemaineRyanair({ fares: [] }, 1) === null`.
- [ ] **Étape 3 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 4 :** implémenter.
- [ ] **Étape 5 :** `npm test && npm run typecheck`, puis commit `Escale : Ryanair, la semaine la moins chère sur une période`.

### Tâche 4 : Google, les mêmes dates chez les autres compagnies

**Fichiers :** modifier `src/sources/google.ts` et `test/palerme/sources.test.ts`.

**Interfaces, produites ici :**
- `parametresTrajetGoogle(t: { depuis: string[]; vers: string; aller: string; retour: string; adultes: number }, cle: string): URLSearchParams`, avec :
  - `type=1`, `stops=1`, `adults=adultes` ;
  - `bags=0`, puisque la valise va en soute et qu'elle est ajoutée à part ;
  - `currency=EUR`, `hl=fr`, `gl=be` ;
  - `departure_id=depuis.join(',')`, `arrival_id=vers`, `outbound_date=aller`, `return_date=retour`.
- `interface OffreTrajetGoogle { compagnie: string; vols: Vol[] /* aller */; prixParPersonne: number /* hors valise */; lien: string }`
- `convertirTrajetGoogle(reponse: ReponseGoogle, adultes: number): OffreTrajetGoogle | null` : la moins chère. `null` s'il n'y a aucun résultat. Elle lève une erreur pour toute autre erreur SerpApi.
- `chercherTrajetGoogle(t, cle): Promise<OffreTrajetGoogle | null>`

- [ ] **Étape 1 : tests.**
  - Les paramètres pour `{ depuis: ['BRU','CRL'], vers: 'PMO', aller: '2027-04-09', retour: '2027-04-16', adultes: 1 }` donnent `departure_id === 'BRU,CRL'`, `bags === '0'` et `type === '1'`.
  - La conversion d'une réponse avec deux prix, 180 et 150, pour 1 adulte renvoie `prixParPersonne === 150` et la compagnie de ce résultat.
  - Le cas « aucun résultat » renvoie `null`.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 3 :** implémenter, en réutilisant `versVols`.
- [ ] **Étape 4 :** `npm test && npm run typecheck`, puis commit `Escale : Google pour une semaine donnée`.

### Tâche 5 : le rapport Palerme, logique pure et messages

**Fichiers :** créer `src/palerme/rapport.ts`, `src/palerme/messages.ts` et `test/palerme/rapport.test.ts`.

**Interfaces, produites ici :**
- `interface PrixValise { prixParPersonne: number /* valise comprise */; valiseParPersonne: number | null /* null = valise non comprise */ }`
- `interface Rapport`, avec les champs :
  - `semaine: string; le: string; fenetre: { debut: string; fin: string };`
  - `ryanair: (SemaineRyanair & PrixValise) | null;`
  - `google: (OffreTrajetGoogle & PrixValise) | null; googleAbsent?: string /* raison */;`
  - `meilleurParPersonne: number | null; evolution: number | null`
- `avecValise(prixHorsValise: number, compagnie: string, m: MissionPalerme): PrixValise` : ajoute `2 × valise20kgParVol[compagnie]` si la compagnie est connue ; sinon garde le prix et met `valiseParPersonne: null`.
- `construireRapport(p: { maintenant: Date; mission: MissionPalerme; ryanair: SemaineRyanair | null; google: OffreTrajetGoogle | null; googleAbsent?: string; precedent: Rapport | null }): Rapport`
  - `meilleurParPersonne` est le minimum des prix **valise comprise** (ceux dont `valiseParPersonne` n'est pas `null`).
  - `evolution` vaut `meilleur − precedent.meilleur`, ou `null`.
- `doitFaireRapport(dernier: Rapport | null, maintenant: Date): boolean`, qui compare `semaineDeRapport`.
- `messageRapport(r: Rapport, m: MissionPalerme): string` et `messageBascule(m: MissionPalerme): string`, en HTML Telegram, avec le texte échappé par `html()`.

- [ ] **Étape 1 : tests.**
  - `avecValise(72.48, 'Ryanair', PALERME)` donne `{ prixParPersonne: 152.48, valiseParPersonne: 80 }`.
  - `avecValise(150, 'ITA', PALERME).valiseParPersonne === null`.
  - Le meilleur prix ignore un prix Google sans valise connue.
  - L'évolution vaut −8 quand le précédent était à 160 et le nouveau à 152.
  - `doitFaireRapport(null, …) === true` ; un rapport de la même semaine donne `false` ; le lundi suivant à 8h donne `true`.
  - `messageRapport` contient :
    - « PalermoIA » ;
    - les deux dates, au format `dateHeure` ;
    - « valise 20 kg comprise (estimation) » quand `valiseEstimee` ;
    - « −8,00 € depuis la semaine dernière » ;
    - « valise non comprise » pour une compagnie inconnue ;
    - la raison de `googleAbsent` ;
    - le lien de réservation et `m.lienPage`.
  - Avec `ryanair: null`, `messageRapport` contient « aucune semaine trouvée » et la fenêtre.
  - `messageBascule` contient « LisbonIA devient PalermoIA », « 31 mars 2027 », « /setname » et « escale-ia.vercel.app ».
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** `npm test && npm run typecheck`, puis commit `Escale : le rapport Palerme et ses messages`.

### Tâche 6 : le passage Palerme, données et orchestration

**Fichiers :**
- Créer : `src/palerme/stockage.ts` et `test/palerme/passage.test.ts`.
- Modifier : `src/palerme/passage.ts`.

**Interfaces, produites ici :**
- `interface EtatPalerme { basculeAnnonceeLe: string | null; dernierRapport: Rapport | null; echecs: { ryanair: number; google: number } }`
- Dans `src/palerme/stockage.ts`, qui lit et écrit `data/palerme/etat.json` et `data/palerme/rapports.jsonl` :
  - `lireEtatPalerme(dossier?: URL): Promise<EtatPalerme>`, qui renvoie l'état initial si le fichier est absent ;
  - `ecrireEtatPalerme(e, dossier?)` ;
  - `ajouterRapport(r, dossier?)`.
- `passagePalerme(maintenant: Date, deps?: { chercherRyanair?, chercherGoogle?, quota?, envoyer?, dossier?: URL }): Promise<void>`, qui déroule dans l'ordre :
  1. Si `basculeAnnonceeLe` est nul, envoyer `messageBascule`.
  2. Si `!doitFaireRapport` et que la bascule est déjà annoncée, **sortir sans rien écrire**.
  3. Chercher la semaine Ryanair. En cas d'échec, faire `echecs.ryanair++` et, au 3e échec, envoyer `messagePanne('ryanair')`. Écrire l'état puis sortir : pas de rapport, il sera retenté au passage suivant.
  4. Si la semaine existe et que le quota dépasse la réserve, chercher Google aux mêmes dates, depuis `depuisGoogle`. Sinon, renseigner `googleAbsent` (« quota gardé en réserve » ou le message d'erreur), avec `echecs.google` et l'alerte au 3e échec.
  5. Construire le rapport et l'envoyer. Si l'envoi réussit, mettre à jour `dernierRapport`, la bascule et les compteurs, écrire l'état et ajouter le rapport. Si l'envoi échoue, ne rien marquer comme fait et mettre `process.exitCode = 1`.

- [ ] **Étape 1 : tests,** avec un dossier temporaire dans `test/.palerme-essai-<pid>/` supprimé à la fin, une horloge et des sources simulées, et un `envoyer` qui enregistre les messages.
  - Mardi 9 mars, 10h : 2 messages, la bascule puis le rapport. `rapports.jsonl` contient 1 ligne.
  - Même jour, 15h : aucun message, et ni `etat.json` ni `rapports.jsonl` ne sont modifiés (contenu et date de modification identiques).
  - Lundi 15 mars, 8h30 : 1 rapport, avec une évolution calculée.
  - Ryanair en échec 3 fois de suite : une seule alerte de panne, et aucun rapport.
  - Quota à 15 : le rapport part, Google n'est pas appelé, et le message dit « quota ».
  - `envoyer` lève une erreur : `dernierRapport` reste nul, et le passage suivant renvoie le rapport.
  - Ryanair ne trouve rien (`null`) : le rapport « aucune semaine trouvée » part, et la semaine est comptée comme faite.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 3 :** implémenter. Les sources par défaut sont les vraies (`chercherSemaineRyanair`, `chercherTrajetGoogle`, `lireQuotaSerpApi`, `envoyerTelegram`).
- [ ] **Étape 4 :** `npm test && npm run typecheck`, puis commit `Escale : le passage Palerme`.

### Tâche 7 : les fonctions serveur suivent la mission

**Fichiers :**
- Modifier : `src/robot/donnees.ts`, `src/robot/resume.ts`, `src/robot/direct.ts`, `src/robot/http.ts`, `api/sante.js` et `src/outils/serveur-local.ts`.
- Tests : `test/robot/palerme.test.ts`.

**Interfaces, produites ici :**
- `lireDonneesPalerme(env, fetchImpl?): Promise<{ etat: EtatPalerme; rapports: Rapport[] }>` lit `data/palerme/…` par GitHub, ou le disque si `DONNEES_LOCALES === '1'`. Un **404 compte comme vide**. Le dossier local se remplace par `env.DOSSIER_DONNEES`.
- `resumer(...)` pour Lisbonne ajoute `mission: { id: 'lisbonne', robot: 'LisbonIA', trajet: 'Bruxelles → Lisbonne', details: string }`. Le reste ne change pas.
- `resumerPalerme(etat, rapports, maintenant): ResumePalerme`, qui renvoie :
  - `{ mission: { id: 'palerme', robot: 'PalermoIA', trajet, details: '1 adulte · valise 20 kg · 7 jours, départ dans 1 à 3 mois' },`
  - `dernierRapport, journal /* 10 derniers, le plus récent d'abord */,`
  - `courbe: { le, meilleur }[], dernierPassage: dernierRapport?.le ?? null, termine: false }`.
- `gererNotes`, `gererRyanair` et `gererComparer` choisissent selon `missionActive(maintenant)`.
  - **Palerme, `/api/ryanair` :** renvoie `{ semaine: SemaineRyanair & PrixValise | null, verifieLe, depuisCache }`, avec la même fenêtre que le rapport et le même cache de 60 s.
  - **Palerme, `/api/comparer` :** reçoit `{ semaine }` et renvoie `{ mission: 'palerme', nouveau: number | null, dernier: number | null, difference: number | null }`.
- `gererSante()` ajoute `robot: missionActive(new Date()).robot`.
- **Serveur local :** si `ESCALE_MAINTENANT` (au format ISO) est défini, il est injecté comme `maintenant` dans les gestionnaires, pour essayer la page Palerme avant mars.

- [ ] **Étape 1 : tests.**
  - En mission Palerme, sans aucun fichier (404), `gererNotes` répond 200 avec un journal vide et `dernierRapport: null`.
  - Avec deux rapports, il renvoie la courbe de 2 points et le journal le plus récent d'abord.
  - `gererRyanair` en mission Palerme appelle `chercherSemaineRyanair` avec la fenêtre `2027-04-08`→`2027-06-07` le 9 mars.
  - `gererComparer` renvoie `difference: -8` pour un nouveau prix à 152 et un dernier à 160.
  - `gererSante()` contient `robot`, et aucune date.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** `npm test && npm run typecheck`, puis commit `Escale : les fonctions de la page suivent la mission`.

### Tâche 8 : la page suit la mission

**Fichiers :**
- Modifier : `site/index.html`, `site/js/page.js`, `site/js/notes.js`, `site/js/visite.js`, `site/js/scene.js` et `site/js/rendu.js`.
- Tests : `test/site/rendu.test.ts`.
- Créer : `test/fixtures/escale-demo/palerme/etat.json` et `test/fixtures/escale-demo/palerme/rapports.jsonl`, qui contiennent deux rapports d'exemple.

**Interfaces, produites ici :**
- Dans `rendu.js` :
  - `lignesSemaine(semaine): { texte, prix, meilleur }[]` : l'aller et le retour, au format de `lignesEcran` ;
  - `conclusionPalerme(c: { nouveau, dernier, difference } | null, erreurRyanair: boolean): string`.
- Dans `notes.js` :
  - `appliquerMission(mission)` remplace le nom du robot, le sous-titre, les titres des cartes et ceux des écrans de la scène (aujourd'hui écrits « Lisbonne » ou « LIS » en dur) ;
  - `afficherNotesPalerme(notes)` affiche le dernier rapport (dates, vols, prix valise comprise, Google), la courbe d'une seule série et le journal des rapports.
- Au chargement, `page.js` lit `GET /api/sante` et affiche `robot` comme nom, sans code. Par défaut, le nom est « Escale ».
- `visite.js` choisit le déroulé selon `notes.mission.id`. Le déroulé Palerme : relire ses notes, chercher la semaine en direct chez Ryanair, montrer le Google du dernier rapport, comparer, conclure, se coucher.

- [ ] **Étape 1 : tests de `rendu.js`.**
  - `lignesSemaine` donne 2 lignes, `ven 21:40 FR6302` puis le retour.
  - `conclusionPalerme({ nouveau: 152, dernier: 160, difference: -8 }, false)` donne « La semaine la moins chère est à 152,00 € valise comprise, 8,00 € de moins qu'au dernier rapport. »
  - Avec une différence nulle : « … même prix qu'au dernier rapport. »
  - Avec `dernier: null` : « … Premier relevé. »
  - Avec l'erreur Ryanair, la phrase de panne habituelle.
- [ ] **Étape 2 :** `npm test`. Résultat attendu : échec.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 : vérifier au navigateur.**
  - Lancer le serveur local avec `ESCALE_MAINTENANT=2027-03-16T10:00:00Z` et `DOSSIER_DONNEES` pointé vers `test/fixtures/escale-demo/`, à 375 px et à 1280 px.
  - Contrôler :
    - le nom PalermoIA ;
    - la visite complète ;
    - le dernier rapport, la courbe et le journal ;
    - aucun « Lisbonne » ;
    - une console sans erreur.
  - Puis, sans `ESCALE_MAINTENANT`, vérifier que la page Lisbonne est inchangée.
- [ ] **Étape 5 :** `npm test && npm run typecheck` (le test public compris), puis commit `Escale : la page suit la mission (LisbonIA puis PalermoIA)`.

### Tâche 9 : documentation, mise en ligne et vérifications

**Fichiers :** modifier `README.md`, présenté comme **Escale**, et `src/config.ts` si besoin.

- [ ] **Étape 1 :** mettre à jour le README : nom Escale, les missions, le rapport hebdomadaire, comment ajouter une mission, et la gratuité.
- [ ] **Étape 2 :** `npm test && npm run typecheck`, puis commit et push.
- [ ] **Étape 3 : vérifier en ligne.**
  - `/api/sante` affiche `"robot":"LisbonIA"`.
  - `/api/sante?notes=1` affiche « lisibles ».
  - Un passage GitHub lancé à la main réussit avec la ligne Lisbonne habituelle.
- [ ] **Étape 4 :** relecture indépendante de tout le travail, puis correction des points importants, chacun avec un test d'abord.
- [ ] **Étape 5 :** mettre à jour la mémoire et le contexte Jarvis (CONTEXT.md, HISTORY.md). Laisser en note : **mesurer le supplément Ryanair de la valise de 20 kg avant le 9 mars**, puis passer `valiseEstimee` à `false`.
