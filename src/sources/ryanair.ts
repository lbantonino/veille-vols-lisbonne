// Ryanair publie ses tarifs les plus bas via une adresse non officielle mais publique, sans clé
// ni limite connue. On reste raisonnable : 4 appels par heure.
import type { Offre, Vol } from '../types.ts';
import { voyage, bagages, horaires, ryanair as reglages } from '../config.ts';
import { arrondi } from '../format.ts';
import { minuteAvant, volDansHoraires } from '../horaires.ts';
import { plusJours } from '../missions.ts';

const BASE = 'https://www.ryanair.com/api/farfnd/v4/roundTripFares';
const NAVIGATEUR =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

interface JambeRyanair {
  departureAirport: { iataCode: string };
  arrivalAirport: { iataCode: string };
  departureDate: string;
  flightNumber: string;
  price: { value: number; currencyCode: string };
}

export interface ReponseRyanair {
  fares: { outbound: JambeRyanair; inbound: JambeRyanair; summary?: { price: { value: number } } }[];
}

export function lienRyanair(de: string, vers: string, aller: string, adultes: number, retour?: string): string {
  const p = new URLSearchParams({
    adults: String(adultes),
    teens: '0',
    children: '0',
    infants: '0',
    dateOut: aller,
    dateIn: retour ?? '',
    isConnectedFlight: 'false',
    discount: '0',
    promoCode: '',
    isReturn: String(Boolean(retour)),
    originIata: de,
    destinationIata: vers,
  });
  return `https://www.ryanair.com/be/fr/trip/flights/select?${p}`;
}

