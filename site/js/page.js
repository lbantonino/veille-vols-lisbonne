// Point d'entrée de la page.
import { creerScene } from './scene.js';

const scene = creerScene(/** @type {HTMLElement} */ (document.querySelector('.bureau')));

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
}

export { scene };
