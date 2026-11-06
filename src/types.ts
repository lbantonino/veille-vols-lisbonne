export type Source = 'ryanair' | 'google';
export type Sens = 'aller' | 'retour' | 'aller-retour';

export interface Vol {
  compagnie: string;
  numero: string;
  de: string; // code de l'aéroport, ex. CRL
  vers: string;
  depart: string; // heure locale de l'aéroport, ex. 2027-03-05T15:35:00
}

export interface Offre {
  source: Source;
  sens: Sens;
  // Prix pour UNE personne, valise comprise, avec des places pour tout le groupe.
  prixParPersonne: number;
  // Part des bagages déjà comptée dans prixParPersonne (Ryanair ; 0 pour Google qui l'inclut déjà).
  bagagesParPersonne: number;
  // Prix trouvé en cherchant pour 1 seule personne, seulement s'il est plus bas que pour le groupe.
  prixSoloParPersonne?: number;
  // true si l'offre respecte tes horaires. Pour un aller-retour Google sans filtre d'horaires,
  // l'heure du retour est inconnue : false.
  dansHoraires: boolean;
  // Recherche d'origine quand une source en fait plusieurs du même sens (ex. "google:aller-retour:horaires").
  requete?: string;
  vols: Vol[]; // pour un aller-retour Google : l'aller
  // Aller-retour Google : le vol retour, quand l'agent a fait la recherche bonus pour le connaître.
  volsRetour?: Vol[];
  // Jeton Google pour demander le vol retour (jamais enregistré, il ne sert que pendant le passage).
  jetonRetour?: string;
  lien: string;
  observeLe: string; // date ISO
}

// Une façon complète de faire le voyage : un aller-retour, ou un aller + un retour séparés.
export interface Option {
  prixParPersonne: number;
  dansHoraires: boolean;
  offres: Offre[];
}

// Les deux meilleures options du moment : dans tes horaires, et tous horaires confondus.
export interface Choix {
  horaires: Option | null;
  tous: Option | null;
}

export interface AvisGoogle {
  niveau: string; // "low", "typical" ou "high"
  fourchette?: [number, number]; // prix habituels, par personne
}

export interface RecordPrix {
  prixParPersonne: number;
  le: string;
  option: Option;
}

export interface Etat {
  demarre: boolean;
  termine: boolean;
  records: { horaires: RecordPrix | null; tous: RecordPrix | null };
  dernieresOffres: Offre[];
  echecs: Record<Source, number>;
  google: {
    dernierCreneau: string | null;
    rotation: number;
    niveau: string | null;
    bonusLe: string | null; // jour de la dernière recherche bonus (1 par jour au maximum)
  };
  cibleAtteinte: boolean;
}

export interface ResultatSource {
  source: Source;
  ok: boolean;
  erreur?: string;
}
