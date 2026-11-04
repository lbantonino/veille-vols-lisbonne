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
  // Part des bagages déjà comptée dans prixParPersonne (estimation pour Ryanair, 0 pour Google).
  bagagesParPersonne: number;
  // Prix trouvé en cherchant pour 1 seule personne, seulement s'il est plus bas que pour le groupe.
  prixSoloParPersonne?: number;
  vols: Vol[]; // pour un aller-retour Google, seul l'aller est connu
  lien: string;
  observeLe: string; // date ISO
}

// Une façon complète de faire le voyage : un aller-retour, ou un aller + un retour séparés.
export interface Option {
  prixParPersonne: number;
  offres: Offre[];
}

export interface AvisGoogle {
  niveau: string; // "low", "typical" ou "high"
  fourchette?: [number, number]; // prix habituels, par personne
}

export interface Etat {
  demarre: boolean;
  termine: boolean;
  record: { prixParPersonne: number; le: string; option: Option } | null;
  dernieresOffres: Offre[];
  echecs: Record<Source, number>;
  google: {
    dernierCreneau: string | null;
    rotation: number;
    niveau: string | null;
    soloLe: string | null;
  };
  cibleAtteinte: boolean;
}

export interface ResultatSource {
  source: Source;
  ok: boolean;
  erreur?: string;
}
