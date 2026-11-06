import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { convertirSemaineRyanair, type ReponseRyanair } from '../../src/sources/ryanair.ts';

// Vraie réponse de Ryanair du 06/11/2026 : CRL → PMO, 1 adulte, départs du 08/04 au 07/06/2027, séjour de 7 jours.
const semaine = JSON.parse(readFileSync(new URL('../fixtures/ryanair-semaine-palerme.json', import.meta.url), 'utf8')) as ReponseRyanair;

test('Ryanair : la semaine la moins chère sur une période', () => {
  const s = convertirSemaineRyanair(semaine, 1);
  assert.ok(s);
  assert.deepEqual(s.aller, { compagnie: 'Ryanair', numero: 'FR6302', de: 'CRL', vers: 'PMO', depart: '2027-05-27T21:40:00' });
  assert.deepEqual(s.retour, { compagnie: 'Ryanair', numero: 'FR6268', de: 'PMO', vers: 'CRL', depart: '2027-06-03T06:20:00' });
  assert.equal(s.prixParPersonne, 91.98);
  assert.match(s.lien, /originIata=CRL/);
  assert.match(s.lien, /dateIn=2027-06-03/);
});

test('Ryanair : aucune semaine trouvée', () => {
  assert.equal(convertirSemaineRyanair({ fares: [] }, 1), null);
});

test('Google : bons paramètres pour une semaine donnée', async () => {
  const { parametresTrajetGoogle } = await import('../../src/sources/google.ts');
  const p = parametresTrajetGoogle({ depuis: ['BRU', 'CRL'], vers: 'PMO', aller: '2027-04-09', retour: '2027-04-16', adultes: 1 }, 'cle');
  assert.equal(p.get('departure_id'), 'BRU,CRL');
  assert.equal(p.get('arrival_id'), 'PMO');
  assert.equal(p.get('outbound_date'), '2027-04-09');
  assert.equal(p.get('return_date'), '2027-04-16');
  assert.equal(p.get('type'), '1');
  assert.equal(p.get('stops'), '1');
  assert.equal(p.get('bags'), '0');
  assert.equal(p.get('adults'), '1');
  assert.equal(p.get('currency'), 'EUR');
});

test('Google : l’offre la moins chère de la semaine, ou rien', async () => {
  const { convertirTrajetGoogle } = await import('../../src/sources/google.ts');
  const vol = (numero: string, compagnie: string) => ({
    departure_airport: { id: 'BRU', time: '2027-04-09 10:00' },
    arrival_airport: { id: 'PMO', time: '2027-04-09 12:40' },
    airline: compagnie,
    flight_number: numero,
  });
  const o = convertirTrajetGoogle(
    {
      best_flights: [{ price: 180, flights: [vol('SN 3171', 'Brussels Airlines')] }],
      other_flights: [{ price: 150, flights: [vol('AZ 123', 'ITA')] }],
      search_metadata: { google_flights_url: 'https://www.google.com/travel/flights?semaine' },
    },
    1,
  );
  assert.equal(o?.prixParPersonne, 150);
  assert.equal(o?.compagnie, 'ITA');
  assert.equal(o?.vols[0]?.numero, 'AZ 123');
  assert.equal(o?.lien, 'https://www.google.com/travel/flights?semaine');
  assert.equal(convertirTrajetGoogle({ error: "Google Flights hasn't returned any results for this query." }, 1), null);
  assert.throws(() => convertirTrajetGoogle({ error: 'Invalid API key.' }, 1), /Invalid API key/);
});
