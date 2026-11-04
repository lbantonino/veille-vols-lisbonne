import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  ignoreCommand: string;
  regions?: string[];
  functions: Record<string, { maxDuration?: number }>;
};

// Un petit dépôt Git jetable, dans le dossier du projet, supprimé à la fin.
const DEPOT = fileURLToPath(new URL(`./.depot-essai-${process.pid}/`, import.meta.url));
after(() => rmSync(DEPOT, { recursive: true, force: true }));

const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=essai', '-c', 'user.email=essai@exemple.test', '-c', 'commit.gpgsign=false', ...args], {
    cwd: DEPOT,
    stdio: 'pipe',
  }).toString();
const ecrire = (chemin: string, texte: string) => {
  mkdirSync(join(DEPOT, chemin, '..'), { recursive: true });
  writeFileSync(join(DEPOT, chemin), texte);
};
// Code de sortie de l'ignoreCommand de Vercel : 0 = Vercel saute le déploiement, 1 = il déploie.
const vercelSaute = () => spawnSync('sh', ['-c', config.ignoreCommand], { cwd: DEPOT }).status === 0;

test('Vercel : saute les commits de données, déploie le code, même après une fusion', () => {
  mkdirSync(DEPOT, { recursive: true });
  git('init', '-q', '-b', 'main');
  ecrire('src/a.ts', 'v1');
  ecrire('data/etat.json', '{}');
  git('add', '-A');
  git('commit', '-q', '-m', 'départ');

  ecrire('data/etat.json', '{"n":1}');
  git('commit', '-q', '-am', 'données');
  assert.equal(vercelSaute(), true, 'un commit de données seules doit être ignoré');

  ecrire('src/a.ts', 'v2');
  git('commit', '-q', '-am', 'code');
  assert.equal(vercelSaute(), false, 'un commit de code doit être déployé');

  // Le robot de l'agent pousse des données pendant qu'on modifie le code, puis on fusionne.
  git('checkout', '-q', '-b', 'distant', 'HEAD~1');
  ecrire('data/etat.json', '{"n":2}');
  git('commit', '-q', '-am', 'données du robot');
  git('checkout', '-q', 'main');
  ecrire('src/a.ts', 'v3');
  git('commit', '-q', '-am', 'code local');
  git('merge', '-q', '--no-ff', '--no-edit', 'distant');
  assert.equal(vercelSaute(), false, 'une fusion qui apporte du code doit être déployée');
});

test('Vercel : fonctions en Europe, avec une durée maximale', () => {
  assert.deepEqual(config.regions, ['cdg1']);
  assert.equal(config.functions['api/*.js']?.maxDuration, 60);
});
