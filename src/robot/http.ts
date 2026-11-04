// Les fonctions serveur de la page du robot, au format Web (Request -> Response).
// Les fichiers de api/ ne font que les appeler ; le serveur local (src/outils/serveur-local.ts) aussi.
import { voyage } from '../config.ts';

const ENTETES_JSON = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export const json = (corps: unknown, status = 200): Response =>
  new Response(JSON.stringify(corps), { status, headers: ENTETES_JSON });

// Prouve que la fonction a bien chargé le code de l'agent, sans rien dévoiler du voyage.
export function gererSante(): Response {
  return json({ ok: true, configChargee: typeof voyage.aller === 'string' });
}
