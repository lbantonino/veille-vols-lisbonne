// La scène du bureau : le robot change d'état, parle dans sa bulle, allume ses écrans.
// Les écrans de la scène et les cartes lisibles en dessous sont toujours remplis ensemble.

const SVG = 'http://www.w3.org/2000/svg';
const reduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const attendre = (ms) => new Promise((fin) => setTimeout(fin, ms));

const DUREES = { debout: 800, marche: 1700, coucher: 700, bulle: 200 };
const duree = (nom) => (reduit() ? Math.min(DUREES[nom], 220) : DUREES[nom]);

/**
 * @param {HTMLElement} racine la section du bureau (contient .scene, #bulle et #cartes)
 */
export function creerScene(racine) {
  const figure = /** @type {HTMLElement} */ (racine.querySelector('.scene'));
  const bulle = /** @type {HTMLElement} */ (racine.querySelector('#bulle'));
  const texteBulle = /** @type {HTMLElement} */ (bulle.querySelector('.bulle-texte'));
  const ecrans = Object.fromEntries([...figure.querySelectorAll('.ecran')].map((e) => [e.getAttribute('data-ecran'), e]));
  const cartes = Object.fromEntries([...racine.querySelectorAll('.carte')].map((c) => [c.getAttribute('data-carte'), c]));
  let jeton = 0; // la dernière phrase demandée gagne

  /** @param {'dort' | 'reveil' | 'travail' | 'coucher'} etat */
  async function passerA(etat) {
    if (etat === 'dort') {
      figure.dataset.etat = 'dort';
      return;
    }
    if (etat === 'travail') {
      figure.dataset.etat = 'travail';
      return;
    }
    if (etat === 'reveil') {
      figure.dataset.etat = 'debout';
      await attendre(duree('debout'));
      figure.dataset.etat = 'marche-bureau';
      await attendre(duree('marche'));
      figure.dataset.etat = 'travail';
      return;
    }
    // coucher
    figure.dataset.etat = 'marche-lit';
    await attendre(duree('marche'));
    figure.dataset.etat = 'dort';
    await attendre(duree('coucher'));
  }

  /** @param {string} texte */
  async function dire(texte) {
    const moi = ++jeton;
    bulle.classList.add('change');
    await attendre(duree('bulle'));
    if (moi !== jeton) return;
    texteBulle.textContent = texte;
    bulle.classList.remove('change');
  }

  function remplirLignesEcran(ecran, lignes) {
    const groupe = ecran.querySelector('.ecran-lignes');
    if (!groupe) return;
    groupe.replaceChildren();
    const affichees = lignes.length ? lignes : [{ texte: 'Aucun vol trouvé', prix: '', meilleur: false }];
    affichees.slice(0, 4).forEach((ligne, i) => {
      const y = 25 + i * 13;
      const gauche = document.createElementNS(SVG, 'text');
      gauche.setAttribute('x', '6');
      gauche.setAttribute('y', String(y));
      gauche.setAttribute('class', 'ecran-txt');
      gauche.textContent = ligne.texte;
      const droite = document.createElementNS(SVG, 'text');
      droite.setAttribute('x', '104');
      droite.setAttribute('y', String(y));
      droite.setAttribute('text-anchor', 'end');
      droite.setAttribute('class', `ecran-prix${ligne.meilleur ? ' meilleur' : ''}`);
      droite.textContent = ligne.prix;
      groupe.append(gauche, droite);
    });
  }

  function remplirCarte(carte, lignes, age) {
    const liste = carte.querySelector('.carte-lignes');
    liste.replaceChildren();
    if (!lignes.length) {
      const li = document.createElement('li');
      li.className = 'vide';
      li.textContent = 'Aucun vol trouvé pour l’instant.';
      liste.append(li);
    }
    for (const ligne of lignes) {
      const li = document.createElement('li');
      if (ligne.meilleur) li.className = 'meilleur';
      const texte = document.createElement('span');
      texte.textContent = ligne.texte;
      const prix = document.createElement('strong');
      prix.textContent = ligne.prix;
      li.append(texte, prix);
      liste.append(li);
    }
    carte.querySelector('.carte-age').textContent = age ?? '';
  }

  /**
   * Allume un écran et sa carte, et en fait l'écran actif.
   * @param {'ryanair' | 'google' | 'courbe'} nom
   * @param {{ lignes?: { texte: string, prix: string, meilleur: boolean }[], age?: string,
   *           chemins?: { horaires: string, tous: string }, legende?: string }} contenu
   */
  function allumer(nom, contenu) {
    const ecran = ecrans[nom];
    const carte = cartes[nom];
    const lignes = contenu.lignes ?? [];
    if (ecran) {
      if (nom === 'courbe') {
        ecran.querySelector('.courbe-horaires')?.setAttribute('d', contenu.chemins?.horaires ?? '');
        ecran.querySelector('.courbe-tous')?.setAttribute('d', contenu.chemins?.tous ?? '');
        const legende = ecran.querySelector('.courbe-legende');
        if (legende) legende.textContent = contenu.legende ?? '';
      } else {
        remplirLignesEcran(ecran, lignes);
      }
      for (const autre of Object.values(ecrans)) autre.classList.remove('actif');
      ecran.classList.add('allume', 'actif');
    }
    if (carte) {
      remplirCarte(carte, lignes, contenu.age);
      for (const autre of Object.values(cartes)) autre.classList.remove('active');
      carte.classList.add('active');
    }
  }

  function eteindreEcrans() {
    for (const ecran of Object.values(ecrans)) ecran.classList.remove('allume', 'actif');
    for (const carte of Object.values(cartes)) carte.classList.remove('active');
  }

  return { passerA, dire, allumer, eteindreEcrans };
}
