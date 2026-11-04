import type { Offre, Option, Sens } from './types.ts';
import { arrondi } from './format.ts';

export const cleOffre = (o: Pick<Offre, 'source' | 'sens'>): string => `${o.source}:${o.sens}`;

export function estFraiche(o: Offre, maintenant: Date, heuresMax: number): boolean {
  return maintenant.getTime() - new Date(o.observeLe).getTime() <= heuresMax * 3_600_000;
}

// Garde la dernière photo connue de chaque source.
// `clesRafraichies` liste ce qui vient d'être interrogé (ex. "ryanair:aller") : ces offres-là
// sont remplacées, même par une liste vide (vol complet ou supprimé).
export function fusionnerOffres(
  anciennes: Offre[],
  nouvelles: Offre[],
  clesRafraichies: string[],
  maintenant: Date,
  heuresMax: number,
): Offre[] {
  const remplacees = new Set(clesRafraichies);
  return [...anciennes.filter((o) => !remplacees.has(cleOffre(o))), ...nouvelles].filter((o) =>
    estFraiche(o, maintenant, heuresMax),
  );
}

const moinsChere = (offres: Offre[], sens: Sens): Offre | undefined =>
  offres.filter((o) => o.sens === sens).sort((a, b) => a.prixParPersonne - b.prixParPersonne)[0];

// Compare les allers-retours ET la combinaison du meilleur aller simple avec le meilleur retour simple,
// même s'ils viennent de compagnies ou d'aéroports différents.
export function meilleureOption(offres: Offre[]): Option | null {
  const candidats: Option[] = offres
    .filter((o) => o.sens === 'aller-retour')
    .map((o) => ({ prixParPersonne: o.prixParPersonne, offres: [o] }));

  const aller = moinsChere(offres, 'aller');
  const retour = moinsChere(offres, 'retour');
  if (aller && retour) {
    candidats.push({ prixParPersonne: arrondi(aller.prixParPersonne + retour.prixParPersonne), offres: [aller, retour] });
  }

  candidats.sort((a, b) => a.prixParPersonne - b.prixParPersonne);
  return candidats[0] ?? null;
}

// Identifiant du créneau Google en cours, ex. "2026-11-04#3" pour 12h-16h UTC avec des tranches de 4 h.
export function creneauGoogle(maintenant: Date, heuresParCreneau: number): string {
  const jour = maintenant.toISOString().slice(0, 10);
  return `${jour}#${Math.floor(maintenant.getUTCHours() / heuresParCreneau)}`;
}

export const SENS_GOOGLE: Sens[] = ['aller-retour', 'aller', 'retour'];

export const memesVols = (a: Offre, b: Offre): boolean =>
  a.vols.map((v) => v.numero).join('|') === b.vols.map((v) => v.numero).join('|');
