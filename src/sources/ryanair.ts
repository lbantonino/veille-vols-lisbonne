// Ryanair publie ses tarifs les plus bas via une adresse non officielle mais publique, sans clé
// ni limite connue. On reste raisonnable : quelques appels par heure.
import type { Offre, Sens } from '../types.ts';
import { voyage, bagages, ryanair as reglages } from '../config.ts';
import { arrondi } from '../format.ts';

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
  fares: { outbound: JambeRyanair; inbound: JambeRyanair }[];
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

async function appeler(origine: string, adultes: number): Promise<ReponseRyanair> {
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
    const jambes: [Sens, JambeRyanair][] = [
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

export async function chercherRyanair(maintenant: Date): Promise<Offre[]> {
  const offres: Offre[] = [];
  for (const origine of voyage.depuis) {
    const duo = await appeler(origine, voyage.adultes);
    const solo = voyage.adultes > 1 ? await appeler(origine, 1) : null;
    offres.push(...convertirRyanair(duo, solo, voyage.adultes, bagages.ryanairValise10kgParVol, maintenant));
  }
  return offres;
}
