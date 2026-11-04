// Ce qui s'affiche sous la scène : les records, la courbe, le journal, et l'en-tête du voyage.
import {
  bornesCommunes,
  cheminCourbe,
  dateVoyage,
  formaterPrix,
  heureBruxelles,
  lignesEcran,
  momentJournal,
  pointMinimum,
  texteAge,
} from './rendu.js';

const SVG = 'http://www.w3.org/2000/svg';
const AEROPORTS = { CRL: 'Charleroi', BRU: 'Zaventem', LIS: 'Lisbonne' };
const nomAeroport = (code) => AEROPORTS[code] ?? code;

/** @param {string} balise @param {string} [classe] @param {string} [texte] */
function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function series(notes) {
  return {
    horaires: notes.courbe.map((p) => p.dansHoraires),
    tous: notes.courbe.map((p) => p.tous),
  };
}

/** Contenu de l'écran « courbe » de la scène et de sa carte. */
export function contenuCourbe(notes) {
  const { horaires, tous } = series(notes);
  const bornes = bornesCommunes([horaires, tous]);
  const lignes = [];
  if (notes.records.horaires) lignes.push({ texte: 'Dans tes horaires', prix: formaterPrix(notes.records.horaires.prixParPersonne), meilleur: true });
  if (notes.records.tous) lignes.push({ texte: 'Tous horaires', prix: formaterPrix(notes.records.tous.prixParPersonne), meilleur: false });
  return {
    lignes,
    chemins: { horaires: cheminCourbe(horaires, 94, 34, bornes), tous: cheminCourbe(tous, 94, 34, bornes) },
    legende: notes.records.horaires ? `record ${formaterPrix(notes.records.horaires.prixParPersonne)}` : '',
    age: notes.dernierPassage ? `Dernier passage de l'agent ${texteAge(notes.dernierPassage, new Date())}` : 'Pas encore de passage',
  };
}

function blocRecord(titre, record) {
  const bloc = el('article', 'record');
  bloc.append(el('h3', 'record-titre', titre));
  if (!record) {
    bloc.append(el('p', 'record-vide', 'Pas encore de prix.'));
    return bloc;
  }
  bloc.append(el('p', 'record-prix', formaterPrix(record.prixParPersonne)));
  bloc.append(el('p', 'record-sous', `par personne, valise comprise · record ${texteAge(record.le, new Date())}`));
  const liste = el('ul', 'record-vols');
  for (const offre of record.option.offres) {
    for (const vol of offre.vols) {
      const li = el('li');
      li.append(el('span', '', `${lignesEcran([{ prixParPersonne: offre.prixParPersonne, vols: [vol] }])[0].texte}`));
      li.append(el('span', 'record-trajet', `${nomAeroport(vol.de)} → ${nomAeroport(vol.vers)}`));
      liste.append(li);
    }
    if (offre.sens === 'aller-retour') liste.append(el('li', 'record-note', 'Retour au choix sur Google Flights'));
  }
  bloc.append(liste);
  const liens = el('p', 'record-liens');
  const vus = new Set();
  for (const offre of record.option.offres) {
    if (vus.has(offre.lien)) continue;
    vus.add(offre.lien);
    const a = el('a', 'lien', offre.source === 'ryanair' ? 'Voir sur Ryanair' : 'Voir sur Google Flights');
    a.href = offre.lien;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    liens.append(a);
  }
  bloc.append(liens);
  return bloc;
}

