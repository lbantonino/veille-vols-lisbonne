import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { gererComparer, gererNotes, gererRyanair, gererSante } from '../../src/robot/http.ts';
import { lireDonneesPalerme } from '../../src/robot/donnees.ts';
import { oublierCache } from '../../src/robot/direct.ts';
import { etatPalermeInitial } from '../../src/palerme/stockage.ts';
import type { Rapport } from '../../src/palerme/rapport.ts';
import type { SemaineRyanair } from '../../src/sources/ryanair.ts';

const env = { CODE_ACCES: 'code-tres-long-1', GITHUB_TOKEN: 'jeton-test' };
const neufMars = () => new Date('2027-03-09T10:00:00Z');
const avecCode = (chemin: string, methode = 'GET', corps?: unknown) =>
  new Request(`http://local${chemin}`, {
    method: methode,
    headers: { 'x-code-acces': 'code-tres-long-1', 'content-type': 'application/json' },
    ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  });
const rapport = (semaine: string, le: string, meilleur: number): Rapport =>
  ({ semaine, le, fenetre: { debut: '2027-04-08', fin: '2027-06-07' }, ryanair: null, google: null, meilleurParPersonne: meilleur, evolution: null }) as Rapport;

beforeEach(() => oublierCache());

test('Palerme : fichiers absents (404) = mémoire vide, sans erreur', async () => {
  const faux: typeof fetch = async () => new Response('Not Found', { status: 404 });
  const { etat, rapports } = await lireDonneesPalerme(env, faux);
  assert.deepEqual(etat, etatPalermeInitial());
  assert.deepEqual(rapports, []);
});

test('Palerme : les notes de la page, le plus récent d’abord', async () => {
  const etat = { ...etatPalermeInitial(), dernierRapport: rapport('2027-W11', '2027-03-15T08:00:00Z', 152) };
  const lirePalerme = async () => ({ etat, rapports: [rapport('2027-W10', '2027-03-09T08:00:00Z', 160), rapport('2027-W11', '2027-03-15T08:00:00Z', 152)] });
  const res = await gererNotes(avecCode('/api/notes'), env, { maintenant: () => new Date('2027-03-16T10:00:00Z'), lirePalerme });
  assert.equal(res.status, 200);
  const notes = await res.json();
  assert.equal(notes.mission.robot, 'PalermoIA');
  assert.equal(notes.courbe.length, 2);
  assert.equal(notes.journal[0].semaine, '2027-W11');
  assert.equal(notes.dernierRapport.meilleurParPersonne, 152);
  assert.equal(notes.dernierPassage, '2027-03-15T08:00:00Z');

  const vide = await (await gererNotes(avecCode('/api/notes'), env, { maintenant: neufMars, lirePalerme: async () => ({ etat: etatPalermeInitial(), rapports: [] }) })).json();
  assert.deepEqual(vide.journal, []);
  assert.equal(vide.dernierRapport, null);
});

test('Palerme : Ryanair en direct sur la bonne fenêtre, valise comprise', async () => {
  let recu: { debut: string; fin: string } | null = null;
  const chercherSemaine = async (p: { debut: string; fin: string }) => {
    recu = { debut: p.debut, fin: p.fin };
    return {
      aller: { compagnie: 'Ryanair', numero: 'FR6302', de: 'CRL', vers: 'PMO', depart: '2027-05-27T21:40:00' },
      retour: { compagnie: 'Ryanair', numero: 'FR6268', de: 'PMO', vers: 'CRL', depart: '2027-06-03T06:20:00' },
      prixParPersonne: 72,
      lien: 'https://www.ryanair.com/reserver',
    } satisfies SemaineRyanair;
  };
  const res = await gererRyanair(avecCode('/api/ryanair', 'POST'), env, { maintenant: neufMars, chercherSemaine });
  assert.equal(res.status, 200);
  assert.deepEqual(recu, { debut: '2027-04-08', fin: '2027-06-07' });
  const corps = await res.json();
  assert.equal(corps.semaine.prixParPersonne, 152);
  assert.equal(corps.semaine.prixHorsValise, 72);
});

test('Palerme : comparaison avec le dernier rapport', async () => {
  const etat = { ...etatPalermeInitial(), dernierRapport: rapport('2027-W10', '2027-03-09T08:00:00Z', 160) };
  const res = await gererComparer(avecCode('/api/comparer', 'POST', { semaine: { prixParPersonne: 152 } }), env, {
    maintenant: neufMars,
    lirePalerme: async () => ({ etat, rapports: [] }),
  });
  assert.deepEqual(await res.json(), { mission: 'palerme', nouveau: 152, dernier: 160, difference: -8 });
});

test('santé : le nom du robot de la mission, et aucune date', async () => {
  const corps = await gererSante().json();
  assert.equal(typeof corps.robot, 'string');
  assert.ok(['LisbonIA', 'PalermoIA'].includes(corps.robot));
  assert.equal(JSON.stringify(corps).includes('2027'), false);
});

test('santé détaillée en mission Palerme : une clé sans accès au dépôt (404) est signalée', async () => {
  const { gererSanteDetaillee } = await import('../../src/robot/http.ts');
  const sante = await (
    await gererSanteDetaillee(env, {
      maintenant: () => new Date('2027-03-16T10:00:00Z'),
      lire: async () => {
        throw new Error('GitHub a répondu 404 pour data/etat.json');
      },
      lirePalerme: async () => ({ etat: etatPalermeInitial(), rapports: [] }),
    })
  ).json();
  assert.equal(sante.notes, 'illisibles');
  assert.match(sante.raison, /404/);
});
