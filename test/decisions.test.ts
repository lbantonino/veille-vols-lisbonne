import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decider, etatInitial, type Reglages } from '../src/decisions.ts';
import type { Choix, Etat, Option } from '../src/types.ts';

const maintenant = new Date('2026-11-04T12:30:00Z');
const reglages: Reglages = { baisseMinimale: 1, prixCible: null, echecsAvantAlerte: 3 };

// Un aller-retour Ryanair. Dans tes horaires : 8h10 / 17h05 ; hors horaires : 15h35 / 10h00.
function option(prixParPersonne: number, dansHoraires: boolean): Option {
  const [allerHeure, retourHeure] = dansHoraires ? ['08:10', '17:05'] : ['15:35', '10:00'];
  return {
    prixParPersonne,
    dansHoraires,
    offres: [
      {
        source: 'ryanair',
        sens: 'aller',
        prixParPersonne: prixParPersonne / 2,
        bagagesParPersonne: 36,
        dansHoraires,
        vols: [{ compagnie: 'Ryanair', numero: 'FR1', de: 'CRL', vers: 'LIS', depart: `2027-03-05T${allerHeure}:00` }],
        lien: 'https://exemple.test/aller',
        observeLe: maintenant.toISOString(),
      },
      {
        source: 'ryanair',
        sens: 'retour',
        prixParPersonne: prixParPersonne / 2,
        bagagesParPersonne: 36,
        dansHoraires,
        vols: [{ compagnie: 'Ryanair', numero: 'FR2', de: 'LIS', vers: 'CRL', depart: `2027-03-08T${retourHeure}:00` }],
        lien: 'https://exemple.test/retour',
        observeLe: maintenant.toISOString(),
      },
    ],
  };
}

const choix = (horaires: number | null, horsHoraires: number | null): Choix => {
  const h = horaires === null ? null : option(horaires, true);
  const hors = horsHoraires === null ? null : option(horsHoraires, false);
  const tous = h && hors ? (hors.prixParPersonne < h.prixParPersonne ? hors : h) : (h ?? hors);
  return { horaires: h, tous };
};

function etatDemarre(recordHoraires: number, recordTous: number): Etat {
  return {
    ...etatInitial(),
    demarre: true,
    records: {
      horaires: { prixParPersonne: recordHoraires, le: '', option: option(recordHoraires, true) },
      tous: { prixParPersonne: recordTous, le: '', option: option(recordTous, false) },
    },
  };
}

test('premier passage : un message avec les deux meilleurs prix', () => {
  const { etat, messages } = decider(etatInitial(), choix(343, 221), null, [], reglages, maintenant);
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /Veille Lisbonne démarrée/);
  assert.match(messages[0]!, /Dans tes horaires : 343/);
  assert.match(messages[0]!, /Tous horaires confondus : 221/);
  assert.match(messages[0]!, /⏰ hors horaires/);
  assert.equal(etat.records.horaires?.prixParPersonne, 343);
  assert.equal(etat.records.tous?.prixParPersonne, 221);
});

test('record dans tes horaires : alerte seulement si la baisse atteint le minimum', () => {
  assert.equal(decider(etatDemarre(343, 221), choix(342.5, 230), null, [], reglages, maintenant).messages.length, 0);

  const { etat, messages } = decider(etatDemarre(343, 221), choix(330, 230), null, [], reglages, maintenant);
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /Nouveau prix le plus bas dans tes horaires : 330/);
  assert.equal(etat.records.horaires?.prixParPersonne, 330);
  assert.equal(etat.records.tous?.prixParPersonne, 221);
});

test('record hors horaires : alerte à part, avec la différence avec tes horaires', () => {
  const { etat, messages } = decider(etatDemarre(343, 221), choix(343, 200), null, [], reglages, maintenant);
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /Hors de tes horaires : nouveau prix le plus bas, 200/);
  assert.match(messages[0]!, /le meilleur prix est 343/);
  assert.equal(etat.records.tous?.prixParPersonne, 200);
});

test('un record général dans tes horaires ne donne pas deux alertes', () => {
  const { etat, messages } = decider(etatDemarre(343, 221), choix(210, 250), null, [], reglages, maintenant);
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /dans tes horaires : 210/);
  assert.equal(etat.records.tous?.prixParPersonne, 210);
});

test('une hausse ne change aucun record', () => {
  const { etat, messages } = decider(etatDemarre(343, 221), choix(400, 260), null, [], reglages, maintenant);
  assert.equal(messages.length, 0);
  assert.equal(etat.records.horaires?.prixParPersonne, 343);
  assert.equal(etat.records.tous?.prixParPersonne, 221);
});

test('prix cible (dans tes horaires) : une alerte au passage dessous, pas de répétition', () => {
  const avecCible = { ...reglages, prixCible: 300 };
  const premier = decider(etatDemarre(290, 221), choix(295, 230), null, [], avecCible, maintenant);
  assert.equal(premier.messages.filter((m) => m.includes('Prix cible atteint')).length, 1);

  const deuxieme = decider(premier.etat, choix(296, 230), null, [], avecCible, maintenant);
  assert.equal(deuxieme.messages.length, 0);

  const remonte = decider(deuxieme.etat, choix(320, 230), null, [], avecCible, maintenant);
  const redescend = decider(remonte.etat, choix(298, 230), null, [], avecCible, maintenant);
  assert.equal(redescend.messages.filter((m) => m.includes('Prix cible atteint')).length, 1);
});

test('panne : une seule alerte au 3e échec, puis un message au retour', () => {
  let etat = etatDemarre(343, 221);
  const alertes: string[] = [];
  for (let i = 0; i < 5; i++) {
    const r = decider(etat, choix(null, null), null, [{ source: 'ryanair', ok: false, erreur: '409' }], reglages, maintenant);
    alertes.push(...r.messages);
    etat = r.etat;
  }
  assert.equal(alertes.length, 1);
  assert.match(alertes[0]!, /Ryanair ne répond plus/);

  const retour = decider(etat, choix(null, null), null, [{ source: 'ryanair', ok: true }], reglages, maintenant);
  assert.match(retour.messages[0]!, /répond de nouveau/);
  assert.equal(retour.etat.echecs.ryanair, 0);
});

test('avis Google : alerte quand le prix devient « bas », une seule fois', () => {
  const avis = { niveau: 'low', fourchette: [160, 250] as [number, number] };
  const premier = decider(etatDemarre(343, 221), choix(350, 230), avis, [], reglages, maintenant);
  assert.equal(premier.messages.length, 1);
  assert.match(premier.messages[0]!, /Google juge le prix bas/);

  assert.equal(decider(premier.etat, choix(350, 230), avis, [], reglages, maintenant).messages.length, 0);
});
