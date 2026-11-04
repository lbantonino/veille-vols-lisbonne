import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lireDonneesAgent, lireHistorique } from '../../src/robot/donnees.ts';

const fixture = (nom: string) => readFileSync(new URL(`../fixtures/${nom}`, import.meta.url), 'utf8');

test('historique : ignore les lignes vides ou cassées', () => {
  const lignes = lireHistorique(`${fixture('historique-exemple.jsonl')}\n{cassé\n\n`);
  assert.equal(lignes.length, 5);
});

test('historique : l’ancien format (avant les horaires) est converti', () => {
  const [ancienne] = lireHistorique(fixture('historique-exemple.jsonl'));
  assert.deepEqual(ancienne, {
    le: '2026-11-04T19:31:42.939Z',
    meilleurDansHoraires: null,
    meilleurTousHoraires: 198.6,
    records: { horaires: null, tous: 198.6 },
    pannes: [],
  });
});

test('GitHub : bonnes adresses et bons en-têtes, données lues', async () => {
  const appels: { url: string; entetes: Headers }[] = [];
  const faux: typeof fetch = async (url, init) => {
    appels.push({ url: String(url), entetes: new Headers(init?.headers) });
    const texte = String(url).includes('etat.json') ? fixture('etat-exemple.json') : fixture('historique-exemple.jsonl');
    return new Response(texte, { status: 200 });
  };
  const { etat, historique } = await lireDonneesAgent({ GITHUB_TOKEN: 'jeton-test' }, faux);

  assert.equal(appels[0]!.url, 'https://api.github.com/repos/lbantonino/veille-vols-lisbonne/contents/data/etat.json?ref=main');
  assert.equal(appels[1]!.url, 'https://api.github.com/repos/lbantonino/veille-vols-lisbonne/contents/data/historique.jsonl?ref=main');
  assert.equal(appels[0]!.entetes.get('authorization'), 'Bearer jeton-test');
  assert.equal(appels[0]!.entetes.get('accept'), 'application/vnd.github.raw+json');
  assert.equal(etat.demarre, true);
  assert.equal(historique.length, 5);
});

test('GitHub : une réponse en erreur lève une erreur claire', async () => {
  const faux: typeof fetch = async () => new Response('Not Found', { status: 404 });
  await assert.rejects(lireDonneesAgent({ GITHUB_TOKEN: 'jeton-test' }, faux), /GitHub a répondu 404/);
});

test('local : lit le dossier data/ du projet', async () => {
  const { etat, historique } = await lireDonneesAgent({ DONNEES_LOCALES: '1' });
  assert.equal(typeof etat.demarre, 'boolean');
  assert.ok(Array.isArray(historique));
});
