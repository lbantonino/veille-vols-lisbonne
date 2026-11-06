import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/veille.yml', import.meta.url), 'utf8');

// Escale enchaîne les missions : le workflow ne doit plus jamais se désactiver tout seul.
test('le workflow ne se désactive plus après Lisbonne', () => {
  assert.equal(workflow.includes('gh workflow disable'), false);
  assert.equal(workflow.includes('actions: write'), false);
  assert.equal(workflow.includes('steps.veille.outputs.termine'), false);
});
