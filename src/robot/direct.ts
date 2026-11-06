// La vérification en direct du robot : Ryanair interrogé à l'instant (avec le code de l'agent),
// puis comparé aux offres Google et aux records enregistrés par l'agent. Rien n'est écrit, rien n'est envoyé.
import type { Choix, Etat, Offre, Vol } from '../types.ts';
import { alertes, fraicheurMaxHeures } from '../config.ts';
import { choisir, fusionnerOffres } from '../analyse.ts';
import { bat } from '../decisions.ts';
import { chercherRyanair, chercherSemaineRyanair, type SemaineRyanair } from '../sources/ryanair.ts';
import { fenetreDeDepart, PALERME } from '../missions.ts';
import { avecValise, type PrixValise } from '../palerme/rapport.ts';
import type { EtatPalerme } from '../palerme/stockage.ts';
import { arrondi } from '../format.ts';

const DUREE_CACHE_MS = 60_000;
const OFFRES_MAX = 20;

let cache: { le: number; offres: Offre[] } | null = null;
let cacheSemaine: { le: number; semaine: (SemaineRyanair & PrixValise) | null } | null = null;

// Pour les tests.
export function oublierCache(): void {
  cache = null;
  cacheSemaine = null;
}

// Ryanair au plus une fois par minute : des visites rapprochées réutilisent le même résultat.
export async function verifierRyanair(
  maintenant: Date,
  chercher: typeof chercherRyanair = chercherRyanair,
): Promise<{ offres: Offre[]; verifieLe: string; depuisCache: boolean }> {
  if (cache && maintenant.getTime() - cache.le < DUREE_CACHE_MS) {
    return { offres: cache.offres, verifieLe: new Date(cache.le).toISOString(), depuisCache: true };
  }
  const offres = await chercher(maintenant);
  cache = { le: maintenant.getTime(), offres };
  return { offres, verifieLe: maintenant.toISOString(), depuisCache: false };
}

export interface Comparaison {
  choix: Choix;
  nouveauRecord: { horaires: boolean; tous: boolean };
  records: { horaires: number | null; tous: number | null };
  googleVuLe: string | null;
}

export function comparerEnDirect(etat: Etat, offresRyanair: Offre[], maintenant: Date): Comparaison {
  const offres = fusionnerOffres(etat.dernieresOffres, offresRyanair, ['ryanair:aller', 'ryanair:retour'], maintenant, fraicheurMaxHeures);
  const choix = choisir(offres);
  const reglages = { baisseMinimale: alertes.baisseMinimale, prixCible: null, echecsAvantAlerte: 3 };
  const google = offres.filter((o) => o.source === 'google');
  return {
    choix,
    nouveauRecord: {
      horaires: bat(etat.records.horaires, choix.horaires, reglages),
      tous: bat(etat.records.tous, choix.tous, reglages),
    },
    records: {
      horaires: etat.records.horaires?.prixParPersonne ?? null,
      tous: etat.records.tous?.prixParPersonne ?? null,
    },
    googleVuLe: google.reduce<string | null>((r, o) => (r === null || o.observeLe > r ? o.observeLe : r), null),
  };
}

const estTexte = (v: unknown): v is string => typeof v === 'string';

function lireVol(brut: unknown): Vol | null {
  if (!brut || typeof brut !== 'object') return null;
  const v = brut as Record<string, unknown>;
  if (![v.compagnie, v.numero, v.de, v.vers, v.depart].every(estTexte)) return null;
  return { compagnie: v.compagnie as string, numero: v.numero as string, de: v.de as string, vers: v.vers as string, depart: v.depart as string };
}

// Les offres Ryanair renvoyées par le navigateur à l'étape « Je compare » : on ne garde que ce qui est valide.
export function lireOffres(corps: unknown): Offre[] {
  const liste = Array.isArray(corps)
    ? corps
    : corps && typeof corps === 'object' && Array.isArray((corps as { offres?: unknown }).offres)
      ? (corps as { offres: unknown[] }).offres
      : [];
  const offres: Offre[] = [];
  for (const brut of liste) {
    if (offres.length >= OFFRES_MAX) break;
    if (!brut || typeof brut !== 'object') continue;
    const o = brut as Record<string, unknown>;
    const prix = o.prixParPersonne;
    if (o.source !== 'ryanair' || (o.sens !== 'aller' && o.sens !== 'retour')) continue;
    if (typeof prix !== 'number' || !Number.isFinite(prix) || prix <= 0) continue;
    const vols = Array.isArray(o.vols) ? o.vols.map(lireVol) : [];
    if (vols.length === 0 || vols.some((v) => v === null) || !estTexte(o.observeLe) || !estTexte(o.lien)) continue;
    offres.push({
      source: 'ryanair',
      sens: o.sens,
      prixParPersonne: prix,
      bagagesParPersonne: typeof o.bagagesParPersonne === 'number' ? o.bagagesParPersonne : 0,
      ...(typeof o.prixSoloParPersonne === 'number' ? { prixSoloParPersonne: o.prixSoloParPersonne } : {}),
      dansHoraires: o.dansHoraires === true,
      vols: vols as Vol[],
      lien: o.lien,
      observeLe: o.observeLe,
    });
  }
  return offres;
}

// ---------- Mission Palerme : la semaine la moins chère, en direct (même fenêtre que le rapport) ----------

export async function verifierSemaine(
  maintenant: Date,
  chercher: typeof chercherSemaineRyanair = chercherSemaineRyanair,
): Promise<{ semaine: (SemaineRyanair & PrixValise) | null; verifieLe: string; depuisCache: boolean }> {
  if (cacheSemaine && maintenant.getTime() - cacheSemaine.le < DUREE_CACHE_MS) {
    return { semaine: cacheSemaine.semaine, verifieLe: new Date(cacheSemaine.le).toISOString(), depuisCache: true };
  }
  const fenetre = fenetreDeDepart(maintenant, PALERME);
  const trouvee = await chercher({
    depuis: PALERME.depuisRyanair,
    vers: PALERME.vers,
    debut: fenetre.debut,
    fin: fenetre.fin,
    dureeJours: PALERME.dureeJours,
    adultes: PALERME.adultes,
  });
  const semaine = trouvee ? { ...trouvee, ...avecValise(trouvee.prixParPersonne, 'Ryanair', PALERME) } : null;
  cacheSemaine = { le: maintenant.getTime(), semaine };
  return { semaine, verifieLe: maintenant.toISOString(), depuisCache: false };
}

// Le prix trouvé en direct (envoyé par la page) comparé au dernier rapport.
export function comparerPalerme(etat: EtatPalerme, corps: unknown): { mission: 'palerme'; nouveau: number | null; dernier: number | null; difference: number | null } {
  const brut = (corps as { semaine?: { prixParPersonne?: unknown } } | null)?.semaine?.prixParPersonne;
  const nouveau = typeof brut === 'number' && Number.isFinite(brut) && brut > 0 ? brut : null;
  // Le dernier prix connu : celui du dernier rapport, ou d'un rapport plus ancien si la dernière semaine n'a rien trouvé.
  const dernier = etat.dernierRapport?.meilleurParPersonne ?? etat.dernierRapport?.reference?.prix ?? null;
  return { mission: 'palerme', nouveau, dernier, difference: nouveau !== null && dernier !== null ? arrondi(nouveau - dernier) : null };
}