function dessinerCourbe(notes) {
  const svg = document.getElementById('courbe');
  const { horaires, tous } = series(notes);
  const bornes = bornesCommunes([horaires, tous]);
  const [L, H, X, Y] = [560, 140, 20, 30];
  svg.querySelector('.courbe-horaires').setAttribute('d', cheminCourbe(horaires, L, H, bornes));
  svg.querySelector('.courbe-tous').setAttribute('d', cheminCourbe(tous, L, H, bornes));
  svg.querySelector('.courbe-horaires').setAttribute('transform', `translate(${X} ${Y})`);
  svg.querySelector('.courbe-tous').setAttribute('transform', `translate(${X} ${Y})`);

  const grille = svg.querySelector('.courbe-grille');
  grille.replaceChildren();
  for (let i = 0; i <= 3; i += 1) {
    const ligne = document.createElementNS(SVG, 'line');
    ligne.setAttribute('x1', String(X));
    ligne.setAttribute('x2', String(X + L));
    ligne.setAttribute('y1', String(Y + (H / 3) * i));
    ligne.setAttribute('y2', String(Y + (H / 3) * i));
    grille.append(ligne);
  }
  if (!bornes) {
    const vide = document.createElementNS(SVG, 'text');
    vide.setAttribute('x', '300');
    vide.setAttribute('y', '105');
    vide.setAttribute('text-anchor', 'middle');
    vide.setAttribute('class', 'courbe-vide');
    vide.textContent = 'Pas encore de données';
    grille.append(vide);
    return;
  }
  for (const [nom, valeurs] of [['horaires', horaires], ['tous', tous]]) {
    const point = pointMinimum(valeurs, L, H, bornes);
    if (!point) continue;
    const rond = document.createElementNS(SVG, 'circle');
    rond.setAttribute('cx', String(X + point.x));
    rond.setAttribute('cy', String(Y + point.y));
    rond.setAttribute('r', '5');
    rond.setAttribute('class', `courbe-record courbe-record-${nom}`);
    const etiquette = document.createElementNS(SVG, 'text');
    // L'étiquette ne doit jamais sortir du cadre : calée à gauche ou à droite près des bords.
    const ancrage = point.x < 40 ? 'start' : point.x > L - 40 ? 'end' : 'middle';
    etiquette.setAttribute('x', String(X + point.x));
    etiquette.setAttribute('y', String(Math.max(14, Y + point.y + (nom === 'horaires' ? 20 : -12))));
    etiquette.setAttribute('text-anchor', ancrage);
    etiquette.setAttribute('class', `courbe-etiquette courbe-etiquette-${nom}`);
    etiquette.textContent = formaterPrix(point.valeur);
    grille.append(rond, etiquette);
  }
}

function remplirJournal(notes) {
  const liste = document.getElementById('journal');
  liste.replaceChildren();
  if (!notes.journal.length) {
    liste.append(el('li', 'journal-vide', 'Aucun passage pour l’instant.'));
    return;
  }
  for (const ligne of notes.journal) {
    const li = el('li', `journal-ligne${ligne.record ? ' est-record' : ''}`);
    li.append(el('span', 'journal-moment', momentJournal(ligne.le)));
    const prix = el('span', 'journal-prix');
    prix.append(el('span', 'journal-horaires', ligne.dansHoraires === null ? '—' : formaterPrix(ligne.dansHoraires)));
    prix.append(el('span', 'journal-tous', ligne.tous === null ? '—' : formaterPrix(ligne.tous)));
    li.append(prix);
    const etiquettes = el('span', 'journal-etiquettes');
    if (ligne.record) etiquettes.append(el('span', 'pastille pastille-record', 'record'));
    for (const panne of ligne.pannes) etiquettes.append(el('span', 'pastille pastille-panne', `${panne === 'google' ? 'Google' : 'Ryanair'} en panne`));
    li.append(etiquettes);
    liste.append(li);
  }
}

/** Remplit tout ce qui est sous la scène, et l'en-tête. */
export function afficherNotes(notes) {
  document.getElementById('entete-sous').textContent =
    `Bruxelles → Lisbonne · aller ${dateVoyage(notes.voyage.aller)}, retour ${dateVoyage(notes.voyage.retour)} · ${notes.voyage.horaires}`;
  const statut = document.getElementById('statut');
  statut.textContent = notes.dernierPassage
    ? `Dernier passage de l'agent : ${heureBruxelles(notes.dernierPassage)}${notes.prochainPassage ? ` · prochain vers ${heureBruxelles(notes.prochainPassage)}` : ''}`
    : "L'agent n'est pas encore passé";
  statut.hidden = false;

  const meilleurs = document.getElementById('meilleurs');
  meilleurs.replaceChildren(
    el('h2', 'bloc-titre', 'Ses records'),
    el('p', 'bloc-sous', 'Le prix le plus bas jamais vu, par personne et valise comprise'),
  );
  const rangee = el('div', 'records');
  rangee.append(blocRecord('Dans tes horaires', notes.records.horaires), blocRecord('Tous horaires', notes.records.tous));
  meilleurs.append(rangee);

  dessinerCourbe(notes);
  remplirJournal(notes);
  document.getElementById('notes').hidden = false;
}

/** Cache tout ce qui est personnel (code refusé). */
export function masquerNotes() {
  document.getElementById('notes').hidden = true;
  document.getElementById('cartes').hidden = true;
  document.getElementById('statut').hidden = true;
  document.getElementById('entete-sous').textContent = 'Ton agent de veille des vols';
}
