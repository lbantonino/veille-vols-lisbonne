import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { convertirRyanair, type ReponseRyanair } from '../src/sources/ryanair.ts';
import { convertirGoogle, parametresGoogle, type ReponseGoogle } from '../src/sources/google.ts';

const maintenant = new Date('2026-11-04T12:30:00Z');
const lire = (nom: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${nom}`, import.meta.url), 'utf8')) as ReponseRyanair;

// Vraies réponses de Ryanair du 04/11/2026 pour CRL -> LIS (2 adultes, puis 1 adulte).
const duo = lire('ryanair-duo.json');
const solo = lire('ryanair-solo.json');

test('Ryanair : prix par personne, valise comprise, pour l’aller et le retour', () => {
  const offres = convertirRyanair(duo, solo, 2, 25, maintenant);
  assert.equal(offres.length, 2);
  const [aller, retour] = offres;
  assert.equal(aller!.sens, 'aller');
  assert.equal(aller!.prixParPersonne, 81.61); // 113,22 € / 2 + 25 €
  assert.equal(aller!.vols[0]!.numero, 'FR1300');
  assert.equal(aller!.prixSoloParPersonne, undefined);
  assert.equal(retour!.sens, 'retour');
  assert.equal(retour!.prixParPersonne, 116.99); // 183,98 € / 2 + 25 €
});

test('Ryanair : repère une place seule moins chère', () => {
  const soloMoinsCher = structuredClone(solo);
  soloMoinsCher.fares[0]!.outbound.price.value = 40;
  const [aller] = convertirRyanair(duo, soloMoinsCher, 2, 25, maintenant);
  assert.equal(aller!.prixSoloParPersonne, 65);
});

const reponseGoogle: ReponseGoogle = {
  best_flights: [
    {
      price: 300,
      flights: [
        {
          departure_airport: { id: 'BRU', time: '2027-03-05 07:00' },
          arrival_airport: { id: 'LIS', time: '2027-03-05 09:00' },
          airline: 'TAP Air Portugal',
          flight_number: 'TP 615',
        },
      ],
    },
  ],
  other_flights: [{ flights: [] }],
  price_insights: { price_level: 'low', typical_price_range: [320, 500] },
  search_metadata: { google_flights_url: 'https://www.google.com/travel/flights?exemple' },
};

test('Google : prix du groupe ramené à une personne, avis de prix compris', () => {
  const { offres, avis } = convertirGoogle(reponseGoogle, 'aller-retour', 2, maintenant);
  assert.equal(offres.length, 1); // le résultat sans prix est ignoré
  assert.equal(offres[0]!.prixParPersonne, 150);
  assert.equal(offres[0]!.vols[0]!.depart, '2027-03-05T07:00');
  assert.equal(offres[0]!.lien, 'https://www.google.com/travel/flights?exemple');
  assert.deepEqual(avis, { niveau: 'low', fourchette: [160, 250] });
});

test('Google : « aucun résultat » n’est pas une panne, une autre erreur oui', () => {
  const vide = convertirGoogle({ error: "Google Flights hasn't returned any results for this query." }, 'aller', 2, maintenant);
  assert.equal(vide.offres.length, 0);
  assert.throws(() => convertirGoogle({ error: 'Invalid API key.' }, 'aller', 2, maintenant), /Invalid API key/);
});

test('Google : bons paramètres pour chaque sens', () => {
  const ar = parametresGoogle('aller-retour', 2, 'cle');
  assert.equal(ar.get('type'), '1');
  assert.equal(ar.get('departure_id'), 'CRL,BRU');
  assert.equal(ar.get('return_date'), '2027-03-08');
  assert.equal(ar.get('stops'), '1');
  assert.equal(ar.get('bags'), '2');

  const retour = parametresGoogle('retour', 2, 'cle');
  assert.equal(retour.get('type'), '2');
  assert.equal(retour.get('departure_id'), 'LIS');
  assert.equal(retour.get('arrival_id'), 'CRL,BRU');
  assert.equal(retour.get('outbound_date'), '2027-03-08');
  assert.equal(retour.get('return_date'), null);
});
