import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cheminCourbe, conclusion, formaterPrix, heureBruxelles, lignesEcran, texteAge } from '../../site/js/rendu.js';
import type { Etat, Option } from '../../src/types.ts';

const etat = JSON.parse(readFileSync(new URL('../fixtures/etat-exemple.json', import.meta.url), 'utf8')) as Etat;

const option = (prixParPersonne: number, dansHoraires: boolean): Option => ({ prixParPersonne, dansHoraires, offres: [] });
const comparaison = (horaires: Option | null, tous: Option | null, nouveau: { horaires: boolean; tous: boolean }) => ({
  choix: { horaires, tous },
  nouveauRecord: nouveau,
  records: { horaires: 212, tous: 202 },
  googleVuLe: null,
});

test('prix en euros, à la belge', () => {
  assert.match(formaterPrix(212), /^212,00\s€$/);
});

test('heure de Bruxelles', () => {
  assert.equal(heureBruxelles('2026-11-04T21:17:00Z'), '22h17');
});

test('âge d’une donnée en clair', () => {
  const maintenant = new Date('2026-11-04T22:00:00Z');
  assert.equal(texteAge('2026-11-04T21:55:50Z', maintenant), 'il y a 4 min');
  assert.equal(texteAge('2026-11-04T19:55:00Z', maintenant), 'il y a 2 h');
  assert.equal(texteAge('2026-11-04T21:59:40Z', maintenant), "à l'instant");
  assert.equal(texteAge('2026-11-01T20:00:00Z', maintenant), 'il y a 3 j');
});

test('lignes d’un écran : par heure de départ, 4 au plus, la moins chère repérée', () => {
  const ryanair = etat.dernieresOffres.filter((o) => o.source === 'ryanair');
  const lignes = lignesEcran(ryanair);
  assert.ok(lignes.length <= 4);
  assert.equal(lignes[0]!.texte, 'ven 08:10 FR3610');
  assert.equal(lignes.filter((l) => l.meilleur).length, 1);
  assert.equal(lignes.find((l) => l.meilleur)!.texte, 'ven 15:35 FR1300');
  assert.deepEqual(lignesEcran([]), []);
});

test('courbe : un trou coupe la ligne, aucune valeur donne un tracé vide', () => {
  const d = cheminCourbe([3, null, 1, 2], 100, 50);
  assert.equal((d.match(/M/g) ?? []).length, 2);
  assert.equal(cheminCourbe([null, null], 100, 50), '');
});

test('conclusion : Ryanair en panne', () => {
  assert.equal(
    conclusion(comparaison(null, null, { horaires: false, tous: false }), true),
    'Ryanair ne répond pas en ce moment. Je réessaierai au prochain passage.',
  );
});

test('conclusion : nouveau record dans tes horaires', () => {
  const texte = conclusion(comparaison(option(205, true), option(205, true), { horaires: true, tous: true }), false);
  assert.match(texte, /^🎉 205,00\s€ dans tes horaires, nouveau record ! Je t'envoie l'alerte au prochain passage\.$/);
});

test('conclusion : nouveau record hors horaires', () => {
  const texte = conclusion(comparaison(option(230, true), option(190, false), { horaires: false, tous: true }), false);
  assert.match(texte, /^⏰ Hors de tes horaires : 190,00\s€, nouveau record\. Alerte au prochain passage\.$/);
});

test('conclusion : pas de nouveau record', () => {
  assert.match(
    conclusion(comparaison(option(212, true), option(202, false), { horaires: false, tous: false }), false),
    /^Pas de nouveau record\. Meilleur prix dans tes horaires : 212,00\s€\.$/,
  );
  assert.equal(conclusion(comparaison(null, option(202, false), { horaires: false, tous: false }), false), 'Pas de nouveau record.');
});

test('conclusion : comparaison impossible', () => {
  assert.equal(conclusion(null, false), "Je n'ai pas pu comparer cette fois-ci. Je réessaierai au prochain passage.");
});
