// Ce que la page affiche, préparé côté serveur à partir de la mémoire de l'agent.
import type { Etat, Offre, Source } from '../types.ts';
import { passage, voyage } from '../config.ts';
import { texteHoraires } from '../horaires.ts';
import type { LigneHistorique } from './donnees.ts';
import { LISBONNE, PALERME } from '../missions.ts';
import type { EtatPalerme } from '../palerme/stockage.ts';
import type { Rapport } from '../palerme/rapport.ts';

export interface InfosMission {
  id: 'lisbonne' | 'palerme';
  robot: string;
  trajet: string;
  details: string;
  valiseEstimee?: boolean; // Palerme : le supplément valise de 20 kg est encore une estimation
}

export interface LigneJournal {
  le: string;
  dansHoraires: number | null;
  tous: number | null;
  record: boolean;
  pannes: string[];
}

export interface PointCourbe {
  le: string;
  dansHoraires: number | null;
  tous: number | null;
}

export interface Resume {
  mission: InfosMission;
  voyage: { aller: string; retour: string; horaires: string };
  records: Etat['records'];
  dernierPassage: string | null;
  prochainPassage: string | null;
  journal: LigneJournal[];
  courbe: PointCourbe[];
  ryanair: { offres: Offre[]; vuLe: string | null };
  google: { offres: Offre[]; vuLe: string | null };
  echecs: Etat['echecs'];
  termine: boolean;
}

const TAILLE_JOURNAL = 10;
const POINTS_MAX = 240;
const ECART_MAX_MS = 75 * 60_000;
const ECART_MIN_MS = 45 * 60_000; // en dessous, ce sont des lancements manuels, pas le rythme horaire

const baisse = (avant: number | null, apres: number | null): boolean => avant !== null && apres !== null && apres < avant;

const minOuNull = (valeurs: (number | null)[]): number | null => {
  const nombres = valeurs.filter((v): v is number => v !== null);
  return nombres.length ? Math.min(...nombres) : null;
};

function journal(historique: LigneHistorique[]): LigneJournal[] {
  return historique
    .map((ligne, i) => {
      const precedente = historique[i - 1];
      return {
        le: ligne.le,
        dansHoraires: ligne.meilleurDansHoraires,
        tous: ligne.meilleurTousHoraires,
        record:
          precedente !== undefined &&
          (baisse(precedente.records.horaires, ligne.records.horaires) || baisse(precedente.records.tous, ligne.records.tous)),
        pannes: ligne.pannes,
      };
    })
    .slice(-TAILLE_JOURNAL)
    .reverse();
}

// Au-delà de 240 passages, regroupe les passages voisins et garde le prix le plus bas de chaque groupe.
function courbe(historique: LigneHistorique[]): PointCourbe[] {
  const taille = Math.max(1, Math.ceil(historique.length / POINTS_MAX));
  const points: PointCourbe[] = [];
  for (let i = 0; i < historique.length; i += taille) {
    const paquet = historique.slice(i, i + taille);
    points.push({
      le: paquet[0]!.le,
      dansHoraires: minOuNull(paquet.map((l) => l.meilleurDansHoraires)),
      tous: minOuNull(paquet.map((l) => l.meilleurTousHoraires)),
    });
  }
  return points;
}

// Les passages automatiques sont réguliers si les 3 derniers sont espacés d'environ une heure
// (entre 45 et 75 minutes) et que le dernier est récent.
export function passagesReguliers(historique: LigneHistorique[], maintenant: Date): boolean {
  const derniers = historique.slice(-3).map((l) => new Date(l.le).getTime());
  if (derniers.length < 3) return false;
  const ecartsOk = derniers.every((t, i) => {
    if (i === 0) return true;
    const ecart = t - derniers[i - 1]!;
    return ecart >= ECART_MIN_MS && ecart <= ECART_MAX_MS;
  });
  return ecartsOk && maintenant.getTime() - derniers[derniers.length - 1]! <= ECART_MAX_MS;
}

// La prochaine heure pile + `passage.minuteUtc`, strictement après `maintenant`.
export function prochainPassage(maintenant: Date): string {
  const prochain = new Date(maintenant);
  prochain.setUTCMinutes(passage.minuteUtc, 0, 0);
  if (prochain.getTime() <= maintenant.getTime()) prochain.setUTCHours(prochain.getUTCHours() + 1);
  return prochain.toISOString();
}

function offresDe(etat: Etat, source: Source): { offres: Offre[]; vuLe: string | null } {
  const offres = etat.dernieresOffres.filter((o) => o.source === source);
  const vuLe = offres.reduce<string | null>((plusRecent, o) => (plusRecent === null || o.observeLe > plusRecent ? o.observeLe : plusRecent), null);
  return { offres, vuLe };
}

// Le jour du départ, la veille est terminée (même règle que l'agent).
export const voyageCommence = (maintenant: Date): boolean => maintenant.toISOString().slice(0, 10) >= voyage.aller;

export function resumer(etat: Etat, historique: LigneHistorique[], maintenant: Date): Resume {
  return {
    mission: { id: 'lisbonne', robot: LISBONNE.robot, trajet: LISBONNE.trajet, details: `${voyage.adultes} adultes · ${texteHoraires()}` },
    voyage: { aller: voyage.aller, retour: voyage.retour, horaires: texteHoraires() },
    records: etat.records,
    dernierPassage: historique.at(-1)?.le ?? null,
    prochainPassage: passagesReguliers(historique, maintenant) ? prochainPassage(maintenant) : null,
    journal: journal(historique),
    courbe: courbe(historique),
    ryanair: offresDe(etat, 'ryanair'),
    google: offresDe(etat, 'google'),
    echecs: etat.echecs,
    termine: voyageCommence(maintenant),
  };
}

// ---------- Mission Palerme ----------

export interface ResumePalerme {
  mission: InfosMission;
  dernierRapport: Rapport | null;
  journal: Rapport[]; // 10 derniers rapports, le plus récent d'abord
  courbe: { le: string; meilleur: number | null }[];
  dernierPassage: string | null;
  termine: false;
}

export function resumerPalerme(etat: EtatPalerme, rapports: Rapport[], _maintenant: Date): ResumePalerme {
  const dernierRapport = etat.dernierRapport ?? rapports.at(-1) ?? null;
  return {
    mission: {
      id: 'palerme',
      robot: PALERME.robot,
      trajet: PALERME.trajet,
      details: `${PALERME.adultes} adulte · valise 20 kg · ${PALERME.dureeJours} jours, départ dans 1 à 3 mois`,
      valiseEstimee: PALERME.valiseEstimee,
    },
    dernierRapport,
    journal: rapports.slice(-TAILLE_JOURNAL).reverse(),
    courbe: rapports.slice(-POINTS_MAX).map((r) => ({ le: r.le, meilleur: r.meilleurParPersonne })),
    dernierPassage: dernierRapport?.le ?? null,
    termine: false,
  };
}
