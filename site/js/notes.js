// Ce qui s'affiche sous la scène : les records, la courbe, le journal, et l'en-tête du voyage.
import {
  bornesCommunes,
  cheminCourbe,
  dateVoyage,
  formaterPrix,
  heureBruxelles,
  lignesRecord,
  momentJournal,
  pointMinimum,
  sousTitreRapportPalerme,
  texteAge,
  texteDernierPassage,
} from './rendu.js';

const SVG = 'http://www.w3.org/2000/svg';

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
  for (const ligne of lignesRecord(record.option.offres)) {
    if ('note' in ligne) {
      liste.append(el('li', 'record-note', ligne.note));
      continue;
    }
    const li = el('li');
    li.append(el('span', '', ligne.texte), el('span', 'record-trajet', ligne.trajet));
    liste.append(li);
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
  dessinerSeries(series(notes));
}

/** @param {{ horaires: (number | null)[], tous: (number | null)[] }} valeurs */
function dessinerSeries({ horaires, tous }) {
  const svg = document.getElementById('courbe');
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
// Les textes de la page qui changent avec la mission.
const TEXTES = {
  lisbonne: {
    ecranRyanair: 'Ryanair · CRL ↔ LIS',
    ecranGoogle: 'Google Flights · LIS',
    sousRyanair: 'Charleroi ↔ Lisbonne, en direct',
    sousGoogle: 'Zaventem et Charleroi ↔ Lisbonne',
    titreCourbe: 'Ses records',
    sousCourbe: 'Prix par personne, valise comprise',
    legendeHoraires: 'Dans tes horaires',
  },
  palerme: {
    ecranRyanair: 'Ryanair · CRL ↔ PMO',
    ecranGoogle: 'Google Flights · PMO',
    sousRyanair: 'Charleroi ↔ Palerme, la semaine la moins chère',
    sousGoogle: 'Mêmes dates, au dernier rapport',
    titreCourbe: 'Ses rapports',
    sousCourbe: 'Meilleur prix de chaque semaine, valise comprise',
    legendeHoraires: 'Meilleur prix de chaque rapport',
  },
};

const ecrire = (id, texte) => {
  const noeud = document.getElementById(id);
  if (noeud) noeud.textContent = texte;
};

/** Le nom du robot de la mission active, partout sur la page (connu même sans code). @param {string} robot */
export function appliquerNom(robot) {
  for (const noeud of document.querySelectorAll('.nom-robot')) noeud.textContent = robot;
  document.title = robot;
}

/** @param {{ id: string, robot: string }} mission */
export function appliquerMission(mission) {
  appliquerNom(mission.robot);
  const t = TEXTES[mission.id] ?? TEXTES.lisbonne;
  ecrire('ecran-titre-ryanair', t.ecranRyanair);
  ecrire('ecran-titre-google', t.ecranGoogle);
  ecrire('carte-sous-ryanair', t.sousRyanair);
  ecrire('carte-sous-google', t.sousGoogle);
  ecrire('carte-titre-courbe', t.titreCourbe);
  ecrire('carte-sous-courbe', t.sousCourbe);
  ecrire('legende-horaires', t.legendeHoraires);
  const tous = document.getElementById('legende-tous');
  if (tous) tous.hidden = mission.id === 'palerme';
}

export function afficherNotes(notes) {
  if (notes.mission) appliquerMission(notes.mission);
  if (notes.mission?.id === 'palerme') {
    afficherNotesPalerme(notes);
    return;
  }
  document.getElementById('entete-sous').textContent =
    `Bruxelles → Lisbonne · aller ${dateVoyage(notes.voyage.aller)}, retour ${dateVoyage(notes.voyage.retour)} · ${notes.voyage.horaires}`;
  const statut = document.getElementById('statut');
  statut.textContent = notes.dernierPassage
    ? `Dernier passage de l'agent : ${texteDernierPassage(notes.dernierPassage, new Date())}${notes.prochainPassage ? ` · prochain vers ${heureBruxelles(notes.prochainPassage)}` : ''}`
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

// ---------- Mission Palerme ----------

const meilleursDesRapports = (notes) => notes.courbe.map((p) => p.meilleur);

/** Contenu de l'écran « courbe » de la scène et de sa carte, pour PalermoIA. */
export function contenuCourbePalerme(notes) {
  const valeurs = meilleursDesRapports(notes);
  const bornes = bornesCommunes([valeurs]);
  const dernier = notes.dernierRapport?.meilleurParPersonne ?? null;
  return {
    lignes: dernier !== null ? [{ texte: 'Dernier rapport', prix: formaterPrix(dernier), meilleur: true }] : [],
    chemins: { horaires: cheminCourbe(valeurs, 94, 34, bornes), tous: '' },
    legende: dernier !== null ? `dernier ${formaterPrix(dernier)}` : '',
    age: notes.dernierPassage ? `Dernier rapport ${texteAge(notes.dernierPassage, new Date())}` : 'Pas encore de rapport',
  };
}

function blocRapport(rapport, estimation) {
  const bloc = el('article', 'record');
  if (!rapport?.ryanair) {
    bloc.append(el('h3', 'record-titre', 'Dernier rapport'));
    bloc.append(el('p', 'record-vide', rapport ? 'Aucune semaine trouvée chez Ryanair à ce rapport.' : 'Pas encore de rapport : le premier arrive le jour de la bascule.'));
    return bloc;
  }
  const { aller, retour } = rapport.ryanair;
  bloc.append(el('h3', 'record-titre', `Du ${dateVoyage(aller.depart.slice(0, 10))} au ${dateVoyage(retour.depart.slice(0, 10))}`));
  bloc.append(el('p', 'record-prix', rapport.meilleurParPersonne !== null ? formaterPrix(rapport.meilleurParPersonne) : '—'));
  bloc.append(el('p', 'record-sous', sousTitreRapportPalerme(rapport, estimation)));
  const liste = el('ul', 'record-vols');
  for (const ligne of lignesRecord([{ sens: 'aller', vols: [aller] }, { sens: 'retour', vols: [retour] }])) {
    if ('note' in ligne) continue;
    const li = el('li');
    li.append(el('span', '', ligne.texte), el('span', 'record-trajet', ligne.trajet));
    liste.append(li);
  }
  const g = rapport.google;
  liste.append(
    el(
      'li',
      'record-note',
      g
        ? `Google Flights, mêmes dates : ${g.compagnie} à ${formaterPrix(g.prixParPersonne)} (${g.valiseParPersonne === null ? 'valise non comprise' : 'valise comprise'})`
        : `Google Flights : pas de comparaison${rapport.googleAbsent ? ` (${rapport.googleAbsent})` : ''}`,
    ),
  );
  bloc.append(liste);
  const liens = el('p', 'record-liens');
  for (const [texte, url] of [['Réserver sur Ryanair', rapport.ryanair.lien], ['Voir sur Google Flights', g?.lien]]) {
    if (!url || !/^https:\/\//.test(url)) continue;
    const a = el('a', 'lien', texte);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    liens.append(a);
  }
  bloc.append(liens);
  return bloc;
}

function remplirJournalPalerme(notes) {
  const liste = document.getElementById('journal');
  liste.replaceChildren();
  if (!notes.journal.length) {
    liste.append(el('li', 'journal-vide', 'Aucun rapport pour l’instant.'));
    return;
  }
  for (const r of notes.journal) {
    const li = el('li', `journal-ligne${r.evolution !== null && r.evolution < 0 ? ' est-record' : ''}`);
    li.append(el('span', 'journal-moment', momentJournal(r.le)));
    const prix = el('span', 'journal-prix');
    prix.append(el('span', 'journal-horaires', r.meilleurParPersonne === null ? '—' : formaterPrix(r.meilleurParPersonne)));
    if (r.ryanair) prix.append(el('span', 'journal-tous', `${dateVoyage(r.ryanair.aller.depart.slice(0, 10))} → ${dateVoyage(r.ryanair.retour.depart.slice(0, 10))}`));
    li.append(prix);
    const etiquettes = el('span', 'journal-etiquettes');
    if (r.evolution !== null && r.evolution !== 0) {
      etiquettes.append(el('span', `pastille ${r.evolution < 0 ? 'pastille-record' : 'pastille-panne'}`, `${r.evolution < 0 ? '−' : '+'}${formaterPrix(Math.abs(r.evolution))}`));
    }
    li.append(etiquettes);
    liste.append(li);
  }
}

function afficherNotesPalerme(notes) {
  document.getElementById('entete-sous').textContent = `${notes.mission.trajet} · ${notes.mission.details}`;
  const statut = document.getElementById('statut');
  statut.textContent = notes.dernierPassage ? `Dernier rapport : ${texteDernierPassage(notes.dernierPassage, new Date())}` : 'Pas encore de rapport';
  statut.hidden = false;

  const meilleurs = document.getElementById('meilleurs');
  meilleurs.replaceChildren(
    el('h2', 'bloc-titre', 'Son dernier rapport'),
    el('p', 'bloc-sous', 'La semaine la moins chère pour Palerme, valise de 20 kg comprise'),
  );
  const rangee = el('div', 'records');
  rangee.append(blocRapport(notes.dernierRapport, notes.mission?.valiseEstimee === true));
  meilleurs.append(rangee);

  dessinerSeries({ horaires: meilleursDesRapports(notes), tous: [] });
  remplirJournalPalerme(notes);
  document.getElementById('notes').hidden = false;
}

