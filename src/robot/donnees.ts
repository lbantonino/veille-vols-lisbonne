// Lit la mémoire de l'agent (data/etat.json et data/historique.jsonl) :
// dans le dépôt privé via l'API GitHub en production, ou sur le disque en local.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Etat } from '../types.ts';
import { etatInitial } from '../decisions.ts';
import type { EnvRobot } from './http.ts';
import { etatPalermeInitial, type EtatPalerme } from '../palerme/stockage.ts';
import type { Rapport } from '../palerme/rapport.ts';

export interface LigneHistorique {
  le: string;
  meilleurDansHoraires: number | null;
  meilleurTousHoraires: number | null;
  records: { horaires: number | null; tous: number | null };
  pannes: string[];
}

const DEPOT_PAR_DEFAUT = 'lbantonino/veille-vols-lisbonne';
const DOSSIER_LOCAL = new URL('../../data/', import.meta.url);

const nombreOuNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Une ligne de l'historique, quel que soit son format :
// avant le 04/11 au soir, l'agent n'avait qu'un prix et un record (tous horaires confondus).
function normaliserLigne(brute: Record<string, unknown>): LigneHistorique | null {
  if (typeof brute.le !== 'string') return null;
  const records = (brute.records ?? {}) as Record<string, unknown>;
  const ancienFormat = !('meilleurTousHoraires' in brute) && 'meilleurParPersonne' in brute;
  return {
    le: brute.le,
    meilleurDansHoraires: ancienFormat ? null : nombreOuNull(brute.meilleurDansHoraires),
    meilleurTousHoraires: nombreOuNull(ancienFormat ? brute.meilleurParPersonne : brute.meilleurTousHoraires),
    records: ancienFormat
      ? { horaires: null, tous: nombreOuNull(brute.record) }
      : { horaires: nombreOuNull(records.horaires), tous: nombreOuNull(records.tous) },
    pannes: Array.isArray(brute.pannes) ? brute.pannes.filter((p): p is string => typeof p === 'string') : [],
  };
}

export function lireHistorique(texte: string): LigneHistorique[] {
  const lignes: LigneHistorique[] = [];
  for (const brute of texte.split('\n')) {
    if (!brute.trim()) continue;
    try {
      const ligne = normaliserLigne(JSON.parse(brute) as Record<string, unknown>);
      if (ligne) lignes.push(ligne);
    } catch {
      // ligne cassée : ignorée
    }
  }
  return lignes;
}

function lireEtatTexte(texte: string): Etat {
  const { record: _ancienFormat, ...sauvegarde } = JSON.parse(texte) as Partial<Etat> & { record?: unknown };
  return { ...etatInitial(), ...sauvegarde };
}

async function lireFichierGitHub(nom: string, env: EnvRobot, fetchImpl: typeof fetch, absentEgalVide = false): Promise<string> {
  const depot = env.GITHUB_DEPOT ?? DEPOT_PAR_DEFAUT;
  const reponse = await fetchImpl(`https://api.github.com/repos/${depot}/contents/data/${nom}?ref=main`, {
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN ?? ''}`,
      accept: 'application/vnd.github.raw+json',
      'user-agent': 'lisbonia-robot',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (absentEgalVide && reponse.status === 404) return '';
  if (!reponse.ok) throw new Error(`GitHub a répondu ${reponse.status} pour data/${nom}`);
  return reponse.text();
}

export async function lireDonneesAgent(
  env: EnvRobot,
  fetchImpl: typeof fetch = fetch,
): Promise<{ etat: Etat; historique: LigneHistorique[] }> {
  if (env.DONNEES_LOCALES === '1') {
    const etatTexte = await readFile(new URL('etat.json', DOSSIER_LOCAL), 'utf8').catch(() => '{}');
    const historiqueTexte = await readFile(new URL('historique.jsonl', DOSSIER_LOCAL), 'utf8').catch(() => '');
    return { etat: lireEtatTexte(etatTexte), historique: lireHistorique(historiqueTexte) };
  }
  const [etatTexte, historiqueTexte] = await Promise.all([
    lireFichierGitHub('etat.json', env, fetchImpl),
    lireFichierGitHub('historique.jsonl', env, fetchImpl),
  ]);
  return { etat: lireEtatTexte(etatTexte), historique: lireHistorique(historiqueTexte) };
}

// ---------- Mission Palerme : data/palerme/etat.json et data/palerme/rapports.jsonl ----------

function lireRapports(texte: string): Rapport[] {
  const rapports: Rapport[] = [];
  for (const ligne of texte.split('\n')) {
    if (!ligne.trim()) continue;
    try {
      const r = JSON.parse(ligne) as Rapport;
      if (typeof r.semaine === 'string' && typeof r.le === 'string') rapports.push(r);
    } catch {
      // ligne cassée : ignorée
    }
  }
  return rapports;
}

const lireEtatPalermeTexte = (texte: string): EtatPalerme =>
  texte.trim() ? { ...etatPalermeInitial(), ...(JSON.parse(texte) as Partial<EtatPalerme>) } : etatPalermeInitial();

// Un fichier absent (mission qui n'a pas encore tourné) compte comme une mémoire vide.
export async function lireDonneesPalerme(env: EnvRobot, fetchImpl: typeof fetch = fetch): Promise<{ etat: EtatPalerme; rapports: Rapport[] }> {
  if (env.DONNEES_LOCALES === '1') {
    const base = env.DOSSIER_DONNEES ? pathToFileURL(`${resolve(env.DOSSIER_DONNEES)}/`) : DOSSIER_LOCAL;
    const dossier = new URL('palerme/', base);
    const etatTexte = await readFile(new URL('etat.json', dossier), 'utf8').catch(() => '');
    const rapportsTexte = await readFile(new URL('rapports.jsonl', dossier), 'utf8').catch(() => '');
    return { etat: lireEtatPalermeTexte(etatTexte), rapports: lireRapports(rapportsTexte) };
  }
  const [etatTexte, rapportsTexte] = await Promise.all([
    lireFichierGitHub('palerme/etat.json', env, fetchImpl, true),
    lireFichierGitHub('palerme/rapports.jsonl', env, fetchImpl, true),
  ]);
  return { etat: lireEtatPalermeTexte(etatTexte), rapports: lireRapports(rapportsTexte) };
}
