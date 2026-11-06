// Une visite : le robot se réveille, relit ses notes, vérifie Ryanair en direct,
// regarde Google Flights (sans l'appeler), compare, annonce le résultat et retourne se coucher.
// Mission Lisbonne (LisbonIA) ou mission Palerme (PalermoIA), selon les notes reçues.
// Chaque étape affichée correspond à une vraie opération.
import { appeler } from './api.js';
import { conclusion, conclusionPalerme, ecranRyanairPalerme, formaterPrix, heureBruxelles, lignesEcran, texteAge, texteDernierPassage } from './rendu.js';
import { afficherNotes, contenuCourbe, contenuCourbePalerme } from './notes.js';

const LIBELLE_MIN_MS = 1200; // le temps de lire chaque étape
const CONCLUSION_MS = 4500;
const attendre = (ms) => new Promise((fin) => setTimeout(fin, ms));

let enCours = false;

/** Exécute `promesse` pendant que la bulle affiche `texte` (au moins le temps de le lire). */
async function pendant(scene, texte, promesse) {
  scene.dire(texte);
  const [resultat] = await Promise.allSettled([promesse, attendre(LIBELLE_MIN_MS)]);
  if (resultat.status === 'rejected') throw resultat.reason;
  return resultat.value;
}

function phraseDeRepos(notes) {
  if (!notes?.dernierPassage) return 'Zzz…';
  if (notes.mission?.id === 'palerme') return `Zzz… Dernier rapport : ${texteDernierPassage(notes.dernierPassage, new Date())}`;
  const prochain = notes.prochainPassage ? ` · prochain vers ${heureBruxelles(notes.prochainPassage)}` : '';
  return `Zzz… Dernier passage de l'agent : ${texteDernierPassage(notes.dernierPassage, new Date())}${prochain}`;
}

async function retourAuLit(scene, notes) {
  scene.eteindreEcrans();
  await scene.passerA('coucher');
  await scene.dire(phraseDeRepos(notes));
}

/** @param {ReturnType<import('./scene.js').creerScene>} scene */
async function deroulerVisite(scene) {
  await scene.passerA('dort');
  await scene.dire('Zzz… Oh, de la visite !');
  await attendre(500);
  await scene.passerA('reveil');

  // 1. Ses notes (la mémoire de l'agent)
  let notes;
  try {
    notes = await pendant(scene, 'Je relis mes notes…', appeler('/api/notes'));
  } catch (e) {
    if (e.message === 'code') return;
    await scene.dire("Je n'arrive pas à relire mes notes. Je retourne me coucher.");
    await attendre(2500);
    await retourAuLit(scene, null);
    return;
  }
  document.getElementById('cartes').hidden = false;
  afficherNotes(notes);
  if (notes.mission?.id === 'palerme') {
    await visitePalerme(scene, notes);
    return;
  }
  scene.allumer('courbe', contenuCourbe(notes));

  if (notes.termine) {
    await scene.dire('Je suis en vacances. Bon voyage et bonne course !');
    await attendre(CONCLUSION_MS);
    await retourAuLit(scene, notes);
    return;
  }

  // 2. Ryanair, en direct
  let ryanair = null;
  let erreurRyanair = false;
  try {
    ryanair = await pendant(scene, 'Je vérifie Ryanair…', appeler('/api/ryanair', { methode: 'POST' }));
  } catch (e) {
    if (e.message === 'code') return;
    erreurRyanair = true;
  }
  const offresRyanair = ryanair?.offres ?? notes.ryanair.offres;
  scene.allumer('ryanair', {
    lignes: lignesEcran(offresRyanair),
    age: ryanair
      ? `Vérifié ${texteAge(ryanair.verifieLe, new Date())}`
      : `Ryanair ne répond pas : prix ${notes.ryanair.vuLe ? `vus ${texteAge(notes.ryanair.vuLe, new Date())}` : 'indisponibles'}`,
  });
  if (ryanair?.depuisCache) {
    await scene.dire(`Ryanair vérifié ${texteAge(ryanair.verifieLe, new Date())}`);
    await attendre(LIBELLE_MIN_MS);
  }

  // 3. Google Flights : les offres du dernier passage de l'agent (aucun appel, pour ne pas toucher au quota)
  const vuGoogle = notes.google.vuLe ? `vu ${texteAge(notes.google.vuLe, new Date())}` : null;
  await scene.dire(vuGoogle ? `Je regarde Google Flights… ${vuGoogle}` : 'Google Flights : pas encore de données');
  scene.allumer('google', {
    lignes: lignesEcran(notes.google.offres),
    age: vuGoogle ? `Relevé par l'agent, ${vuGoogle}` : 'Pas encore de données',
  });
  await attendre(LIBELLE_MIN_MS);

  // 4. La comparaison
  let comparaison = null;
  try {
    comparaison = await pendant(scene, 'Je compare…', appeler('/api/comparer', { methode: 'POST', corps: { offres: offresRyanair } }));
  } catch (e) {
    if (e.message === 'code') return;
  }

  // 5. Le verdict, puis au lit
  await scene.dire(conclusion(comparaison, erreurRyanair));
  await attendre(CONCLUSION_MS);
  await retourAuLit(scene, notes);
}

