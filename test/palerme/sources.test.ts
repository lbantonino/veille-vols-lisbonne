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
