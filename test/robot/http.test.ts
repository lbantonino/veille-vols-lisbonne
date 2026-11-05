import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gererSante, verifierAcces } from '../../src/robot/http.ts';

test('santé : répond sans donnée personnelle', async () => {
  const res = gererSante();
  assert.equal(res.status, 200);
  const corps = await res.json();
  assert.deepEqual(corps, { ok: true, configChargee: true });
  assert.equal(JSON.stringify(corps).includes('2027'), false);
});

test('accès : sans code, 401 sans aucune donnée', async () => {
  const env = { CODE_ACCES: 'code-tres-long-1' };
  const refus = await verifierAcces(new Request('http://local/api/notes'), env, { attendre: async () => {} });
  assert.ok(refus);
  assert.equal(refus.status, 401);
  const texte = await refus.text();
  assert.equal(texte.includes('2027'), false);
  assert.deepEqual(JSON.parse(texte), { erreur: 'code' });
});

test('accès : avec le bon code, laisse passer', async () => {
  const env = { CODE_ACCES: 'code-tres-long-1' };
  const requete = new Request('http://local/api/notes', { headers: { 'x-code-acces': 'code-tres-long-1' } });
  assert.equal(await verifierAcces(requete, env, { attendre: async () => {} }), null);
});

test('notes : sans code, 401 ; avec le code, le résumé', async () => {
  const { gererNotes } = await import('../../src/robot/http.ts');
  const { etatInitial } = await import('../../src/decisions.ts');
  const env = { CODE_ACCES: 'code-tres-long-1' };
  const deps = {
    lire: async () => ({ etat: etatInitial(), historique: [] }),
    maintenant: () => new Date('2026-11-05T00:00:00Z'),
    attendre: async () => {},
  };
  assert.equal((await gererNotes(new Request('http://local/api/notes'), env, deps)).status, 401);

  const ok = await gererNotes(new Request('http://local/api/notes', { headers: { 'x-code-acces': 'code-tres-long-1' } }), env, deps);
  assert.equal(ok.status, 200);
  const corps = await ok.json();
  assert.deepEqual(corps.journal, []);
  assert.equal(corps.termine, false);
});

test('notes : données illisibles, 502', async () => {
  const { gererNotes } = await import('../../src/robot/http.ts');
  const env = { CODE_ACCES: 'code-tres-long-1' };
  const deps = { lire: async () => { throw new Error('GitHub a répondu 401'); }, attendre: async () => {} };
  const res = await gererNotes(new Request('http://local/api/notes', { headers: { 'x-code-acces': 'code-tres-long-1' } }), env, deps);
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { erreur: 'donnees' });
});

test('santé détaillée : dit si le serveur arrive à lire les notes, sans rien en montrer', async () => {
  const { gererSanteDetaillee } = await import('../../src/robot/http.ts');
  const { etatInitial } = await import('../../src/decisions.ts');
  const avecJeton = { GITHUB_TOKEN: 'jeton-test' };

  const ok = await (await gererSanteDetaillee(avecJeton, { lire: async () => ({ etat: etatInitial(), historique: [] }) })).json();
  assert.deepEqual(ok, { ok: true, configChargee: true, jetonGitHub: true, notes: 'lisibles' });

  const refus = await (
    await gererSanteDetaillee(avecJeton, {
      lire: async () => {
        throw new Error('GitHub a répondu 401 pour data/etat.json');
      },
    })
  ).json();
  assert.deepEqual(refus, { ok: true, configChargee: true, jetonGitHub: true, notes: 'illisibles', raison: 'GitHub a répondu 401 pour data/etat.json' });

  const sansJeton = await (await gererSanteDetaillee({}, {})).json();
  assert.equal(sansJeton.jetonGitHub, false);
  assert.equal(sansJeton.notes, 'illisibles');
  assert.equal(JSON.stringify([ok, refus, sansJeton]).includes('2027'), false);
});