/** La suite de la visite pour PalermoIA : la semaine la moins chère en direct, comparée au dernier rapport. */
async function visitePalerme(scene, notes) {
  scene.allumer('courbe', contenuCourbePalerme(notes));
  const dernier = notes.dernierRapport;
  const estimation = notes.mission?.valiseEstimee === true;

  // 2. Ryanair, en direct : la semaine la moins chère sur la période du rapport
  let reponse = null;
  let erreurRyanair = false;
  try {
    reponse = await pendant(scene, 'Je cherche la semaine la moins chère chez Ryanair…', appeler('/api/ryanair', { methode: 'POST' }));
  } catch (e) {
    if (e.message === 'code') return;
    erreurRyanair = true;
  }
  const semaine = reponse?.semaine ?? null;
  scene.allumer('ryanair', ecranRyanairPalerme(reponse, dernier, new Date()));

  // 3. Google Flights : la comparaison du dernier rapport (aucun appel, pour ne pas toucher au quota)
  const g = dernier?.google ?? null;
  await scene.dire(g && dernier ? `Je regarde Google Flights… dernier rapport ${texteAge(dernier.le, new Date())}` : 'Google Flights : pas de comparaison au dernier rapport');
  scene.allumer('google', {
    lignes: g ? [{ texte: `${g.compagnie} ${g.vols?.[0]?.numero ?? ''}`.trim(), prix: formaterPrix(g.prixParPersonne), meilleur: false }] : [],
    age: g ? (g.valiseParPersonne === null ? 'Valise non comprise' : `Valise comprise${estimation ? ' (estimation)' : ''}`) : 'Pas de comparaison',
  });
  await attendre(LIBELLE_MIN_MS);

  // 4. La comparaison avec le dernier rapport
  let comparaison = null;
  if (!erreurRyanair) {
    try {
      comparaison = await pendant(
        scene,
        'Je compare avec mon dernier rapport…',
        appeler('/api/comparer', { methode: 'POST', corps: { semaine: semaine ? { prixParPersonne: semaine.prixParPersonne } : null } }),
      );
    } catch (e) {
      if (e.message === 'code') return;
    }
  }

  // 5. Le verdict, puis au lit
  await scene.dire(conclusionPalerme(comparaison, erreurRyanair, estimation));
  await attendre(CONCLUSION_MS);
  await retourAuLit(scene, notes);
}

/**
 * Lance une visite, sauf si une est déjà en cours.
 * @param {ReturnType<import('./scene.js').creerScene>} scene
 */
export async function lancerVisite(scene) {
  if (enCours) return;
  enCours = true;
  try {
    await deroulerVisite(scene);
  } finally {
    enCours = false;
  }
}

export const visiteEnCours = () => enCours;
