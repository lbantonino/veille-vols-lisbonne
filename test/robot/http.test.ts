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
