// Escale enchaîne des missions : chaque destination est une escale, avec son robot.
// Lisbonne (veille actuelle) jusqu'au 9 mars 2027 à 8h, heure de Bruxelles ; ensuite Palerme (rapport hebdomadaire).

export interface MissionLisbonne {
  id: 'lisbonne';
  robot: 'LisbonIA';
  trajet: string;
}

export interface MissionPalerme {
  id: 'palerme';
  robot: 'PalermoIA';
  trajet: string;
  debutUtc: string; // début de la mission (instant UTC)
  vers: string;
  depuisRyanair: string[];
  depuisGoogle: string[];
  adultes: number;
  dureeJours: number; // durée du séjour
  fenetre: { minJours: number; maxJours: number }; // départ entre J+min et J+max du rapport
  valise20kgParVol: Record<string, number>; // supplément valise 20 kg en soute, par compagnie (nom écrit comme par Google)
  valiseEstimee: boolean; // true tant que le supplément n'a pas été mesuré
  lienPage: string;
}

export type Mission = MissionLisbonne | MissionPalerme;

export const LISBONNE: MissionLisbonne = { id: 'lisbonne', robot: 'LisbonIA', trajet: 'Bruxelles → Lisbonne' };

export const PALERME: MissionPalerme = {
  id: 'palerme',
  robot: 'PalermoIA',
  trajet: 'Bruxelles → Palerme',
  // 9 mars 2027 à 8h à Bruxelles (UTC+1 : l'heure d'été ne commence que le 28 mars 2027).
  debutUtc: '2027-03-09T07:00:00Z',
  vers: 'PMO',
  depuisRyanair: ['CRL'], // Ryanair ne dessert Palerme que depuis Charleroi (vérifié le 06/11/2026)
  depuisGoogle: ['BRU', 'CRL'],
  adultes: 1,
  dureeJours: 7,
  fenetre: { minJours: 30, maxJours: 90 },
  // ESTIMATION à remplacer par le vrai prix vu sur ryanair.com avant le 9 mars, puis valiseEstimee: false.
  valise20kgParVol: { Ryanair: 40 },
  valiseEstimee: true,
  lienPage: 'https://lisbonia.vercel.app',
};

export function missionActive(maintenant: Date): Mission {
  return maintenant.getTime() < new Date(PALERME.debutUtc).getTime() ? LISBONNE : PALERME;
}

const BRUXELLES = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' });

// Date du jour à Bruxelles, au format AAAA-MM-JJ.
export const jourBruxelles = (instant: Date): string => BRUXELLES.format(instant);

function semaineIso(jour: string): string {
  const [a = 0, m = 1, j = 1] = jour.split('-').map(Number);
  const date = new Date(Date.UTC(a, m - 1, j));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3); // jeudi de la semaine
  const annee = date.getUTCFullYear();
  const premierJeudi = new Date(Date.UTC(annee, 0, 4));
  premierJeudi.setUTCDate(premierJeudi.getUTCDate() - ((premierJeudi.getUTCDay() + 6) % 7) + 3);
  const semaine = 1 + Math.round((date.getTime() - premierJeudi.getTime()) / (7 * 86_400_000));
  return `${annee}-W${String(semaine).padStart(2, '0')}`;
}

// La semaine de rapport en cours : elle change le lundi à 8h, heure de Bruxelles.
export function semaineDeRapport(maintenant: Date): string {
  return semaineIso(jourBruxelles(new Date(maintenant.getTime() - 8 * 3_600_000)));
}

const plusJours = (jour: string, n: number): string => {
  const [a = 0, m = 1, j = 1] = jour.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
};

// Dates de départ cherchées pour Palerme : de J+min à J+max, comptés depuis aujourd'hui à Bruxelles.
export function fenetreDeDepart(maintenant: Date, m: MissionPalerme): { debut: string; fin: string } {
  const aujourdhui = jourBruxelles(maintenant);
  return { debut: plusJours(aujourdhui, m.fenetre.minJours), fin: plusJours(aujourdhui, m.fenetre.maxJours) };
}

export { plusJours };
