// Tous les réglages de l'agent sont ici. Le reste du code n'a pas besoin d'être touché.

export const voyage = {
  aller: '2027-03-05', // vendredi
  retour: '2027-03-08', // lundi
  depuis: ['CRL', 'BRU'], // Charleroi et Zaventem
  vers: 'LIS',
  adultes: 2,
  volsDirectsSeulement: true,
} as const;

export const horaires = {
  // Tes horaires préférés (heure locale de chaque aéroport). L'agent surveille quand même TOUS les vols,
  // mais il classe chaque prix « dans tes horaires » ou « hors horaires ».
  allerAvant: '12:00', // le 5 mars, départ de Bruxelles avant cette heure
  retourApres: '17:00', // le 8 mars, départ de Lisbonne à partir de cette heure
};

export const bagages = {
  // Chez Ryanair, le prix de base ne comprend que le petit sac sous le siège.
  // Supplément pour une valise cabine de 10 kg, par personne et par vol.
  // Mesuré le 04/11/2026 : Google Flights affiche 221 € l'aller-retour avec bagage cabine,
  // contre 148,60 € sans chez Ryanair, soit environ 36 € par vol.
  ryanairValise10kgParVol: 36,
};

export const alertes = {
  // Prix par personne, valise comprise, sous lequel tu achètes tout de suite. null = pas de prix cible.
  prixCible: null as number | null,
  // Baisse minimale (en euros) pour annoncer un nouveau record : évite les alertes pour quelques centimes.
  baisseMinimale: 1,
  // Nombre d'échecs d'affilée d'une source avant de te prévenir qu'elle est en panne.
  echecsAvantAlerte: 3,
};

export const quotaGoogle = {
  // Google Flights (via SerpApi) n'est interrogé qu'une fois par tranche de 4 heures, à tour de rôle :
  // aller-retour dans tes horaires, aller-retour tous horaires, aller simple, retour simple.
  // 6 recherches par jour, 186 au maximum sur un mois de 31 jours, pour 250 gratuites.
  heuresParCreneau: 4,
  // L'agent ne descend JAMAIS sous ce nombre de recherches restantes. Aucun dépassement possible.
  reserve: 15,
};

export const ryanair = {
  marche: 'fr-be',
  // Ryanair ne dessert Lisbonne que depuis Charleroi (vérifié le 04/11/2026).
  aeroports: ['CRL'],
};

export const google = {
  pays: 'be',
  langue: 'fr',
  // Google Flights donne le prix total du groupe : on le divise par le nombre d'adultes.
  // À confirmer au premier essai avec la clé SerpApi (npm run essai:google).
  prixEstTotalDuGroupe: true,
};

// Une offre plus vieille que ça n'est plus utilisée pour calculer la meilleure option.
export const fraicheurMaxHeures = 26;
