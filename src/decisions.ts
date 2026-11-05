// Le « cerveau » de l'agent : à partir des prix du moment et de ce qu'il a déjà vu,
// il décide quels messages t'envoyer. Aucune requête réseau ici, tout est testable.
import type { AvisGoogle, Choix, Etat, Option, RecordPrix, ResultatSource } from './types.ts';
import {
  messageCible,
  messageDemarrage,
  messagePanne,
  messagePrixBas,
  messageRecordHoraires,
  messageRecordHorsHoraires,
  messageRetablie,
} from './alertes.ts';

export interface Reglages {
  baisseMinimale: number;
  prixCible: number | null;
  echecsAvantAlerte: number;
}

export function etatInitial(): Etat {
  return {
    demarre: false,
    termine: false,
    records: { horaires: null, tous: null },
    dernieresOffres: [],
    echecs: { ryanair: 0, google: 0 },
    google: { dernierCreneau: null, rotation: 0, niveau: null, soloLe: null },
    cibleAtteinte: false,
  };
}

// L'option bat-elle le record d'au moins `baisseMinimale` euros ?
export function bat(record: RecordPrix | null, option: Option | null, r: Reglages): option is Option {
  if (!option) return false;
  if (!record) return true;
  return option.prixParPersonne <= record.prixParPersonne - r.baisseMinimale;
}

// L'option qui va faire l'objet d'une alerte de record, s'il y en a une (dans tes horaires d'abord).
export function optionRecord(etat: Etat, choix: Choix, r: Reglages): Option | null {
  if (bat(etat.records.horaires, choix.horaires, r)) return choix.horaires;
  if (bat(etat.records.tous, choix.tous, r)) return choix.tous;
  return null;
}

export function decider(
  avant: Etat,
  choix: Choix,
  avis: AvisGoogle | null,
  resultats: ResultatSource[],
  r: Reglages,
  maintenant: Date,
): { etat: Etat; messages: string[] } {
  const etat = structuredClone(avant);
  const messages: string[] = [];
  const nouveauRecord = (o: Option): RecordPrix => ({ prixParPersonne: o.prixParPersonne, le: maintenant.toISOString(), option: o });

  // 1. Pannes : on prévient une seule fois, au Nième échec d'affilée, puis au retour à la normale.
  for (const resultat of resultats) {
    if (resultat.ok) {
      if (etat.echecs[resultat.source] >= r.echecsAvantAlerte) messages.push(messageRetablie(resultat.source));
      etat.echecs[resultat.source] = 0;
    } else {
      etat.echecs[resultat.source] += 1;
      if (etat.echecs[resultat.source] === r.echecsAvantAlerte) {
        messages.push(messagePanne(resultat.source, etat.echecs[resultat.source], resultat.erreur));
      }
    }
  }

  // 2. Records : un dans tes horaires, un tous horaires confondus.
  if (!etat.demarre) {
    messages.push(messageDemarrage(choix));
    etat.demarre = true;
    if (choix.horaires) etat.records.horaires = nouveauRecord(choix.horaires);
    if (choix.tous) etat.records.tous = nouveauRecord(choix.tous);
  } else {
    if (bat(etat.records.horaires, choix.horaires, r)) {
      messages.push(messageRecordHoraires(choix.horaires, etat.records.horaires?.prixParPersonne ?? null));
      etat.records.horaires = nouveauRecord(choix.horaires);
    }
    if (bat(etat.records.tous, choix.tous, r)) {
      // Si le record général est dans tes horaires, l'alerte précédente l'a déjà annoncé.
      if (!choix.tous.dansHoraires) {
        messages.push(messageRecordHorsHoraires(choix.tous, etat.records.tous?.prixParPersonne ?? null, choix.horaires));
      }
      etat.records.tous = nouveauRecord(choix.tous);
    }
  }

  // 3. Avis de Google : on prévient quand le prix passe dans la zone « bas ».
  if (avis) {
    if (avis.niveau === 'low' && etat.google.niveau !== 'low') messages.push(messagePrixBas(avis, choix.horaires ?? choix.tous));
    etat.google.niveau = avis.niveau;
  }

  // 4. Prix cible (dans tes horaires) : une alerte au passage dessous, une nouvelle seulement après être repassé au-dessus.
  if (r.prixCible !== null && choix.horaires) {
    if (choix.horaires.prixParPersonne <= r.prixCible) {
      if (!etat.cibleAtteinte) messages.push(messageCible(choix.horaires, r.prixCible));
      etat.cibleAtteinte = true;
    } else {
      etat.cibleAtteinte = false;
    }
  }

  return { etat, messages };
}
