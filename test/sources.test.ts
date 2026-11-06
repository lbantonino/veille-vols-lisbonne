import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { convertirRyanair, type ReponseRyanair } from '../src/sources/ryanair.ts';
import {
  convertirGoogle,
  convertirRetourGoogle,
  parametresGoogle,
  parametresRetourGoogle,
  type ReponseGoogle,
} from '../src/sources/google.ts';

const maintenant = new Date('2026-11-04T12:30:00Z');
const lire = (nom: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${nom}`, import.meta.url), 'utf8')) as ReponseRyanair;

// Vraies réponses de Ryanair du 04/11/2026 pour CRL -> LIS (2 adultes, puis 1 adulte).
// Aller FR1300 à 15h35, retour FR1301 à 10h00 : tous deux hors de tes horaires.
const duo = lire('ryanair-duo.json');
const solo = lire('ryanair-solo.json');

test('Ryanair : prix par personne, valise comprise, pour l’aller et le retour', () => {
  const offres = convertirRyanair(duo, solo, 2, 36, maintenant);
  assert.equal(offres.length, 2);
  const [aller, retour] = offres;
  assert.equal(aller!.sens, 'aller');
  assert.equal(aller!.prixParPersonne, 92.61); // 113,22 € / 2 + 36 €
  assert.equal(aller!.vols[0]!.numero, 'FR1300');
  assert.equal(aller!.prixSoloParPersonne, undefined);
  assert.equal(aller!.dansHoraires, false); // 15h35, après 12h
  assert.equal(retour!.sens, 'retour');
  assert.equal(retour!.prixParPersonne, 127.99); // 183,98 € / 2 + 36 €
  assert.equal(retour!.dansHoraires, false); // 10h00, avant 17h
});

test('Ryanair : repère une place seule moins chère', () => {
  const soloMoinsCher = structuredClone(solo);
  soloMoinsCher.fares[0]!.outbound.price.value = 40;
  const [aller] = convertirRyanair(duo, soloMoinsCher, 2, 36, maintenant);
  assert.equal(aller!.prixSoloParPersonne, 76);
});

const reponseGoogle: ReponseGoogle = {
  best_flights: [
    {
      price: 404,
      flights: [
        {
          departure_airport: { id: 'BRU', time: '2027-03-05 06:00' },
          arrival_airport: { id: 'LIS', time: '2027-03-05 07:50' },
          airline: 'TAP Air Portugal',
          flight_number: 'TP 647',
        },
      ],
      departure_token: 'jeton-du-retour',
    },
  ],
  other_flights: [{ flights: [] }],
  price_insights: { price_level: 'low', typical_price_range: [320, 500] },
  search_metadata: { google_flights_url: 'https://www.google.com/travel/flights?exemple' },
};

test('Google : prix du groupe ramené à une personne, avis de prix compris', () => {
  const { offres, avis } = convertirGoogle(reponseGoogle, { sens: 'aller-retour', horaires: false }, 2, maintenant);
  assert.equal(offres.length, 1); // le résultat sans prix est ignoré
  assert.equal(offres[0]!.prixParPersonne, 202);
  assert.equal(offres[0]!.vols[0]!.depart, '2027-03-05T06:00');
  assert.equal(offres[0]!.lien, 'https://www.google.com/travel/flights?exemple');
  assert.equal(offres[0]!.requete, 'google:aller-retour');
  assert.deepEqual(avis, { niveau: 'low', fourchette: [160, 250] });
});

test('Google : un aller-retour n’est dans tes horaires que si la recherche était filtrée', () => {
  const sansFiltre = convertirGoogle(reponseGoogle, { sens: 'aller-retour', horaires: false }, 2, maintenant);
  assert.equal(sansFiltre.offres[0]!.dansHoraires, false); // heure du retour inconnue

  const filtre = convertirGoogle(reponseGoogle, { sens: 'aller-retour', horaires: true }, 2, maintenant);
  assert.equal(filtre.offres[0]!.dansHoraires, true);
  assert.equal(filtre.offres[0]!.requete, 'google:aller-retour:horaires');
});

test('Google : « aucun résultat » n’est pas une panne, une autre erreur oui', () => {
  const aller = { sens: 'aller', horaires: false } as const;
  const vide = convertirGoogle({ error: "Google Flights hasn't returned any results for this query." }, aller, 2, maintenant);
  assert.equal(vide.offres.length, 0);
  assert.throws(() => convertirGoogle({ error: 'Invalid API key.' }, aller, 2, maintenant), /Invalid API key/);
});

test('Google : bons paramètres pour chaque recherche', () => {
  const ar = parametresGoogle({ sens: 'aller-retour', horaires: false }, 2, 'cle');
  assert.equal(ar.get('type'), '1');
  assert.equal(ar.get('departure_id'), 'CRL,BRU');
  assert.equal(ar.get('return_date'), '2027-03-08');
  assert.equal(ar.get('stops'), '1');
  assert.equal(ar.get('bags'), '2');
  assert.equal(ar.get('outbound_times'), null);

  const arHoraires = parametresGoogle({ sens: 'aller-retour', horaires: true }, 2, 'cle');
  assert.equal(arHoraires.get('outbound_times'), '0,11');
  assert.equal(arHoraires.get('return_times'), '17,23');

  const retour = parametresGoogle({ sens: 'retour', horaires: false }, 2, 'cle');
  assert.equal(retour.get('type'), '2');
  assert.equal(retour.get('departure_id'), 'LIS');
  assert.equal(retour.get('arrival_id'), 'CRL,BRU');
  assert.equal(retour.get('outbound_date'), '2027-03-08');
  assert.equal(retour.get('return_date'), null);
});

test('Google : le jeton du vol retour est gardé sur l’aller-retour', () => {
  const { offres } = convertirGoogle(reponseGoogle, { sens: 'aller-retour', horaires: true }, 2, maintenant);
  assert.equal(offres[0]!.jetonRetour, 'jeton-du-retour');
  const aller = convertirGoogle(reponseGoogle, { sens: 'aller', horaires: false }, 2, maintenant);
  assert.equal(aller.offres[0]!.jetonRetour, undefined);
});

test('Google : la recherche du retour reprend la même recherche, avec le jeton', () => {
  const p = parametresRetourGoogle({ sens: 'aller-retour', horaires: true }, 2, 'cle', 'jeton-du-retour');
  assert.equal(p.get('departure_token'), 'jeton-du-retour');
  assert.equal(p.get('type'), '1');
  assert.equal(p.get('return_times'), '17,23');
  assert.equal(p.get('adults'), '2');
});

test('Google : le vol retour le moins cher est retenu', () => {
  const retour: ReponseGoogle = {
    best_flights: [
      {
        price: 440,
        flights: [
          {
            departure_airport: { id: 'LIS', time: '2027-03-08 19:30' },
            arrival_airport: { id: 'BRU', time: '2027-03-08 23:10' },
            airline: 'TAP Air Portugal',
            flight_number: 'TP 646',
          },
        ],
      },
      {
        price: 424,
        flights: [
          {
            departure_airport: { id: 'LIS', time: '2027-03-08 17:45' },
            arrival_airport: { id: 'BRU', time: '2027-03-08 21:25' },
            airline: 'TAP Air Portugal',
            flight_number: 'TP 644',
          },
        ],
      },
    ],
  };
  const r = convertirRetourGoogle(retour, 2);
  assert.equal(r?.prixParPersonne, 212);
  assert.deepEqual(r?.vols, [{ compagnie: 'TAP Air Portugal', numero: 'TP 644', de: 'LIS', vers: 'BRU', depart: '2027-03-08T17:45' }]);
  assert.equal(convertirRetourGoogle({ error: "Google Flights hasn't returned any results for this query." }, 2), null);
});
