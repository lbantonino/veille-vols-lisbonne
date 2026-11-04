# Robot LisbonIA : voir l'agent de veille travailler

Document de conception du 4 novembre 2026, validé point par point avec Antonino pendant la session de conception.

## Intention

L'agent de veille (ce dépôt) tourne en silence sur GitHub Actions. Il ne se manifeste que par des alertes Telegram. Antonino veut **voir son agent travailler**, sous la forme d'un personnage : le robot LisbonIA.

- Quand il dort, il ne le voit pas, et l'agent travaille seul.
- Quand il est réveillé et ouvre la page, il veut voir le robot à son bureau, en train de consulter les pages de prix.

C'est aussi une pièce de portfolio : Antonino se reconvertit vers le développement IA et automatisation. La page doit donner envie, sur ordinateur comme sur téléphone.

La page est une **fenêtre** sur l'agent. Elle ne le remplace pas et ne change rien à son fonctionnement : il continue toutes les heures sur GitHub et envoie les alertes Telegram.

## Ce que voit Antonino

**La scène retenue : l'option A, « face caméra ».** La maquette se trouve dans [`2026-11-04-robot-lisbonia-maquette.html`](2026-11-04-robot-lisbonia-maquette.html), option A, et aussi dans l'artifact https://claude.ai/artifact/2UrBsy8XaQ7fkvzi8n9L4U. Son SVG et son CSS servent de **point de départ**, à enrichir. Elle s'inspire de son image de référence : un robot de face au milieu d'écrans flottants.

- **Le robot :** LisbonIA, de face, assis derrière un ordinateur portable dont on voit le dos. C'est un robot original : coque blanche arrondie, visière sombre, deux yeux cyan lumineux, antenne avec une boule lumineuse, petit avion sur le torse.
- **Les écrans flottants :** autour et derrière lui flottent les pages qu'il surveille, avec de vraies données :
  - à gauche, Ryanair, avec les vols CRL ↔ LIS et leurs prix ;
  - au centre, la courbe des prix par personne et le record ;
  - à droite, Google Flights, avec les vols et les prix.

  Des fils lumineux relient les écrans au robot.
- **La bulle :** elle dit ce qu'il fait.
- **Le décor :** une lampe de bureau, le sol, et son lit au fond à droite de la pièce.
- **Au repos :** la lumière baisse, les écrans s'éteignent presque et le robot quitte son bureau pour aller dormir dans son lit, avec des « z » qui flottent.
- **Au réveil :** il sort du lit, revient à son bureau, les écrans se rallument.

La version finale doit être **plus détaillée et plus vivante que la maquette** : bras ou mains qui tapent, pages qui défilent, petits mouvements au repos, clignement des yeux. Le style reste celui de la maquette : bureau de nuit éclairé par les écrans, bleu nuit et cyan, accent jaune doux pour les records.

## Déroulé d'une visite : le robot vérifie en direct (option B)

Antonino a choisi l'option B. Le robot fait lui-même une **vérification en direct, depuis Vercel**, sans lancer de passage sur GitHub. Chaque étape montrée correspond à une **vraie opération terminée à ce moment-là**, donc rien n'est simulé.

1. **Antonino ouvre la page.** Le robot dort dans son lit.
2. **Il se réveille et va à son bureau.**
3. **« Je relis mes notes… »** La page lit l'état de l'agent dans le dépôt : records, dernières offres, historique. L'écran de la courbe s'allume.
4. **« Je vérifie Ryanair… »** Le serveur interroge Ryanair **en direct**, avec les mêmes recherches que l'agent : Charleroi, tous horaires et dans les horaires d'Antonino, pour 2 adultes puis pour 1. L'écran Ryanair affiche les vrais vols et prix trouvés à l'instant.
5. **« Je regarde Google Flights… »** **Aucun appel à Google**, pour ne jamais toucher au quota SerpApi. L'écran Google montre les offres du dernier passage de l'agent, avec leur âge, par exemple « vu il y a 2 h ».
6. **« Je compare… »** Le calcul est celui de l'agent : meilleure option dans les horaires et tous horaires, en mêlant les prix Ryanair frais et les offres Google enregistrées. Il est comparé aux records.
7. **Conclusion, toujours vraie :**
   - « Pas de nouveau record » ;
   - ou « 🎉 Je viens de repérer 205 € dans tes horaires, nouveau record ! Je t'envoie l'alerte au prochain passage » ;
   - ou « Ryanair ne répond pas en ce moment ».
