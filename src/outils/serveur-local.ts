// Serveur de développement de la page du robot : sert site/ et les mêmes fonctions que Vercel,
// avec les données locales de data/. Lancement : npm run site, puis http://localhost:4317
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { gererComparer, gererNotes, gererRyanair, gererSante, type Dependances, type EnvRobot } from '../robot/http.ts';

const PORT = 4317;
const SITE = fileURLToPath(new URL('../../site/', import.meta.url));
const CODE_LOCAL = 'code-local-essai-2026'; // valeur d'essai, uniquement pour ce serveur local

const env: EnvRobot = { ...process.env, DONNEES_LOCALES: '1', CODE_ACCES: process.env.CODE_ACCES ?? CODE_LOCAL };
// ESCALE_MAINTENANT=2027-03-16T10:00:00Z : simule une date, pour essayer la mission Palerme avant mars.
const maintenantSimule = process.env.ESCALE_MAINTENANT ? new Date(process.env.ESCALE_MAINTENANT) : null;
const deps: Dependances = {
  ...(maintenantSimule ? { maintenant: () => maintenantSimule } : {}),
  ...(process.env.SIMULER_PANNE_RYANAIR === '1'
    ? {
        chercher: async () => {
          throw new Error('Ryanair a répondu 409 pour CRL (panne simulée)');
        },
        chercherSemaine: async () => {
          throw new Error('Ryanair a répondu 409 pour CRL (panne simulée)');
        },
      }
    : {}),
};

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const ROUTES: Record<string, { methode: string; gerer: (r: Request) => Promise<Response> | Response }> = {
  '/api/sante': { methode: 'GET', gerer: () => gererSante(maintenantSimule ?? new Date()) },
  '/api/notes': { methode: 'GET', gerer: (r) => gererNotes(r, env, deps) },
  '/api/ryanair': { methode: 'POST', gerer: (r) => gererRyanair(r, env, deps) },
  '/api/comparer': { methode: 'POST', gerer: (r) => gererComparer(r, env, deps) },
};

function versRequest(req: IncomingMessage): Request {
  const entetes = new Headers();
  for (const [nom, valeur] of Object.entries(req.headers)) {
    if (typeof valeur === 'string') entetes.set(nom, valeur);
  }
  const avecCorps = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`http://localhost:${PORT}${req.url ?? '/'}`, {
    method: req.method ?? 'GET',
    headers: entetes,
    ...(avecCorps ? { body: Readable.toWeb(req) as ReadableStream, duplex: 'half' } : {}),
  } as RequestInit);
}

async function envoyer(res: ServerResponse, reponse: Response): Promise<void> {
  res.writeHead(reponse.status, Object.fromEntries(reponse.headers));
  res.end(Buffer.from(await reponse.arrayBuffer()));
}

async function servirFichier(res: ServerResponse, chemin: string): Promise<void> {
  const demande = decodeURIComponent(chemin === '/' ? '/index.html' : chemin);
  const fichier = resolve(SITE, `.${demande}`);
  if (!fichier.startsWith(SITE.endsWith(sep) ? SITE : SITE + sep)) {
    res.writeHead(404).end('Introuvable');
    return;
  }
  try {
    const contenu = await readFile(fichier);
    res.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(contenu);
  } catch {
    res.writeHead(404).end('Introuvable');
  }
}

createServer(async (req, res) => {
  try {
    const chemin = new URL(req.url ?? '/', `http://localhost:${PORT}`).pathname;
    const route = ROUTES[chemin];
    if (route) {
      if (req.method !== route.methode) {
        res.writeHead(405).end('Méthode non autorisée');
        return;
      }
      await envoyer(res, await route.gerer(versRequest(req)));
      return;
    }
    await servirFichier(res, chemin);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end('Erreur');
  }
}).listen(PORT, () => {
  console.log(`Page du robot : http://localhost:${PORT}`);
  if (!process.env.CODE_ACCES) console.log(`Code d'accès local (essai) : ${CODE_LOCAL}`);
  if (deps.chercher) console.log('Panne Ryanair simulée.');
  if (maintenantSimule) console.log(`Date simulée : ${maintenantSimule.toISOString()}`);
});