// `dansTesHoraires` : ne garder que les vols aller avant 12h et retour après 17h (filtre de Ryanair).
async function appeler(origine: string, adultes: number, dansTesHoraires: boolean): Promise<ReponseRyanair> {
  const p = new URLSearchParams({
    departureAirportIataCode: origine,
    arrivalAirportIataCode: voyage.vers,
    outboundDepartureDateFrom: voyage.aller,
    outboundDepartureDateTo: voyage.aller,
    inboundDepartureDateFrom: voyage.retour,
    inboundDepartureDateTo: voyage.retour,
    market: reglages.marche,
    adultPaxCount: String(adultes),
  });
  if (dansTesHoraires) {
    p.set('outboundDepartureTimeFrom', '00:00');
    p.set('outboundDepartureTimeTo', minuteAvant(horaires.allerAvant));
    p.set('inboundDepartureTimeFrom', horaires.retourApres);
    p.set('inboundDepartureTimeTo', '23:59');
  }
  const reponse = await fetch(`${BASE}?${p}`, {
    headers: { 'user-agent': NAVIGATEUR, accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!reponse.ok) throw new Error(`Ryanair a répondu ${reponse.status} pour ${origine}`);
  return (await reponse.json()) as ReponseRyanair;
}

// Transforme la réponse de Ryanair en offres (un aller et un retour par tarif trouvé).
// `duo` = recherche pour tout le groupe, `solo` = recherche pour 1 personne.
export function convertirRyanair(
  duo: ReponseRyanair,
  solo: ReponseRyanair | null,
  adultes: number,
  valiseParVol: number,
  maintenant: Date,
): Offre[] {
  const jambesSolo = solo?.fares.flatMap((f) => [f.outbound, f.inbound]) ?? [];
  const offres: Offre[] = [];

  for (const tarif of duo.fares) {
    const jambes: ['aller' | 'retour', JambeRyanair][] = [
      ['aller', tarif.outbound],
      ['retour', tarif.inbound],
    ];
    for (const [sens, jambe] of jambes) {
      if (jambe.price.currencyCode !== 'EUR') throw new Error(`Ryanair : devise inattendue ${jambe.price.currencyCode}`);
      const parPersonne = jambe.price.value / adultes;
      const memeVolSolo = jambesSolo.find(
        (j) => j.flightNumber === jambe.flightNumber && j.departureDate === jambe.departureDate,
      );
      const soloMoinsCher = memeVolSolo !== undefined && memeVolSolo.price.value < parPersonne - 0.01;

      offres.push({
        source: 'ryanair',
        sens,
        prixParPersonne: arrondi(parPersonne + valiseParVol),
        bagagesParPersonne: valiseParVol,
        ...(soloMoinsCher ? { prixSoloParPersonne: arrondi(memeVolSolo.price.value + valiseParVol) } : {}),
        dansHoraires: volDansHoraires(sens, jambe.departureDate),
        vols: [
          {
            compagnie: 'Ryanair',
            numero: jambe.flightNumber,
            de: jambe.departureAirport.iataCode,
            vers: jambe.arrivalAirport.iataCode,
            depart: jambe.departureDate,
          },
        ],
        lien: lienRyanair(
          jambe.departureAirport.iataCode,
          jambe.arrivalAirport.iataCode,
          jambe.departureDate.slice(0, 10),
          adultes,
        ),
        observeLe: maintenant.toISOString(),
      });
    }
  }
  return offres;
}

// Deux recherches par aéroport : le moins cher tous horaires, et le moins cher dans tes horaires.
export async function chercherRyanair(maintenant: Date): Promise<Offre[]> {
  const offres: Offre[] = [];
  for (const origine of reglages.aeroports) {
    for (const dansTesHoraires of [false, true]) {
      const duo = await appeler(origine, voyage.adultes, dansTesHoraires);
      const solo = voyage.adultes > 1 ? await appeler(origine, 1, dansTesHoraires) : null;
      offres.push(...convertirRyanair(duo, solo, voyage.adultes, bagages.ryanairValise10kgParVol, maintenant));
    }
  }
  return offres;
}

// ---------- Escale : la semaine la moins chère sur une période (mission Palerme) ----------

export interface SemaineRyanair {
  aller: Vol;
  retour: Vol;
  prixParPersonne: number; // aller-retour, hors valise
  lien: string;
}

const versVol = (j: JambeRyanair): Vol => ({
  compagnie: 'Ryanair',
  numero: j.flightNumber,
  de: j.departureAirport.iataCode,
  vers: j.arrivalAirport.iataCode,
  depart: j.departureDate,
});

export function convertirSemaineRyanair(reponse: ReponseRyanair, adultes: number): SemaineRyanair | null {
  const total = (f: ReponseRyanair['fares'][number]) => f.summary?.price.value ?? f.outbound.price.value + f.inbound.price.value;
  const moinsCher = [...reponse.fares].sort((a, b) => total(a) - total(b))[0];
  if (!moinsCher) return null;
  for (const jambe of [moinsCher.outbound, moinsCher.inbound]) {
    if (jambe.price.currencyCode !== 'EUR') throw new Error(`Ryanair : devise inattendue ${jambe.price.currencyCode}`);
  }
  const aller = versVol(moinsCher.outbound);
  const retour = versVol(moinsCher.inbound);
  return {
    aller,
    retour,
    prixParPersonne: arrondi(total(moinsCher) / adultes),
    lien: lienRyanair(aller.de, aller.vers, aller.depart.slice(0, 10), adultes, retour.depart.slice(0, 10)),
  };
}

// Une requête par aéroport de départ : Ryanair renvoie lui-même l'aller-retour le moins cher de la période.
export async function chercherSemaineRyanair(p: {
  depuis: string[];
  vers: string;
  debut: string; // premier départ possible (AAAA-MM-JJ)
  fin: string; // dernier départ possible
  dureeJours: number;
  adultes: number;
}): Promise<SemaineRyanair | null> {
  const trouvees: SemaineRyanair[] = [];
  for (const origine of p.depuis) {
    const q = new URLSearchParams({
      departureAirportIataCode: origine,
      arrivalAirportIataCode: p.vers,
      outboundDepartureDateFrom: p.debut,
      outboundDepartureDateTo: p.fin,
      inboundDepartureDateFrom: p.debut,
      inboundDepartureDateTo: plusJours(p.fin, p.dureeJours),
      durationFrom: String(p.dureeJours),
      durationTo: String(p.dureeJours),
      market: reglages.marche,
      adultPaxCount: String(p.adultes),
    });
    const reponse = await fetch(`${BASE}?${q}`, {
      headers: { 'user-agent': NAVIGATEUR, accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!reponse.ok) throw new Error(`Ryanair a répondu ${reponse.status} pour ${origine}`);
    const semaine = convertirSemaineRyanair((await reponse.json()) as ReponseRyanair, p.adultes);
    if (semaine) trouvees.push(semaine);
  }
  return trouvees.sort((a, b) => a.prixParPersonne - b.prixParPersonne)[0] ?? null;
}
