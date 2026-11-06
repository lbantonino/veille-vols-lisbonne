import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { passagePalerme, type DepsPalerme } from '../../src/palerme/passage.ts';
import type { SemaineRyanair } from '../../src/sources/ryanair.ts';

const DOSSIER = new URL(`../.palerme-essai-${process.pid}/`, import.meta.url);
after(() => rmSync(DOSSIER, { recursive: true, force: true }));
beforeEach(() => {
  rmSync(DOSSIER, { recursive: true, force: true });
  mkdirSync(DOSSIER, { recursive: true });
  process.exitCode = undefined;
});

const semaine = (prix: number): SemaineRyanair => ({
  aller: { compagnie: 'Ryanair', numero: 'FR6302', de: 'CRL', vers: 'PMO', depart: '2027-05-27T21:40:00' },
  retour: { compagnie: 'Ryanair', numero: 'FR6268', de: 'PMO', vers: 'CRL', depart: '2027-06-03T06:20:00' },
  prixParPersonne: prix,
  lien: 'https://www.ryanair.com/reserver',
});

function deps(messages: string[], options: Partial<DepsPalerme> = {}): DepsPalerme {
  return {
    dossier: DOSSIER,
    cle: 'cle-test',
    chercherRyanair: async () => semaine(72),
    chercherGoogle: async () => null,
    quota: async () => 200,
    envoyer: async (texte) => {
      messages.push(texte);
    },
    ...options,
  };
}
const lignesRapports = () => {
  const f = new URL('rapports.jsonl', DOSSIER);
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean) : [];
};
const etatBasculeFaite = () =>
  writeFileSync(
    new URL('etat.json', DOSSIER),
    JSON.stringify({ basculeAnnonceeLe: '2027-03-09T08:00:00.000Z', dernierRapport: null, echecs: { ryanair: 0, google: 0 } }),
  );

test('premier passage (mardi 9 mars) : la bascule puis le premier rapport', async () => {
  const messages: string[] = [];
  await passagePalerme(new Date('2027-03-09T09:00:00Z'), deps(messages));
  assert.equal(messages.length, 2);
  assert.match(messages[0]!, /LisbonIA devient PalermoIA/);
  assert.match(messages[1]!, /ton rapport de la semaine/);
  assert.equal(lignesRapports().length, 1);
});

test('même semaine : aucun message, aucun fichier modifié', async () => {
  const messages: string[] = [];
  await passagePalerme(new Date('2027-03-09T09:00:00Z'), deps(messages));
  const etat = new URL('etat.json', DOSSIER);
  const avant = { contenu: readFileSync(etat, 'utf8'), date: statSync(etat).mtimeMs, rapports: lignesRapports().length };
  await passagePalerme(new Date('2027-03-09T14:00:00Z'), deps(messages));
  assert.equal(messages.length, 2);
  assert.equal(readFileSync(etat, 'utf8'), avant.contenu);
  assert.equal(statSync(etat).mtimeMs, avant.date);
  assert.equal(lignesRapports().length, avant.rapports);
});

test('lundi suivant à 8h30 : un nouveau rapport, avec l’évolution', async () => {
  const messages: string[] = [];
  await passagePalerme(new Date('2027-03-09T09:00:00Z'), deps(messages));
  await passagePalerme(new Date('2027-03-15T07:30:00Z'), deps(messages, { chercherRyanair: async () => semaine(64) }));
  assert.equal(messages.length, 3);
  assert.match(messages[2]!, /−8,00\s€ depuis la semaine dernière/);
  assert.equal(lignesRapports().length, 2);
});

test('Ryanair en panne 3 fois : une seule alerte, aucun rapport', async () => {
  etatBasculeFaite();
  const messages: string[] = [];
  const panne = deps(messages, {
    chercherRyanair: async () => {
      throw new Error('Ryanair a répondu 409 pour CRL');
    },
  });
  for (const heure of ['10', '11', '12', '13']) await passagePalerme(new Date(`2027-03-10T${heure}:00:00Z`), panne);
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /Ryanair ne répond plus/);
  assert.equal(lignesRapports().length, 0);
});

test('quota Google trop bas : le rapport part sans Google et dit pourquoi', async () => {
  etatBasculeFaite();
  const messages: string[] = [];
  let appelsGoogle = 0;
  await passagePalerme(
    new Date('2027-03-10T10:00:00Z'),
    deps(messages, {
      quota: async () => 15,
      chercherGoogle: async () => {
        appelsGoogle += 1;
        return null;
      },
    }),
  );
  assert.equal(appelsGoogle, 0);
  assert.match(messages[0]!, /quota/);
});

test('Telegram en échec : le rapport n’est pas compté, il repart au passage suivant', async () => {
  etatBasculeFaite();
  const messages: string[] = [];
  await passagePalerme(
    new Date('2027-03-10T10:00:00Z'),
    deps(messages, {
      envoyer: async () => {
        throw new Error('Telegram a répondu 502');
      },
    }),
  );
  assert.equal(lignesRapports().length, 0);
  process.exitCode = undefined;
  await passagePalerme(new Date('2027-03-10T11:00:00Z'), deps(messages));
  assert.equal(messages.length, 1);
  assert.equal(lignesRapports().length, 1);
});

test('aucune semaine trouvée : le rapport le dit, et la semaine est faite', async () => {
  etatBasculeFaite();
  const messages: string[] = [];
  await passagePalerme(new Date('2027-03-10T10:00:00Z'), deps(messages, { chercherRyanair: async () => null }));
  await passagePalerme(new Date('2027-03-10T11:00:00Z'), deps(messages, { chercherRyanair: async () => null }));
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /aucune semaine trouvée/i);
  assert.equal(lignesRapports().length, 1);
});
