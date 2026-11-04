import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gererSante } from '../../src/robot/http.ts';

test('santé : répond sans donnée personnelle', async () => {
  const res = gererSante();
  assert.equal(res.status, 200);
  const corps = await res.json();
  assert.deepEqual(corps, { ok: true, configChargee: true });
  assert.equal(JSON.stringify(corps).includes('2027'), false);
});
