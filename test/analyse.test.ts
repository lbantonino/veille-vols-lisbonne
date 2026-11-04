import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choisir, creneauGoogle, fusionnerOffres, meilleureOption } from '../src/analyse.ts';
import { enClair, minuteAvant, volDansHoraires } from '../src/horaires.ts';
import type { Offre } from '../src/types.ts';

const maintenant = new Date('2026-11-04T12:30:00Z');

function offre(o: Pick<Offre, 'source' | 'sens' | 'prixParPersonne'> & Partial<Offre>): Offre {
  return {
    bagagesParPersonne: 0,
    dansHoraires: false,
    vols: [],
    lien: 'https://exemple.test',
    observeLe: maintenant.toISOString(),
    ...o,
  };
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

test('deux meilleures options : dans tes horaires et tous horaires confondus', () => {
  const choix = choisir([
    offre({ source: 'ryanair', sens: 'aller', prixParPersonne: 90, dansHoraires: false }),
    offre({ source: 'ryanair', sens: 'retour', prixParPersonne: 120, dansHoraires: false }),
    offre({ source: 'ryanair', sens: 'aller', prixParPersonne: 160, dansHoraires: true }),
    offre({ source: 'ryanair', sens: 'retour', prixParPersonne: 185, dansHoraires: true }),
    offre({ source: 'google', sens: 'aller-retour', prixParPersonne: 202, dansHoraires: false }),
  ]);
  assert.equal(choix.tous?.prixParPersonne, 202);
  assert.equal(choix.tous?.dansHoraires, false);
  assert.equal(choix.horaires?.prixParPersonne, 345);
  assert.equal(choix.horaires?.dansHoraires, true);
});

test("une option n'est dans tes horaires que si tous ses vols le sont", () => {
  const option = meilleureOption([
    offre({ source: 'ryanair', sens: 'aller', prixParPersonne: 90, dansHoraires: true }),
    offre({ source: 'google', sens: 'retour', prixParPersonne: 90, dansHoraires: false }),
  ]);
  assert.equal(option?.dansHoraires, false);
});

test('horaires : aller avant 12h, retour à partir de 17h', () => {
  assert.equal(volDansHoraires('aller', '2027-03-05T08:10:00'), true);
  assert.equal(volDansHoraires('aller', '2027-03-05T11:59'), true);
  assert.equal(volDansHoraires('aller', '2027-03-05T12:00'), false);
  assert.equal(volDansHoraires('aller', '2027-03-05T15:35:00'), false);
  assert.equal(volDansHoraires('retour', '2027-03-08T10:00:00'), false);
  assert.equal(volDansHoraires('retour', '2027-03-08T17:00'), true);
  assert.equal(volDansHoraires('retour', '2027-03-08T17:05:00'), true);
  assert.equal(minuteAvant('12:00'), '11:59');
  assert.equal(enClair('12:00'), '12h');
  assert.equal(enClair('17:30'), '17h30');
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

test('fusion : les deux recherches aller-retour Google ne s’écrasent pas', () => {
  const anciennes = [
    offre({ source: 'google', sens: 'aller-retour', prixParPersonne: 202, requete: 'google:aller-retour' }),
    offre({ source: 'google', sens: 'aller-retour', prixParPersonne: 260, requete: 'google:aller-retour:horaires' }),
  ];
  const resultat = fusionnerOffres(anciennes, [], ['google:aller-retour:horaires'], maintenant, 26);
  assert.deepEqual(
    resultat.map((o) => o.prixParPersonne),
    [202],
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
