// Les fonctions serveur de la page du robot, au format Web (Request -> Response).
// Les fichiers de api/ ne font que les appeler ; le serveur local (src/outils/serveur-local.ts) aussi.
import { voyage } from '../config.ts';
import { codeValide, delaiApresEchecs } from './acces.ts';
import { lireDonneesAgent } from './donnees.ts';
import { resumer } from './resume.ts';

// Dépendances remplaçables (tests, serveur local).
export interface Dependances {
  lire?: typeof lireDonneesAgent;
  maintenant?: () => Date;
  attendre?: (ms: number) => Promise<void>;
}

export interface EnvRobot {
  CODE_ACCES?: string;
  GITHUB_TOKEN?: string;
  GITHUB_DEPOT?: string;
  DONNEES_LOCALES?: string;
}

const ENTETES_JSON = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export const json = (corps: unknown, status = 200): Response =>
  new Response(JSON.stringify(corps), { status, headers: ENTETES_JSON });

// Prouve que la fonction a bien chargé le code de l'agent, sans rien dévoiler du voyage.
export function gererSante(): Response {
  return json({ ok: true, configChargee: typeof voyage.aller === 'string' });
}

// Mauvais codes à la suite, gardés en mémoire tant que la fonction reste chaude.
const OUBLI_APRES_MS = 15 * 60_000;
let echecs = 0;
let dernierEchec = 0;

const patienter = (ms: number): Promise<void> => new Promise((fin) => setTimeout(fin, ms));

// null si le code est bon ; sinon une réponse 401, après une attente qui s'allonge à chaque erreur.
export async function verifierAcces(
  request: Request,
  env: EnvRobot,
  options: { attendre?: (ms: number) => Promise<void> } = {},
): Promise<Response | null> {
  const maintenant = Date.now();
  if (maintenant - dernierEchec > OUBLI_APRES_MS) echecs = 0;

  if (codeValide(request.headers.get('x-code-acces'), env.CODE_ACCES)) {
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
  try {
    const { etat, historique } = await (deps.lire ?? lireDonneesAgent)(env);
    return json(resumer(etat, historique, (deps.maintenant ?? (() => new Date()))()));
  } catch (e) {
    console.error(`Notes illisibles : ${e instanceof Error ? e.message : String(e)}`);
    return json({ erreur: 'donnees' }, 502);
  }
}
