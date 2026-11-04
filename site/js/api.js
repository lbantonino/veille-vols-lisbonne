// Appels aux fonctions serveur, avec ton code d'accès (gardé dans ce navigateur).
// Le code part encodé (encodeURIComponent) : les accents et symboles passent sans souci.
const CLE = 'lisbonia-code';
let codeEnMemoire = null; // si le navigateur refuse localStorage (navigation privée)
let surRefus = () => {};

export function obtenirCode() {
  try {
    return localStorage.getItem(CLE) ?? codeEnMemoire;
  } catch {
    return codeEnMemoire;
  }
}

/** @param {string} code */
export function memoriserCode(code) {
  codeEnMemoire = code;
  try {
    localStorage.setItem(CLE, code);
  } catch {
    // tant pis : le code reste en mémoire pour cette visite
  }
}

export function oublierCode() {
  codeEnMemoire = null;
  try {
    localStorage.removeItem(CLE);
  } catch {
    // rien à oublier
  }
}

/** Ce qu'il faut faire quand le serveur refuse le code. @param {() => void} fonction */
export function quandCodeRefuse(fonction) {
  surRefus = fonction;
}

/**
 * @param {string} chemin
 * @param {{ methode?: 'GET' | 'POST', corps?: unknown }} [options]
 */
export async function appeler(chemin, { methode = 'GET', corps } = {}) {
  const entetes = { 'x-code-acces': encodeURIComponent(obtenirCode() ?? '') };
  if (corps !== undefined) entetes['content-type'] = 'application/json';
  const reponse = await fetch(chemin, {
    method: methode,
    headers: entetes,
    cache: 'no-store',
    ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
  });
  if (reponse.status === 401) {
    oublierCode();
    surRefus();
    throw new Error('code');
  }
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new Error(donnees?.erreur ?? `http ${reponse.status}`);
  return donnees;
}
