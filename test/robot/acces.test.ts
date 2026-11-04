import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeValide, delaiApresEchecs } from '../../src/robot/acces.ts';

test('code : accepte le bon code, refuse les autres', () => {
  assert.equal(codeValide('code-tres-long-1', 'code-tres-long-1'), true);
  assert.equal(codeValide('autre-code-long1', 'code-tres-long-1'), false);
  assert.equal(codeValide(null, 'code-tres-long-1'), false);
  assert.equal(codeValide('', 'code-tres-long-1'), false);
});

test('code : refuse tout si le code attendu est absent ou trop court', () => {
  assert.equal(codeValide('court', 'court'), false);
  assert.equal(codeValide('x'.repeat(12), undefined), false);
});

test('code : chaque échec rallonge l’attente, jusqu’à 8 secondes', () => {
  assert.equal(delaiApresEchecs(0), 0);
  assert.equal(delaiApresEchecs(1), 1000);
  assert.equal(delaiApresEchecs(3), 4000);
  assert.equal(delaiApresEchecs(10), 8000);
});