8. **Il retourne se coucher.** La bulle indique l'heure du dernier passage réel de l'agent, et du suivant s'il est fiable (voir « Passages automatiques » plus bas).

**Une nouvelle visite** commence au chargement de la page, ou au retour sur l'onglet après au moins 10 minutes d'absence. Un retour plus rapide ne relance rien, et le robot reste dans son état.

**Si une étape échoue,** par exemple Ryanair ou GitHub injoignable, le robot le dit dans sa bulle sans planter, et les écrans montrent les dernières données connues.

**Ce que la page ne fait jamais :** envoyer une alerte Telegram, écrire dans le dépôt, lancer un workflow GitHub ou interroger Google ou SerpApi. Si le robot repère un record en direct, c'est le passage horaire suivant de l'agent qui envoie l'alerte, au plus tard dans l'heure.

## Sous la scène

Validé par Antonino, à la suite de ma suggestion :

- **La courbe des prix par personne** depuis le début de la veille, avec deux séries : « dans tes horaires » (aller avant 12h, retour après 17h) et « tous horaires ». Le record de chaque série est mis en évidence. Les données viennent de `data/historique.jsonl`, champs `meilleurDansHoraires` et `meilleurTousHoraires`.
- **Le journal des derniers passages de l'agent,** par exemple les 10 derniers : heure, meilleur prix dans tes horaires, meilleur prix tous horaires, record battu ou non, sources en panne.
- **Le meilleur prix actuel de chaque famille,** avec les vols et les liens de réservation, déjà présents dans `data/etat.json` (`records`, `dernieresOffres`).

## Ordinateur et téléphone

La page doit être **aussi bonne sur téléphone (dès 375 px de large) que sur ordinateur**. Antonino regarde souvent ses projets dans l'extension Chrome « Mobile View » et sur son iPhone.

- Sur téléphone, la scène tient en largeur. Le texte des écrans flottants y devient trop petit pour être lu. Il faut donc un moyen de lire ce que le robot consulte, par exemple les mêmes « pages » en cartes lisibles sous la scène, synchronisées avec l'animation.
- La façon exacte de le faire est laissée au constructeur. Seule l'exigence compte : tout ce qui est affiché doit être lisible sur un téléphone.

## Accès privé par code

- La page est publique sur Vercel, mais **rien de personnel ne s'affiche sans le code d'accès**. Rien ne s'affiche donc : ni dates, ni prix, ni journal, et aucune vérification n'est lancée.
- Sans code, la page montre seulement le robot endormi et un champ « Code d'accès ».
- Antonino choisit lui-même son code et le saisit dans les variables d'environnement Vercel. Claude ne saisit ni code, ni jeton, ni clé.
- Le code est demandé une fois puis retenu dans le navigateur (`localStorage`). Chaque appel au serveur l'envoie, et le serveur le vérifie.
- **Protection contre les essais en masse.** C'est un choix du constructeur, pour n'ajouter ni compte ni service :
  - le code fait au moins 12 caractères ;
  - le serveur compare en temps constant ;
  - chaque mauvais code coûte une attente d'environ 1 seconde ;
  - un compteur en mémoire, perdu au redémarrage de la fonction, ralentit davantage les essais répétés.

  Les données protégées sont peu sensibles (prix de vols). Aucun stockage externe n'est donc ajouté.

## Fonctionnement technique

- **Hébergement : Vercel, compte existant d'Antonino, formule gratuite (Hobby).** Le projet Vercel est relié au dépôt privé `lbantonino/veille-vols-lisbonne`.
- **Code :**
  - la page est statique, en HTML, CSS et JavaScript, sans framework, comme le reste du projet qui n'a aucune dépendance à l'exécution ;
  - les fonctions serveur sont en TypeScript.
- **Une seule source de vérité.** Les fonctions serveur **réutilisent le code de l'agent** : `src/config.ts` (dates, horaires, valise), `src/sources/ryanair.ts` et `src/analyse.ts`. Changer un réglage dans `src/config.ts` change donc aussi la page. L'organisation des dossiers et le réglage Vercel qui le permettent sont laissés au constructeur.
- **Jeton GitHub :** un jeton « fine-grained » limité à ce seul dépôt, avec la seule permission Contents en **lecture seule**. Il sert à lire `data/`, qui est privé. Antonino le crée et le range dans Vercel. Il ne quitte jamais le serveur.
- **Fonctions serveur,** toutes protégées par le code d'accès :
  - lire l'état et l'historique de l'agent (`data/etat.json`, fin de `data/historique.jsonl`) par l'API GitHub, en direct, sans redéploiement ;
  - vérifier Ryanair en direct ;
  - comparer. Ce calcul peut aussi se faire dans la même fonction que Ryanair.

  Chaque étape de la visite correspond à une requête réelle.
