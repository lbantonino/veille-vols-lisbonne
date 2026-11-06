# Escale : un agent de veille des vols qui enchaîne les missions

Document de conception du 6 novembre 2026, validé point par point avec Antonino.

## Intention

Aujourd'hui, l'agent ne surveille qu'un voyage, Bruxelles ↔ Lisbonne du 5 au 8 mars 2027, puis il s'arrête. Antonino veut un agent qui **travaille en continu**, pour deux raisons :
- s'en servir après Lisbonne ;
- le **montrer aux recruteurs** comme une vraie automatisation avec un petit agent IA qui tourne tout le temps, gratuitement.

L'agent prend un nom général, **Escale**. Il enchaîne des **missions** : chaque destination est une escale, avec son propre robot.

1. **Mission Lisbonne (LisbonIA)** : la veille actuelle, inchangée, jusqu'au départ.
2. **Mission Palerme (PalermoIA)** : à partir du **9 mars 2027**, au retour de Lisbonne, un **rapport hebdomadaire** des prix pour une semaine à Palerme.

Ajouter plus tard une autre destination doit se faire en décrivant une nouvelle mission, sans réécrire l'agent.

## Ce qu'Antonino a décidé

- **Bascule** le **9 mars 2027**.
- **Quelle semaine :** chaque semaine, l'agent cherche **la semaine la moins chère** pour un séjour de 7 jours à Palerme, avec un départ **au plus tôt 1 mois après le rapport et au plus tard 3 mois après**, le temps de poser ses congés. Décidé le 6 novembre.
- **Voyageur :** **1 adulte**, avec un **petit sac** et une **valise de 20 kg** en soute.
- **Renommage automatique :** le jour de la bascule, le robot devient **PalermoIA** sur la page et dans les messages. Une **notification Telegram** l'annonce.
- **Rappels dans les notifications :** **renouveler la clé GitHub** de Vercel (elle expire le 31 mars 2027) et renommer le bot dans Telegram, qui est le seul nom qui se change à la main.
- **Nom général :** **Escale**.
- **Messages :** pas de messages de routine (« viens me voir travailler » a été retiré le 6 novembre à sa demande). Pour Palerme, le seul message régulier est le **rapport hebdomadaire**, qui prouve aussi que l'agent tourne.

## Mission Lisbonne : inchangée

- Le comportement actuel est conservé : passages, records dans et hors horaires, vol retour, place seule, alertes Telegram et page.
- Elle s'arrête le **5 mars 2027**, jour du départ, comme aujourd'hui.
- **Le workflow ne se désactive plus** au départ. Il continue pour la mission suivante.
- **Du 5 au 8 mars,** aucune mission n'est active : l'agent ne fait rien, ne dépense rien et n'écrit rien. La page montre le robot « en vacances ».

## Mission Palerme : le rapport hebdomadaire

**Le trajet :**
- Bruxelles ↔ **Palerme (PMO)**.
- Ryanair ne dessert Palerme que depuis **Charleroi**.
- Google Flights couvre aussi Zaventem et les autres compagnies.

**La recherche, une fois par semaine :**

1. **Ryanair, gratuit :** une seule requête « aller-retour le moins cher » sur toute la période, pour 1 adulte.
   - Départs de J+30 à J+90, comptés depuis le jour de chaque rapport. Les retours vont donc jusqu'à J+97.
   - Séjour de 7 jours exactement.

   Ryanair renvoie directement la meilleure semaine. Vérifié le 6 novembre 2026 sur la période du 9 mars au 9 juin 2027 : depuis Charleroi, 12 mars → 19 mars 2027, 72,48 € hors valise. La requête marche donc ; ces dates ne servent que d'exemple.
2. **Google Flights, 1 recherche SerpApi :** un aller-retour **pour la semaine trouvée**, depuis Zaventem et Charleroi, vols directs, 1 adulte. Ça sert à comparer avec les autres compagnies pour les mêmes dates. Si le quota est trop bas, l'agent saute cette étape, et le rapport le dit.
3. **Le prix comparé est toujours « valise de 20 kg comprise »** :
   - Ryanair : supplément par vol, réglé dans la configuration ;
   - Google : supplément par compagnie, Google n'incluant pas les bagages en soute.

   Les valeurs sont **mesurées** avant le 9 mars, comme les 36 € de la valise cabine Lisbonne, et marquées comme estimations tant qu'elles ne le sont pas.

**Le rapport Telegram, avec sonnerie,** au premier passage de l'agent **à partir du lundi 8h** (heure de Bruxelles), une fois par semaine :
- la semaine la moins chère, avec les dates aller et retour, et le prix **valise comprise** ;
- les vols : compagnie, numéro, heures, aéroports ;
- la comparaison Google pour les mêmes dates, si elle est disponible ;
- l'évolution par rapport au rapport précédent, par exemple « −8 € depuis la semaine dernière » ;
- le lien de réservation et le lien vers la page.

**Les alertes :**
- **Panne d'une source :** même règle qu'aujourd'hui (3 échecs d'affilée).
- **Pas d'alerte « record »** pour Palerme : le rapport hebdomadaire suffit, c'est ce qu'Antonino a demandé.

