// La mémoire de l'agent : deux fichiers dans data/, enregistrés dans le dépôt à chaque passage.
//   etat.json        ce dont il a besoin pour décider (record, dernières offres, pannes...)
//   historique.jsonl une ligne par passage, pour tracer la courbe des prix plus tard
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Etat } from './types.ts';
import { etatInitial } from './decisions.ts';

const DOSSIER = new URL('../data/', import.meta.url);
const FICHIER_ETAT = new URL('etat.json', DOSSIER);
const FICHIER_HISTORIQUE = new URL('historique.jsonl', DOSSIER);

export async function lireEtat(): Promise<Etat> {
  try {
    // `record` vient de l'ancienne version (un seul record) : on l'ignore.
    const { record: _ancienFormat, ...sauvegarde } = JSON.parse(await readFile(FICHIER_ETAT, 'utf8')) as Partial<Etat> & {
      record?: unknown;
    };
    return { ...etatInitial(), ...sauvegarde };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return etatInitial();
    throw e;
  }
}

export async function ecrireEtat(etat: Etat): Promise<void> {
  await mkdir(DOSSIER, { recursive: true });
  await writeFile(FICHIER_ETAT, `${JSON.stringify(etat, null, 2)}\n`);
}

export async function ajouterHistorique(ligne: object): Promise<void> {
  await mkdir(DOSSIER, { recursive: true });
  await appendFile(FICHIER_HISTORIQUE, `${JSON.stringify(ligne)}\n`);
}
