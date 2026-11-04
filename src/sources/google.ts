// Google Flights, interrogé via SerpApi (formule gratuite : 250 recherches par mois).
// Le compte gratuit n'a pas de carte bancaire : SerpApi ne peut rien facturer.
// En plus, l'agent vérifie le quota restant avant CHAQUE recherche (cette vérification est gratuite).
import type { AvisGoogle, Offre, Sens } from '../types.ts';
import { voyage, google as reglages } from '../config.ts';
import { arrondi } from '../format.ts';

interface VolGoogle {
  departure_airport: { id: string; time: string };
  arrival_airport: { id: string; time: string };
  airline: string;
  flight_number: string;
}

interface ResultatGoogle {
  price?: number;
  flights: VolGoogle[];
}

export interface ReponseGoogle {
  error?: string;
  best_flights?: ResultatGoogle[];
  other_flights?: ResultatGoogle[];
  price_insights?: { lowest_price?: number; price_level?: string; typical_price_range?: [number, number] };
  search_metadata?: { google_flights_url?: string };
}

const depuis = (): string => voyage.depuis.join(',');

export function parametresGoogle(sens: Sens, adultes: number, cle: string): URLSearchParams {
  const p = new URLSearchParams({
    engine: 'google_flights',
    adults: String(adultes),
    bags: String(adultes), // un bagage cabine par personne : Google ajoute son prix au total
    currency: 'EUR',
    hl: reglages.langue,
    gl: reglages.pays,
    api_key: cle,
  });
  if (voyage.volsDirectsSeulement) p.set('stops', '1');

  if (sens === 'aller-retour') {
    p.set('type', '1');
    p.set('departure_id', depuis());
    p.set('arrival_id', voyage.vers);
    p.set('outbound_date', voyage.aller);
    p.set('return_date', voyage.retour);
  } else if (sens === 'aller') {
    p.set('type', '2');
    p.set('departure_id', depuis());
    p.set('arrival_id', voyage.vers);
    p.set('outbound_date', voyage.aller);
  } else {
    p.set('type', '2');
    p.set('departure_id', voyage.vers);
    p.set('arrival_id', depuis());
    p.set('outbound_date', voyage.retour);
  }
  return p;
}

export function lienGoogle(sens: Sens, adultes: number): string {
  const q =
    sens === 'aller-retour'
      ? `Flights from ${depuis()} to ${voyage.vers} on ${voyage.aller} through ${voyage.retour}`
      : sens === 'aller'
        ? `One way flights from ${depuis()} to ${voyage.vers} on ${voyage.aller}`
        : `One way flights from ${voyage.vers} to ${depuis()} on ${voyage.retour}`;
  return `https://www.google.com/travel/flights?hl=fr&curr=EUR&q=${encodeURIComponent(`${q} nonstop ${adultes} adults`)}`;
}

export function convertirGoogle(
  reponse: ReponseGoogle,
  sens: Sens,
  adultes: number,
  maintenant: Date,
): { offres: Offre[]; avis: AvisGoogle | null } {
  if (reponse.error) {
    if (/hasn't returned any results/i.test(reponse.error)) return { offres: [], avis: null };
    throw new Error(`SerpApi : ${reponse.error}`);
  }

  const diviseur = reglages.prixEstTotalDuGroupe ? adultes : 1;
  const lien = reponse.search_metadata?.google_flights_url ?? lienGoogle(sens, adultes);
  const resultats = [...(reponse.best_flights ?? []), ...(reponse.other_flights ?? [])];

  const offres: Offre[] = resultats
    .filter((r): r is ResultatGoogle & { price: number } => typeof r.price === 'number')
    .map((r) => ({
      source: 'google' as const,
      sens,
      prixParPersonne: arrondi(r.price / diviseur),
      bagagesParPersonne: 0,
      vols: r.flights.map((v) => ({
        compagnie: v.airline,
        numero: v.flight_number,
        de: v.departure_airport.id,
        vers: v.arrival_airport.id,
        depart: v.departure_airport.time.replace(' ', 'T'),
      })),
      lien,
      observeLe: maintenant.toISOString(),
    }));

  const infos = reponse.price_insights;
  const avis: AvisGoogle | null =
    sens === 'aller-retour' && infos?.price_level
      ? {
          niveau: infos.price_level,
          ...(infos.typical_price_range
            ? {
                fourchette: [
                  arrondi(infos.typical_price_range[0] / diviseur),
                  arrondi(infos.typical_price_range[1] / diviseur),
                ] as [number, number],
              }
            : {}),
        }
      : null;

  return { offres, avis };
}

export async function chercherGoogle(
  sens: Sens,
  adultes: number,
  cle: string,
  maintenant: Date,
): Promise<{ offres: Offre[]; avis: AvisGoogle | null }> {
  const reponse = await fetch(`https://serpapi.com/search.json?${parametresGoogle(sens, adultes, cle)}`, {
    signal: AbortSignal.timeout(60_000),
  });
  const json = (await reponse.json()) as ReponseGoogle;
  if (!reponse.ok && !json.error) throw new Error(`SerpApi a répondu ${reponse.status}`);
  return convertirGoogle(json, sens, adultes, maintenant);
}

// Nombre de recherches gratuites restantes ce mois-ci. Cet appel ne consomme pas de recherche.
export async function lireQuotaSerpApi(cle: string): Promise<number> {
  const reponse = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(cle)}`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!reponse.ok) throw new Error(`SerpApi (compte) a répondu ${reponse.status}`);
  const compte = (await reponse.json()) as { plan_searches_left?: number; total_searches_left?: number };
  const restant = compte.plan_searches_left ?? compte.total_searches_left;
  if (typeof restant !== 'number') throw new Error('SerpApi : quota restant illisible');
  return restant;
}
