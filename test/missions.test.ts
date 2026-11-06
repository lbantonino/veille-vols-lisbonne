import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fenetreDeDepart, missionActive, PALERME, semaineDeRapport } from '../src/missions.ts';

test('mission active : Lisbonne jusqu’au 9 mars 8h (Bruxelles), puis Palerme', () => {
  assert.equal(missionActive(new Date('2027-03-04T12:00:00Z')).id, 'lisbonne');
  assert.equal(missionActive(new Date('2027-03-09T06:59:59Z')).id, 'lisbonne');
  assert.equal(missionActive(new Date('2027-03-09T07:00:00Z')).id, 'palerme');
  assert.equal(missionActive(new Date('2027-03-09T07:00:00Z')).robot, 'PalermoIA');
});

test('semaine de rapport : une nouvelle semaine commence le lundi à 8h, heure de Bruxelles', () => {
  assert.equal(semaineDeRapport(new Date('2027-03-09T10:00:00Z')), '2027-W10');
  assert.equal(semaineDeRapport(new Date('2027-03-15T06:59:00Z')), '2027-W10'); // lundi 7h59
  assert.equal(semaineDeRapport(new Date('2027-03-15T07:00:00Z')), '2027-W11'); // lundi 8h00
  assert.equal(semaineDeRapport(new Date('2027-06-07T06:00:00Z')), '2027-W23'); // lundi 8h00, heure d'été
});

test('fenêtre de départ : de J+30 à J+90', () => {
  assert.deepEqual(fenetreDeDepart(new Date('2027-03-09T07:00:00Z'), PALERME), { debut: '2027-04-08', fin: '2027-06-07' });
});
