// Le « cerveau » de l'agent : à partir des prix du moment et de ce qu'il a déjà vu,
// il décide quels messages t'envoyer. Aucune requête réseau ici, tout est testable.
import type { AvisGoogle, Etat, Option, ResultatSource } from './types.ts';
import {
  messageCible,
  messageDemarrage,
  messagePanne,
  messagePrixBas,
  messageRecord,
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
    record: null,
    dernieresOffres: [],
    echecs: { ryanair: 0, google: 0 },
    google: { dernierCreneau: null, rotation: 0, niveau: null, soloLe: null },
    cibleAtteinte: false,
  };
}

export function seraitUnRecord(etat: Etat, option: Option | null, r: Reglages): boolean {
  if (!option) return false;
  if (!etat.record) return true;
  return option.prixParPersonne <= etat.record.prixParPersonne - r.baisseMinimale;
}

export function decider(
  avant: Etat,
  option: Option | null,
  avis: AvisGoogle | null,
  resultats: ResultatSource[],
  r: Reglages,
  maintenant: Date,
): { etat: Etat; messages: string[] } {
  const etat = structuredClone(avant);
  const messages: string[] = [];

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

  // 2. Record : le prix le plus bas jamais vu, battu d'au moins `baisseMinimale` euros.
  const nouveauRecord = (o: Option) => ({ prixParPersonne: o.prixParPersonne, le: maintenant.toISOString(), option: o });
  if (!etat.demarre) {
    messages.push(messageDemarrage(option));
    etat.demarre = true;
    if (option) etat.record = nouveauRecord(option);
  } else if (option && seraitUnRecord(etat, option, r)) {
    messages.push(messageRecord(option, etat.record?.prixParPersonne ?? null));
    etat.record = nouveauRecord(option);
  }

  // 3. Avis de Google : on prévient quand le prix passe dans la zone « bas ».
  if (avis) {
    if (avis.niveau === 'low' && etat.google.niveau !== 'low') messages.push(messagePrixBas(avis, option));
    etat.google.niveau = avis.niveau;
  }

  // 4. Prix cible : une alerte quand on passe dessous, une nouvelle seulement après être repassé au-dessus.
  if (r.prixCible !== null && option) {
    if (option.prixParPersonne <= r.prixCible) {
      if (!etat.cibleAtteinte) messages.push(messageCible(option, r.prixCible));
      etat.cibleAtteinte = true;
    } else {
      etat.cibleAtteinte = false;
    }
  }

  return { etat, messages };
}
