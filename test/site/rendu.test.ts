import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bornesCommunes,
  cheminCourbe,
  conclusion,
  dateVoyage,
  formaterPrix,
  heureBruxelles,
  lignesEcran,
  lignesRecord,
  momentJournal,
  pointMinimum,
  texteAge,
  texteDernierPassage,
} from '../../site/js/rendu.js';
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

test('courbes comparables : une échelle commune aux deux séries', () => {
  assert.deepEqual(bornesCommunes([[3, null, 1], [5, 2]]), { min: 1, max: 5 });
  assert.equal(bornesCommunes([[null], []]), null);
  assert.equal(cheminCourbe([10, 20], 100, 50, { min: 0, max: 20 }), 'M0.0 25.0 L100.0 0.0');
});

test('le record est repéré sur la courbe', () => {
  assert.deepEqual(pointMinimum([3, 1, 2], 100, 50, { min: 1, max: 3 }), { x: 50, y: 50, valeur: 1 });
  assert.equal(pointMinimum([null, null], 100, 50, null), null);
});

test('dates en clair', () => {
  assert.equal(dateVoyage('2027-03-05'), 'ven. 5 mars');
  assert.equal(dateVoyage('2027-03-08'), 'lun. 8 mars');
  assert.equal(momentJournal('2026-11-04T21:17:00Z'), 'mer. 4 nov. · 22h17');
});

test('dernier passage : l’heure seule aujourd’hui, avec la date sinon', () => {
  const maintenant = new Date('2026-11-04T22:30:00Z'); // 23h30 à Bruxelles
  assert.equal(texteDernierPassage('2026-11-04T21:17:00Z', maintenant), '22h17');
  assert.equal(texteDernierPassage('2026-11-02T21:17:00Z', maintenant), 'lun. 2 nov. · 22h17');
});

test('record : l’aller et le retour quand Google les a donnés, sinon « retour au choix »', () => {
  const aller = { compagnie: 'TAP Air Portugal', numero: 'TP 647', de: 'BRU', vers: 'LIS', depart: '2027-03-05T06:00' };
  const retour = { compagnie: 'TAP Air Portugal', numero: 'TP 644', de: 'LIS', vers: 'BRU', depart: '2027-03-08T17:45' };
  assert.deepEqual(lignesRecord([{ sens: 'aller-retour', vols: [aller], volsRetour: [retour] }]), [
    { texte: 'ven 06:00 TP 647', trajet: 'Zaventem → Lisbonne' },
    { texte: 'lun 17:45 TP 644', trajet: 'Lisbonne → Zaventem' },
  ]);
  assert.deepEqual(lignesRecord([{ sens: 'aller-retour', vols: [aller] }]), [
    { texte: 'ven 06:00 TP 647', trajet: 'Zaventem → Lisbonne' },
    { note: 'Retour au choix sur Google Flights' },
  ]);
});