**Choix du constructeur, suite à la relecture :**
- **Échec avant le rapport :** tant que le rapport de la semaine n'est pas parti, chaque passage réessaie. Après 3 échecs d'affilée, l'alerte de panne prévient Antonino. Une semaine ne passe donc jamais en silence.
- **Prix mis en avant :** le moins cher entre Ryanair et Google, tous deux valise de 20 kg comprise. Les deux sont gardés dans les données du rapport.
- **Compagnie Google sans supplément de valise connu :** son prix est affiché « valise non comprise », jamais « comprise ».
- **Fin de la mission Palerme :** aucune par défaut. Elle tourne jusqu'à ce qu'une autre mission la remplace.

## La bascule du 9 mars

Au premier passage à partir du 9 mars 2027 **à 8h, heure de Bruxelles** (pas en pleine nuit au retour de voyage), une seule fois :
- la mission Palerme devient active, et le robot s'appelle **PalermoIA** ;
- un message Telegram annonce : « LisbonIA devient PalermoIA », puis ce que fera l'agent désormais. Il contient aussi trois rappels :
  1. **renouveler la clé GitHub** dans Vercel avant le 31 mars 2027, avec les étapes ;
  2. **renommer le bot** dans Telegram : BotFather, puis `/setname` ;
  3. en option, ajouter l'adresse `escale-ia.vercel.app` au projet Vercel. `escale.vercel.app` est déjà prise, vérifié le 6 novembre. Vercel ne change jamais l'adresse tout seul : c'est Antonino qui l'ajoute, dans *Settings → Domains*. L'ancienne adresse continue de marcher.
- le **premier rapport Palerme** part dans la foulée, sans attendre le lundi.

## La page

- **Un seul site,** dont le contenu suit la **mission active** :
  - nom du robot (LisbonIA, puis PalermoIA) ;
  - trajet ;
  - titres des écrans et des cartes.

  Le décor du bureau, le robot et la visite restent les mêmes.
- **Pendant la mission Palerme, la visite** :
  1. relit ses notes ;
  2. cherche **en direct chez Ryanair** la semaine la moins chère (la même requête gratuite) ;
  3. montre le dernier relevé Google ;
  4. compare avec le **dernier rapport** ;
  5. donne la conclusion, par exemple « La semaine la moins chère reste celle du 12 au 19 mars : 112 € valise comprise » ;
  6. retourne au lit.

  Sous la scène : la courbe et le journal **des rapports hebdomadaires**.
- **Sans code,** la page reste muette, comme aujourd'hui. Seul le **nom du robot de la mission active** peut s'afficher, ce n'est pas une donnée personnelle. Aucune date, aucun prix.
- **Après la fin de toutes les missions,** la page montre le robot « en vacances ».

## Les données

- Chaque mission a **sa propre mémoire** : son état et son historique. La mission Lisbonne garde **toutes ses données actuelles**, sans rien perdre.
- La page relit la mémoire de la mission active, et celle de Lisbonne reste consultable dans l'historique Git.

## Toujours gratuit

| Service | Après le 9 mars |
|---|---|
| Ryanair | Gratuit. Une requête par passage au plus, une par visite de la page. |
| SerpApi (Google) | Environ 1 recherche par semaine, plus le vol retour éventuel, soit **moins de 10 par mois** sur 250. La réserve de 15 et l'absence de carte bancaire restent. |
| GitHub Actions | Les passages horaires restent, mais ceux qui n'ont rien à faire s'arrêtent en quelques secondes et n'enregistrent rien. Chaque passage compte pour une minute, soit **environ 744 minutes par mois au maximum**, comme aujourd'hui, sur les 2 000 gratuites. |
| Vercel, Telegram | Gratuits, inchangés. |

## Hors du périmètre

- Choisir le jour exact du rapport depuis Telegram : il se règle dans la configuration.
- Une alerte « record » pour Palerme.
- Plusieurs voyageurs ou d'autres bagages par mission : la mission les décrit, mais aucune interface ne les modifie.
- Trapani et Catane, aussi desservies par Ryanair depuis Charleroi : possibles plus tard comme mission ou option, pas maintenant.
- Renommer le dépôt GitHub ou le dossier : c'est facultatif, et à faire seulement avec l'accord d'Antonino, car cela touche à des réglages hors du code.

## Ce qui serait un échec

- Un changement qui casse ou modifie la veille Lisbonne avant le 5 mars.
- Une perte des données Lisbonne.
- Un prix Palerme annoncé « valise comprise » sans le supplément de 20 kg.
- Un rapport qui ne part pas une semaine, sans qu'Antonino le sache. Si une source tombe en panne, l'alerte de panne le dit.
- Un dépassement des formules gratuites.
- Une donnée personnelle visible sans le code.

## Laissé au constructeur

- L'organisation des missions dans le code et les données, y compris la migration des fichiers Lisbonne actuels.
- Le texte exact des messages et de la notification de bascule, dans le ton actuel de LisbonIA.
- Les tests, avec une horloge simulée pour le 5 mars, le 9 mars et le lundi 8h.
- Les valeurs mesurées du supplément de valise de 20 kg. Si elles ne sont pas mesurées avant le 9 mars, elles sont affichées comme estimation.
