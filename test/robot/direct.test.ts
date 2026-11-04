import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comparerEnDirect, lireOffres, oublierCache, verifierRyanair } from '../../src/robot/direct.ts';
import { gererComparer, gererRyanair } from '../../src/robot/http.ts';
import type { Etat, Offre } from '../../src/types.ts';

const etat = JSON.parse(readFileSync(new URL('../fixtures/etat-exemple.json', import.meta.url), 'utf8')) as Etat;
const maintenant = new Date('2026-11-05T00:00:00Z');
const env = { CODE_ACCES: 'code-tres-long-1' };
const avecCode = (chemin: string, corps?: unknown) =>
  new Request(`http://local${chemin}`, {
    method: 'POST',
    headers: { 'x-code-acces': 'code-tres-long-1', 'content-type': 'application/json' },
    ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  });

function jambe(sens: 'aller' | 'retour', prix: number, depart: string): Offre {
  return {
    source: 'ryanair',
    sens,
    prixParPersonne: prix,
    bagagesParPersonne: 36,
    dansHoraires: true,
    vols: [{ compagnie: 'Ryanair', numero: sens === 'aller' ? 'FR3610' : 'FR3609', de: 'CRL', vers: 'LIS', depart }],
    lien: 'https://www.ryanair.com/exemple',
    observeLe: maintenant.toISOString(),
  };
}
const offresBon = [jambe('aller', 50, '2027-03-05T08:10:00'), jambe('retour', 50, '2027-03-08T17:05:00')];

beforeEach(() => oublierCache());

test('Ryanair : un seul appel par minute, puis un nouveau', async () => {
  let appels = 0;
  const chercher = async () => {
    appels += 1;
    return offresBon;
  };
  const premier = await verifierRyanair(maintenant, chercher);
  const second = await verifierRyanair(new Date(maintenant.getTime() + 30_000), chercher);
  assert.equal(appels, 1);
  assert.equal(premier.depuisCache, false);
  assert.equal(second.depuisCache, true);
  assert.equal(second.verifieLe, maintenant.toISOString());

  await verifierRyanair(new Date(maintenant.getTime() + 61_000), chercher);
  assert.equal(appels, 2);
});

test('comparaison : des prix Ryanair frais plus bas battent le record de tes horaires', () => {
  const c = comparerEnDirect(etat, offresBon, maintenant);
  assert.equal(c.nouveauRecord.horaires, true);
  assert.equal(c.choix.horaires?.prixParPersonne, 100);
  assert.equal(c.records.horaires, 212);
  assert.equal(c.googleVuLe, '2026-11-04T20:47:15.071Z');
});

test('comparaison : sans aucun prix Ryanair, Google seul suffit', () => {
  const c = comparerEnDirect(etat, [], maintenant);
  assert.ok(c.choix.tous);
  assert.ok(c.choix.tous.offres.every((o) => o.source === 'google'));
  assert.equal(c.nouveauRecord.horaires, false);
});

test('offres reçues du navigateur : seules les offres Ryanair valides passent', () => {
  assert.deepEqual(lireOffres([{ source: 'google' }, { source: 'ryanair', sens: 'aller', prixParPersonne: -3 }]), []);
  assert.deepEqual(lireOffres('pas un tableau'), []);
  assert.equal(lireOffres({ offres: offresBon }).length, 2);
  assert.equal(lireOffres({ offres: Array.from({ length: 30 }, () => offresBon[0]) }).length, 20);
});

test('Ryanair en panne : 502 avec le message', async () => {
  const deps = {
    chercher: async () => {
      throw new Error('Ryanair a répondu 409 pour CRL');
    },
    maintenant: () => maintenant,
  };
  const res = await gererRyanair(avecCode('/api/ryanair'), env, deps);
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { erreur: 'ryanair', message: 'Ryanair a répondu 409 pour CRL' });
});

test('Ryanair : renvoie les offres et l’heure de vérification', async () => {
  const res = await gererRyanair(avecCode('/api/ryanair'), env, { chercher: async () => offresBon, maintenant: () => maintenant });
  assert.equal(res.status, 200);
  const corps = await res.json();
  assert.equal(corps.offres.length, 2);
  assert.equal(corps.depuisCache, false);
});

test('comparer : lit l’état de l’agent et compare avec les offres envoyées', async () => {
  const deps = { lire: async () => ({ etat, historique: [] }), maintenant: () => maintenant };
  const res = await gererComparer(avecCode('/api/comparer', { offres: offresBon }), env, deps);
  assert.equal(res.status, 200);
  const corps = await res.json();
  assert.equal(corps.nouveauRecord.horaires, true);
});

test('après le départ : 409 « termine », Ryanair jamais appelé', async () => {
  let appels = 0;
  const deps = {
    chercher: async () => {
      appels += 1;
      return offresBon;
    },
    lire: async () => ({ etat, historique: [] }),
    maintenant: () => new Date('2027-03-05T08:00:00Z'),
  };
  const r = await gererRyanair(avecCode('/api/ryanair'), env, deps);
  const c = await gererComparer(avecCode('/api/comparer', { offres: [] }), env, deps);
  assert.equal(r.status, 409);
  assert.equal(c.status, 409);
  assert.deepEqual(await r.json(), { erreur: 'termine' });
  assert.equal(appels, 0);
});

test('Ryanair et comparer : sans code, 401', async () => {
  const sansCode = new Request('http://local/api/ryanair', { method: 'POST' });
  const res = await gererRyanair(sansCode, env, { chercher: async () => offresBon, attendre: async () => {} });
  assert.equal(res.status, 401);
});
