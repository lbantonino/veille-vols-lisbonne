import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creneauGoogle, fusionnerOffres, meilleureOption } from '../src/analyse.ts';
import type { Offre } from '../src/types.ts';

const maintenant = new Date('2026-11-04T12:30:00Z');

function offre(o: Pick<Offre, 'source' | 'sens' | 'prixParPersonne'> & Partial<Offre>): Offre {
  return { bagagesParPersonne: 0, vols: [], lien: 'https://exemple.test', observeLe: maintenant.toISOString(), ...o };
}

test('prend un aller et un retour séparés quand ils coûtent moins cher ensemble', () => {
  const option = meilleureOption([
    offre({ source: 'google', sens: 'aller-retour', prixParPersonne: 200 }),
    offre({ source: 'ryanair', sens: 'aller', prixParPersonne: 80 }),
    offre({ source: 'ryanair', sens: 'retour', prixParPersonne: 117 }),
    offre({ source: 'google', sens: 'retour', prixParPersonne: 90 }),
  ]);
  assert.equal(option?.prixParPersonne, 170);
  assert.deepEqual(
    option?.offres.map((o) => `${o.source}:${o.sens}`),
    ['ryanair:aller', 'google:retour'],
  );
});

test("garde l'aller-retour quand il bat la combinaison", () => {
  const option = meilleureOption([
    offre({ source: 'google', sens: 'aller-retour', prixParPersonne: 200 }),
    offre({ source: 'ryanair', sens: 'aller', prixParPersonne: 80 }),
    offre({ source: 'ryanair', sens: 'retour', prixParPersonne: 130 }),
  ]);
  assert.equal(option?.prixParPersonne, 200);
  assert.equal(option?.offres.length, 1);
});

test('sans retour connu, aucune option complète', () => {
  assert.equal(meilleureOption([offre({ source: 'ryanair', sens: 'aller', prixParPersonne: 80 })]), null);
});

test("fusion : remplace ce qui vient d'être interrogé, même par une liste vide", () => {
  const anciennes = [
    offre({ source: 'ryanair', sens: 'aller', prixParPersonne: 80 }),
    offre({ source: 'google', sens: 'aller', prixParPersonne: 95 }),
  ];
  const resultat = fusionnerOffres(anciennes, [], ['ryanair:aller'], maintenant, 26);
  assert.deepEqual(
    resultat.map((o) => o.source),
    ['google'],
  );
});

test('fusion : oublie les offres trop anciennes', () => {
  const vieille = offre({ source: 'google', sens: 'aller', prixParPersonne: 50, observeLe: '2026-11-03T08:00:00Z' });
  assert.equal(fusionnerOffres([vieille], [], [], maintenant, 26).length, 0);
});

test('créneau Google : une seule recherche par tranche de 4 heures', () => {
  assert.equal(creneauGoogle(new Date('2026-11-04T12:00:00Z'), 4), '2026-11-04#3');
  assert.equal(creneauGoogle(new Date('2026-11-04T15:59:00Z'), 4), '2026-11-04#3');
  assert.equal(creneauGoogle(new Date('2026-11-04T16:00:00Z'), 4), '2026-11-04#4');
});
