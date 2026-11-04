import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lireHistorique, type LigneHistorique } from '../../src/robot/donnees.ts';
import { passagesReguliers, prochainPassage, resumer } from '../../src/robot/resume.ts';
import { etatInitial } from '../../src/decisions.ts';
import type { Etat } from '../../src/types.ts';

const etat = JSON.parse(readFileSync(new URL('../fixtures/etat-exemple.json', import.meta.url), 'utf8')) as Etat;
const historique = lireHistorique(readFileSync(new URL('../fixtures/historique-exemple.jsonl', import.meta.url), 'utf8'));
const ligne = (le: string, prix = 210): LigneHistorique => ({
  le,
  meilleurDansHoraires: prix,
  meilleurTousHoraires: prix,
  records: { horaires: prix, tous: prix },
  pannes: [],
});

test('journal : les 10 derniers passages, le plus récent d’abord, records repérés', () => {
  const r = resumer(etat, historique, new Date('2026-11-05T00:00:00Z'));
  assert.equal(r.journal.length, 5);
  assert.equal(r.journal[0]!.le, '2026-11-04T23:47:10.000Z');
  assert.deepEqual(
    r.journal.map((l) => l.record),
    [true, false, true, false, false],
  );
  assert.deepEqual(r.journal[1]!.pannes, ['google']);
  assert.equal(r.dernierPassage, '2026-11-04T23:47:10.000Z');
});

test('courbe : 240 points au maximum', () => {
  const longues = Array.from({ length: 300 }, (_, i) => ligne(new Date(Date.UTC(2026, 10, 5) + i * 3_600_000).toISOString(), 200 + (i % 7)));
  const r = resumer(etat, longues, new Date('2026-11-20T00:00:00Z'));
  assert.ok(r.courbe.length <= 240);
  assert.equal(Math.min(...r.courbe.map((p) => p.tous ?? Infinity)), 200);
});

test('agent tout neuf : rien ne casse', () => {
  const r = resumer(etatInitial(), [], new Date('2026-11-05T00:00:00Z'));
  assert.deepEqual(r.journal, []);
  assert.deepEqual(r.courbe, []);
  assert.equal(r.dernierPassage, null);
  assert.equal(r.prochainPassage, null);
  assert.deepEqual(r.ryanair, { offres: [], vuLe: null });
  assert.deepEqual(r.google, { offres: [], vuLe: null });
});

test('fin de la veille : à partir du jour du départ', () => {
  assert.equal(resumer(etat, historique, new Date('2027-03-05T08:00:00Z')).termine, true);
  assert.equal(resumer(etat, historique, new Date('2026-11-05T08:00:00Z')).termine, false);
});

test('passages réguliers : trois passages rapprochés et récents', () => {
  const reguliers = [ligne('2026-11-04T20:17:30Z'), ligne('2026-11-04T21:17:30Z'), ligne('2026-11-04T22:17:30Z')];
  assert.equal(passagesReguliers(reguliers, new Date('2026-11-04T22:40:00Z')), true);

  const trou = [ligne('2026-11-04T18:17:30Z'), ligne('2026-11-04T21:17:30Z'), ligne('2026-11-04T22:17:30Z')];
  assert.equal(passagesReguliers(trou, new Date('2026-11-04T22:40:00Z')), false);
  assert.equal(passagesReguliers(reguliers, new Date('2026-11-05T01:00:00Z')), false);
});

test('prochain passage : la prochaine heure pile + 17 minutes, en UTC', () => {
  assert.equal(prochainPassage(new Date('2026-11-04T22:40:00Z')), '2026-11-04T23:17:00.000Z');
  assert.equal(prochainPassage(new Date('2026-11-04T22:10:00Z')), '2026-11-04T22:17:00.000Z');

  const reguliers = [ligne('2026-11-04T20:17:30Z'), ligne('2026-11-04T21:17:30Z'), ligne('2026-11-04T22:17:30Z')];
  assert.equal(resumer(etat, reguliers, new Date('2026-11-04T22:40:00Z')).prochainPassage, '2026-11-04T23:17:00.000Z');
});

test('résumé : offres Ryanair et Google séparées, avec leur date', () => {
  const r = resumer(etat, historique, new Date('2026-11-05T00:00:00Z'));
  assert.ok(r.ryanair.offres.length > 0 && r.ryanair.offres.every((o) => o.source === 'ryanair'));
  assert.ok(r.google.offres.length > 0 && r.google.offres.every((o) => o.source === 'google'));
  assert.equal(r.google.vuLe, '2026-11-04T20:47:15.071Z');
  assert.equal(r.voyage.horaires, 'aller avant 12h, retour après 17h');
});
