import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decider, etatInitial, type Reglages } from '../src/decisions.ts';
import type { Etat, Option } from '../src/types.ts';

const maintenant = new Date('2026-11-04T12:30:00Z');
const reglages: Reglages = { baisseMinimale: 1, prixCible: null, echecsAvantAlerte: 3 };

function option(prixParPersonne: number): Option {
  return {
    prixParPersonne,
    offres: [
      {
        source: 'ryanair',
        sens: 'aller',
        prixParPersonne: prixParPersonne / 2,
        bagagesParPersonne: 25,
        vols: [{ compagnie: 'Ryanair', numero: 'FR1300', de: 'CRL', vers: 'LIS', depart: '2027-03-05T15:35:00' }],
        lien: 'https://exemple.test/aller',
        observeLe: maintenant.toISOString(),
      },
      {
        source: 'ryanair',
        sens: 'retour',
        prixParPersonne: prixParPersonne / 2,
        bagagesParPersonne: 25,
        vols: [{ compagnie: 'Ryanair', numero: 'FR1301', de: 'LIS', vers: 'CRL', depart: '2027-03-08T10:00:00' }],
        lien: 'https://exemple.test/retour',
        observeLe: maintenant.toISOString(),
      },
    ],
  };
}

function etatDemarre(record: number): Etat {
  return { ...etatInitial(), demarre: true, record: { prixParPersonne: record, le: '', option: option(record) } };
}

test('premier passage : message de démarrage et premier record', () => {
  const { etat, messages } = decider(etatInitial(), option(200), null, [], reglages, maintenant);
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /Veille Lisbonne démarrée/);
  assert.match(messages[0]!, /Réserver l'aller-retour sur Ryanair/);
  assert.equal(etat.record?.prixParPersonne, 200);
});

test('nouveau record seulement si la baisse atteint le minimum', () => {
  assert.equal(decider(etatDemarre(200), option(199.5), null, [], reglages, maintenant).messages.length, 0);

  const { etat, messages } = decider(etatDemarre(200), option(190), null, [], reglages, maintenant);
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /Nouveau prix le plus bas/);
  assert.equal(etat.record?.prixParPersonne, 190);
});

test('une hausse ne change pas le record', () => {
  const { etat, messages } = decider(etatDemarre(200), option(230), null, [], reglages, maintenant);
  assert.equal(messages.length, 0);
  assert.equal(etat.record?.prixParPersonne, 200);
});

test('prix cible : une alerte au passage dessous, pas de répétition', () => {
  const avecCible = { ...reglages, prixCible: 180 };
  const premier = decider(etatDemarre(170), option(175), null, [], avecCible, maintenant);
  assert.equal(premier.messages.filter((m) => m.includes('Prix cible atteint')).length, 1);

  const deuxieme = decider(premier.etat, option(176), null, [], avecCible, maintenant);
  assert.equal(deuxieme.messages.length, 0);

  const remonte = decider(deuxieme.etat, option(190), null, [], avecCible, maintenant);
  const redescend = decider(remonte.etat, option(178), null, [], avecCible, maintenant);
  assert.equal(redescend.messages.filter((m) => m.includes('Prix cible atteint')).length, 1);
});

test('panne : une seule alerte au 3e échec, puis un message au retour', () => {
  let etat = etatDemarre(200);
  const echecs: string[] = [];
  for (let i = 0; i < 5; i++) {
    const r = decider(etat, null, null, [{ source: 'ryanair', ok: false, erreur: '409' }], reglages, maintenant);
    echecs.push(...r.messages);
    etat = r.etat;
  }
  assert.equal(echecs.length, 1);
  assert.match(echecs[0]!, /Ryanair ne répond plus/);

  const retour = decider(etat, null, null, [{ source: 'ryanair', ok: true }], reglages, maintenant);
  assert.match(retour.messages[0]!, /répond de nouveau/);
  assert.equal(retour.etat.echecs.ryanair, 0);
});

test('avis Google : alerte quand le prix devient « bas », une seule fois', () => {
  const avis = { niveau: 'low', fourchette: [160, 250] as [number, number] };
  const premier = decider(etatDemarre(200), option(205), avis, [], reglages, maintenant);
  assert.equal(premier.messages.length, 1);
  assert.match(premier.messages[0]!, /Google juge le prix bas/);

  assert.equal(decider(premier.etat, option(205), avis, [], reglages, maintenant).messages.length, 0);
});
