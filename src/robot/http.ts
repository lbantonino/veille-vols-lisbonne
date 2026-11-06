// Les fonctions serveur de la page du robot, au format Web (Request -> Response).
// Les fichiers de api/ ne font que les appeler ; le serveur local (src/outils/serveur-local.ts) aussi.
import { voyage } from '../config.ts';
import { codeValide, delaiApresEchecs } from './acces.ts';
import { lireDonneesAgent, lireDonneesPalerme } from './donnees.ts';
import { resumer, resumerPalerme, voyageCommence } from './resume.ts';
import { comparerEnDirect, comparerPalerme, lireOffres, verifierRyanair, verifierSemaine } from './direct.ts';
import { chercherRyanair, chercherSemaineRyanair } from '../sources/ryanair.ts';
import { missionActive } from '../missions.ts';

// Dépendances remplaçables (tests, serveur local).
export interface Dependances {
  lire?: typeof lireDonneesAgent;
  chercher?: typeof chercherRyanair;
  lirePalerme?: typeof lireDonneesPalerme;
  chercherSemaine?: typeof chercherSemaineRyanair;
  maintenant?: () => Date;
  attendre?: (ms: number) => Promise<void>;
}

export interface EnvRobot {
  CODE_ACCES?: string;
  GITHUB_TOKEN?: string;
  GITHUB_DEPOT?: string;
  DONNEES_LOCALES?: string;
  DOSSIER_DONNEES?: string;
}

const ENTETES_JSON = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export const json = (corps: unknown, status = 200): Response =>
  new Response(JSON.stringify(corps), { status, headers: ENTETES_JSON });

// Prouve que la fonction a bien chargé le code de l'agent, sans rien dévoiler du voyage.
// Public : seul le nom du robot de la mission active est donné (pas une donnée personnelle).
export function gererSante(maintenant: Date = new Date()): Response {
  return json({ ok: true, configChargee: typeof voyage.aller === 'string', robot: missionActive(maintenant).robot });
}

// GET /api/sante?notes=1 : le serveur arrive-t-il à lire les notes de l'agent ? Seulement oui/non et la raison
// technique (ex. « GitHub a répondu 401 »), jamais le contenu ni la clé.
export async function gererSanteDetaillee(env: EnvRobot, deps: Dependances = {}): Promise<Response> {
  const jetonGitHub = Boolean(env.GITHUB_TOKEN);
  const base = { ok: true, configChargee: typeof voyage.aller === 'string', jetonGitHub };
  if (!jetonGitHub && env.DONNEES_LOCALES !== '1') {
    return json({ ...base, notes: 'illisibles', raison: 'Pas de variable GITHUB_TOKEN dans Vercel' });
  }
  try {
    if (missionActive((deps.maintenant ?? (() => new Date()))()).id === 'palerme') await (deps.lirePalerme ?? lireDonneesPalerme)(env);
    else await (deps.lire ?? lireDonneesAgent)(env);
    return json({ ...base, notes: 'lisibles' });
  } catch (e) {
    return json({ ...base, notes: 'illisibles', raison: e instanceof Error ? e.message : String(e) });
  }
}

// Mauvais codes à la suite, gardés en mémoire tant que la fonction reste chaude.
const OUBLI_APRES_MS = 15 * 60_000;
let echecs = 0;
let dernierEchec = 0;

const patienter = (ms: number): Promise<void> => new Promise((fin) => setTimeout(fin, ms));

// Le navigateur envoie le code encodé (encodeURIComponent), pour que les accents passent dans l'en-tête.
function codeRecu(request: Request): string | null {
  const brut = request.headers.get('x-code-acces');
  if (brut === null) return null;
  try {
    return decodeURIComponent(brut);
  } catch {
    return brut;
  }
}

// null si le code est bon ; sinon une réponse 401, après une attente qui s'allonge à chaque erreur.
export async function verifierAcces(
  request: Request,
  env: EnvRobot,
  options: { attendre?: (ms: number) => Promise<void> } = {},
): Promise<Response | null> {
  const maintenant = Date.now();
  if (maintenant - dernierEchec > OUBLI_APRES_MS) echecs = 0;

  if (codeValide(codeRecu(request), env.CODE_ACCES)) {
    echecs = 0;
    return null;
  }

  echecs += 1;
  dernierEchec = maintenant;
  await (options.attendre ?? patienter)(delaiApresEchecs(echecs));
  return json({ erreur: 'code' }, 401);
}

// GET /api/notes : le résumé de la mémoire de l'agent (records, journal, courbe, dernières offres).
export async function gererNotes(request: Request, env: EnvRobot, deps: Dependances = {}): Promise<Response> {
  const refus = await verifierAcces(request, env, deps);
  if (refus) return refus;
  const maintenant = (deps.maintenant ?? (() => new Date()))();
  try {
    if (missionActive(maintenant).id === 'palerme') {
      const { etat, rapports } = await (deps.lirePalerme ?? lireDonneesPalerme)(env);
      return json(resumerPalerme(etat, rapports, maintenant));
    }
    const { etat, historique } = await (deps.lire ?? lireDonneesAgent)(env);
    return json(resumer(etat, historique, maintenant));
  } catch (e) {
    console.error(`Notes illisibles : ${e instanceof Error ? e.message : String(e)}`);
    return json({ erreur: 'donnees' }, 502);
  }
}

const texteErreur = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// POST /api/ryanair : Ryanair interrogé maintenant (ou il y a moins d'une minute).
export async function gererRyanair(request: Request, env: EnvRobot, deps: Dependances = {}): Promise<Response> {
  const refus = await verifierAcces(request, env, deps);
  if (refus) return refus;
  const maintenant = (deps.maintenant ?? (() => new Date()))();
  if (missionActive(maintenant).id === 'palerme') {
    try {
      return json(await verifierSemaine(maintenant, deps.chercherSemaine ?? chercherSemaineRyanair));
    } catch (e) {
      return json({ erreur: 'ryanair', message: texteErreur(e) }, 502);
    }
  }
  if (voyageCommence(maintenant)) return json({ erreur: 'termine' }, 409);
  try {
    return json(await verifierRyanair(maintenant, deps.chercher ?? chercherRyanair));
  } catch (e) {
    return json({ erreur: 'ryanair', message: texteErreur(e) }, 502);
  }
}

// POST /api/comparer { offres } : les offres Ryanair fraîches comparées aux données de l'agent.
export async function gererComparer(request: Request, env: EnvRobot, deps: Dependances = {}): Promise<Response> {
  const refus = await verifierAcces(request, env, deps);
  if (refus) return refus;
  const maintenant = (deps.maintenant ?? (() => new Date()))();
  const corps: unknown = await request.json().catch(() => null);
  if (missionActive(maintenant).id === 'palerme') {
    try {
      const { etat } = await (deps.lirePalerme ?? lireDonneesPalerme)(env);
      return json(comparerPalerme(etat, corps));
    } catch (e) {
      console.error(`Comparaison impossible : ${texteErreur(e)}`);
      return json({ erreur: 'donnees' }, 502);
    }
  }
  if (voyageCommence(maintenant)) return json({ erreur: 'termine' }, 409);
  try {
    const { etat } = await (deps.lire ?? lireDonneesAgent)(env);
    return json(comparerEnDirect(etat, lireOffres(corps), maintenant));
  } catch (e) {
    console.error(`Comparaison impossible : ${texteErreur(e)}`);
    return json({ erreur: 'donnees' }, 502);
  }
}
