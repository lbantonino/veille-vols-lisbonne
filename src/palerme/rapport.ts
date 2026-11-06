// Le rapport hebdomadaire Palerme : logique pure, sans réseau ni fichier.
import { fenetreDeDepart, semaineDeRapport, type MissionPalerme } from '../missions.ts';
import { arrondi } from '../format.ts';
import type { SemaineRyanair } from '../sources/ryanair.ts';
import type { OffreTrajetGoogle } from '../sources/google.ts';

export interface PrixValise {
  prixHorsValise: number;
  prixParPersonne: number; // valise de 20 kg comprise, sauf si valiseParPersonne est null
  valiseParPersonne: number | null; // null : supplément inconnu pour cette compagnie (« valise non comprise »)
}

export interface Rapport {
  semaine: string;
  le: string;
  fenetre: { debut: string; fin: string };
  ryanair: (SemaineRyanair & PrixValise) | null;
  google: (OffreTrajetGoogle & PrixValise) | null;
  googleAbsent?: string;
  meilleurParPersonne: number | null;
  evolution: number | null; // écart avec `reference`
  premier: boolean; // aucun rapport avant celui-ci
  reference: { prix: number; le: string } | null; // le dernier prix connu avant ce rapport, même après une semaine sans vol
  apresPanneRyanair?: true; // Ryanair répond de nouveau après une panne qui t'a été signalée
}

// Ajoute la valise de 20 kg (aller + retour) quand on connaît le supplément de la compagnie.
export function avecValise(prixHorsValise: number, compagnie: string, m: MissionPalerme): PrixValise {
  const parVol = m.valise20kgParVol[compagnie];
  if (parVol === undefined) return { prixHorsValise, prixParPersonne: prixHorsValise, valiseParPersonne: null };
  return { prixHorsValise, prixParPersonne: arrondi(prixHorsValise + 2 * parVol), valiseParPersonne: 2 * parVol };
}

export function construireRapport(p: {
  maintenant: Date;
  mission: MissionPalerme;
  ryanair: SemaineRyanair | null;
  google: OffreTrajetGoogle | null;
  googleAbsent?: string;
  precedent: Rapport | null;
  apresPanneRyanair?: boolean;
}): Rapport {
  const ryanair = p.ryanair ? { ...p.ryanair, ...avecValise(p.ryanair.prixParPersonne, 'Ryanair', p.mission) } : null;
  const google = p.google ? { ...p.google, ...avecValise(p.google.prixParPersonne, p.google.compagnie, p.mission) } : null;
  const comparables = [ryanair, google].filter((o): o is NonNullable<typeof o> => o !== null && o.valiseParPersonne !== null);
  const meilleur = comparables.length ? Math.min(...comparables.map((o) => o.prixParPersonne)) : null;
  const precedent = p.precedent;
  const reference =
    precedent === null ? null : precedent.meilleurParPersonne !== null ? { prix: precedent.meilleurParPersonne, le: precedent.le } : (precedent.reference ?? null);
  return {
    semaine: semaineDeRapport(p.maintenant),
    le: p.maintenant.toISOString(),
    fenetre: fenetreDeDepart(p.maintenant, p.mission),
    ryanair,
    google,
    ...(p.googleAbsent ? { googleAbsent: p.googleAbsent } : {}),
    meilleurParPersonne: meilleur,
    evolution: meilleur !== null && reference !== null ? arrondi(meilleur - reference.prix) : null,
    premier: precedent === null,
    reference,
    ...(p.apresPanneRyanair ? { apresPanneRyanair: true as const } : {}),
  };
}

// Un rapport par semaine : la semaine de rapport change le lundi à 8h (Bruxelles).
export function doitFaireRapport(dernier: Rapport | null, maintenant: Date): boolean {
  return !dernier || dernier.semaine !== semaineDeRapport(maintenant);
}
