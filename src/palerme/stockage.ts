// La mémoire de la mission Palerme : data/palerme/etat.json et data/palerme/rapports.jsonl.
// (Lisbonne garde ses fichiers d'origine, data/etat.json et data/historique.jsonl.)
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Rapport } from './rapport.ts';

export interface EtatPalerme {
  basculeAnnonceeLe: string | null;
  dernierRapport: Rapport | null;
  echecs: { ryanair: number; google: number };
}

export const DOSSIER_PALERME = new URL('../../data/palerme/', import.meta.url);

export const etatPalermeInitial = (): EtatPalerme => ({ basculeAnnonceeLe: null, dernierRapport: null, echecs: { ryanair: 0, google: 0 } });

export async function lireEtatPalerme(dossier: URL = DOSSIER_PALERME): Promise<EtatPalerme> {
  try {
    const sauvegarde = JSON.parse(await readFile(new URL('etat.json', dossier), 'utf8')) as Partial<EtatPalerme>;
    return { ...etatPalermeInitial(), ...sauvegarde };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return etatPalermeInitial();
    throw e;
  }
}

export async function ecrireEtatPalerme(etat: EtatPalerme, dossier: URL = DOSSIER_PALERME): Promise<void> {
  await mkdir(dossier, { recursive: true });
  await writeFile(new URL('etat.json', dossier), `${JSON.stringify(etat, null, 2)}\n`);
}

export async function ajouterRapport(rapport: Rapport, dossier: URL = DOSSIER_PALERME): Promise<void> {
  await mkdir(dossier, { recursive: true });
  await appendFile(new URL('rapports.jsonl', dossier), `${JSON.stringify(rapport)}\n`);
}
