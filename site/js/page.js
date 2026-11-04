// Point d'entrée de la page.
import { creerScene } from './scene.js';
import { memoriserCode, obtenirCode, quandCodeRefuse } from './api.js';
import { lancerVisite } from './visite.js';
import { masquerNotes } from './notes.js';

const RETOUR_APRES_MS = 10 * 60_000;

const scene = creerScene(/** @type {HTMLElement} */ (document.querySelector('.bureau')));
const formulaire = /** @type {HTMLFormElement} */ (document.getElementById('acces'));
const champ = /** @type {HTMLInputElement} */ (document.getElementById('code'));
const erreur = document.getElementById('acces-erreur');

function demanderCode(apresErreur) {
  masquerNotes();
  scene.eteindreEcrans();
  scene.passerA('dort');
  scene.dire(apresErreur ? 'Zzz… Ce code ne me réveille pas.' : 'Zzz… Donne-moi ton code pour me réveiller.');
  erreur.hidden = !apresErreur;
  formulaire.hidden = false;
  champ.value = '';
}

quandCodeRefuse(() => demanderCode(true));

formulaire.addEventListener('submit', (evenement) => {
  evenement.preventDefault();
  const code = champ.value.trim();
  if (code.length < 12) {
    erreur.hidden = false;
    return;
  }
  memoriserCode(code);
  formulaire.hidden = true;
  erreur.hidden = true;
  lancerVisite(scene);
});

// Retour sur l'onglet après au moins 10 minutes : nouvelle visite.
let cacheLe = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cacheLe = Date.now();
    return;
  }
  if (cacheLe !== null && Date.now() - cacheLe >= RETOUR_APRES_MS && obtenirCode()) lancerVisite(scene);
  cacheLe = null;
});

// Développement : ?etat=travail ou ?etat=dort fige la scène, avec des lignes d'exemple
// (aucune donnée réelle, la page reste vide de tout renseignement personnel).
const etatFige = new URLSearchParams(location.search).get('etat');
if (etatFige === 'travail' || etatFige === 'dort') {
  document.getElementById('cartes').hidden = false;
  const exemple = [
    { texte: 'ven 08:10 VOL1', prix: '—', meilleur: false },
    { texte: 'ven 15:35 VOL2', prix: '—', meilleur: true },
    { texte: 'lun 10:00 VOL3', prix: '—', meilleur: false },
    { texte: 'lun 17:05 VOL4', prix: '—', meilleur: false },
  ];
  scene.allumer('ryanair', { lignes: exemple, age: 'exemple' });
  scene.allumer('google', { lignes: exemple, age: 'exemple' });
  scene.allumer('courbe', {
    lignes: [{ texte: 'Record', prix: '—', meilleur: true }],
    chemins: { horaires: 'M0 6 L20 10 L40 8 L60 20 L80 17 L94 30', tous: 'M0 14 L30 18 L60 26 L94 32' },
    legende: 'exemple',
  });
  if (etatFige === 'travail') {
    await scene.passerA('reveil');
    await scene.dire('Je vérifie Ryanair…');
  } else {
    scene.eteindreEcrans();
    await scene.dire('Zzz…');
  }
} else if (obtenirCode()) {
  lancerVisite(scene);
} else {
  demanderCode(false);
}

export { scene };