- **Ménager Ryanair :** le serveur garde le résultat Ryanair 60 secondes, si la plateforme le permet. Des visites rapprochées réutilisent alors le même résultat, et la bulle le dit, par exemple « vérifié il y a 40 s ».
- **Redéploiements :** le robot de l'agent enregistre `data/` dans le dépôt toutes les heures. Il faut éviter un déploiement Vercel à chaque fois, avec un « Ignored Build Step » qui ignore les changements limités à `data/`.

## Toujours gratuit

C'est une contrainte ferme, répétée avec insistance par Antonino.

- **Vercel Hobby :** page et fonctions serveur dans les limites gratuites, sans moyen de paiement.
- **GitHub Actions :** la page ne lance **aucun** workflow et ne consomme donc **aucune** minute. Les passages horaires de l'agent restent à environ 744 minutes sur les 2 000 gratuites.
- **Google Flights (SerpApi) :** la page n'en fait **jamais** l'appel.
- **Ryanair :** gratuit. Au plus 4 appels par visite, avec le cache de 60 secondes.
- **Telegram :** non utilisé par la page.

## Hors du périmètre

- Aucun réglage de l'agent ne se modifie depuis la page : dates, horaires et prix cible restent dans `src/config.ts`.
- Pas d'alerte, pas d'écriture dans le dépôt et pas de lancement de workflow depuis la page.
- Pas de comptes ni de plusieurs utilisateurs.
- Pas de son.
- Le comportement de l'agent ne change pas. Seul un éventuel déplacement de fichiers, pour que Vercel puisse importer son code, est permis, à condition que l'agent marche à l'identique et que ses 24 tests passent.

## Ce qui serait un échec, même si ça marche techniquement

- **Un robot qui fait « clipart » ou modèle tout fait.** Il doit avoir du caractère et rester cohérent avec la maquette A.
- **Des prix, des étapes ou des résultats inventés.** Toute étape montrée doit correspondre à une opération réelle, et tout chiffre affiché à une vraie donnée.
- **Un dépassement des formules gratuites,** ou un jeton GitHub visible côté navigateur.
- **Une page illisible ou cassée sur téléphone.**
- **Des données personnelles visibles sans le code.**
- **Toute modification qui casse ou ralentit l'agent de veille.**

## Contexte utile pour le constructeur

- **Format des données :**
  - `data/etat.json` contient `records` (`horaires` et `tous`, chacun avec `prixParPersonne`, `le` et `option.offres[]`), `dernieresOffres[]`, `echecs`, `google` (`dernierCreneau`, `rotation`, `soloLe`, `niveau`) et `demarre` ;
  - `data/historique.jsonl` contient une ligne par passage, avec `le`, `meilleurDansHoraires`, `meilleurTousHoraires`, `records`, `avisGoogle`, `offres[]` (`source`, `sens`, `prixParPersonne`, `dansHoraires`, `soloParPersonne`, `vols` sous forme de texte « FR1300 CRL-LIS 2027-03-05T15:35:00 ») et `pannes[]`.
- **Fin de la veille :** le workflow se désactive tout seul le 5 mars 2027. Après cette date, la page doit afficher un état final. Le robot est en vacances, et la page montre le dernier record et le journal.
- **Passages automatiques :** au 4 novembre au soir, GitHub n'avait encore lancé **aucun** passage horaire automatique, seulement des lancements manuels. Ce point se traite à part, dans le workflow de l'agent, avant la mise en ligne de la page. La page doit s'appuyer sur la date du **dernier passage réel** (`le` de la dernière ligne de l'historique). Elle n'annonce un « prochain passage » que si les passages automatiques sont réguliers.
- **Langue :** tout le texte de la page est en français, en tutoyant Antonino.

## Laissé au constructeur

- Le dessin détaillé du robot et du décor, dans l'esprit de la maquette A.
- Les animations et leurs durées.
- La mise en page exacte sur ordinateur et sur téléphone.
- Le découpage des fonctions serveur, et l'organisation des dossiers pour que Vercel puisse réutiliser le code de l'agent.
- Les tests.
