// Fonctions d'affichage, pures et testées (test/site/rendu.test.ts). Aucune ne touche à la page.

const EUROS = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });
const HEURE_BRUXELLES = new Intl.DateTimeFormat('fr-BE', {
  timeZone: 'Europe/Brussels',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

/** @param {number} n */
export function formaterPrix(n) {
  return EUROS.format(n);
}

/** "2030-01-04T21:17:00Z" -> "22h17" (heure de Bruxelles) @param {string} iso */
export function heureBruxelles(iso) {
  const parties = HEURE_BRUXELLES.formatToParts(new Date(iso));
  const h = parties.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parties.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h}h${m}`;
}

/** @param {string} iso @param {Date} maintenant */
export function texteAge(iso, maintenant) {
  const secondes = Math.max(0, Math.round((maintenant.getTime() - new Date(iso).getTime()) / 1000));
  if (secondes < 60) return "à l'instant";
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 48) return `il y a ${heures} h`;
  return `il y a ${Math.floor(heures / 24)} j`;
}

/** "2030-01-04T08:10:00" -> "ven 08:10" (heure locale de l'aéroport, sans conversion) @param {string} depart */
function jourEtHeure(depart) {
  const [date = '', heure = ''] = depart.split('T');
  const [a = 0, mo = 1, j = 1] = date.split('-').map(Number);
  return `${JOURS[new Date(Date.UTC(a, mo - 1, j)).getUTCDay()]} ${heure.slice(0, 5)}`;
}

/**
 * Les lignes d'un écran du robot : 4 au plus, par heure de départ, la moins chère repérée.
 * @param {{ prixParPersonne: number, vols: { numero: string, depart: string }[] }[]} offres
 * @returns {{ texte: string, prix: string, meilleur: boolean }[]}
 */
export function lignesEcran(offres) {
  const triees = offres
    .filter((o) => o.vols.length > 0)
    .slice()
    .sort((a, b) => (a.vols[0].depart < b.vols[0].depart ? -1 : a.vols[0].depart > b.vols[0].depart ? 1 : 0))
    .slice(0, 4);
  const plusBas = Math.min(...triees.map((o) => o.prixParPersonne));
  let repere = false;
  return triees.map((o) => {
    const meilleur = !repere && o.prixParPersonne === plusBas;
    if (meilleur) repere = true;
    return { texte: `${jourEtHeure(o.vols[0].depart)} ${o.vols[0].numero}`, prix: formaterPrix(o.prixParPersonne), meilleur };
  });
}

/**
 * Plus petit et plus grand prix de plusieurs séries, pour les tracer sur la même échelle.
 * @param {(number | null)[][]} series @returns {{ min: number, max: number } | null}
 */
export function bornesCommunes(series) {
  const nombres = series.flat().filter((v) => v !== null);
  return nombres.length ? { min: Math.min(...nombres), max: Math.max(...nombres) } : null;
}

/** @param {(number | null)[]} valeurs @param {number} largeur @param {number} hauteur @param {{ min: number, max: number }} bornes */
function placeur(valeurs, largeur, hauteur, bornes) {
  const pasX = valeurs.length > 1 ? largeur / (valeurs.length - 1) : 0;
  return {
    x: (i) => (valeurs.length > 1 ? i * pasX : largeur / 2),
    y: (v) => (bornes.max === bornes.min ? hauteur / 2 : hauteur - ((v - bornes.min) / (bornes.max - bornes.min)) * hauteur),
  };
}

const AEROPORTS = { CRL: 'Charleroi', BRU: 'Zaventem', LIS: 'Lisbonne' };
const nomAeroport = (code) => AEROPORTS[code] ?? code;

/**
 * Les vols d'un record, aller puis retour ; pour un aller-retour Google sans retour connu, une note.
 * @param {{ sens: string, vols: { numero: string, de: string, vers: string, depart: string }[], volsRetour?: { numero: string, de: string, vers: string, depart: string }[] }[]} offres
 * @returns {({ texte: string, trajet: string } | { note: string })[]}
 */
export function lignesRecord(offres) {
  const ligne = (v) => ({ texte: `${jourEtHeure(v.depart)} ${v.numero}`, trajet: `${nomAeroport(v.de)} → ${nomAeroport(v.vers)}` });
  return offres.flatMap((offre) => {
    const lignes = offre.vols.map(ligne);
    if (offre.sens !== 'aller-retour') return lignes;
    return offre.volsRetour?.length ? [...lignes, ...offre.volsRetour.map(ligne)] : [...lignes, { note: 'Retour au choix sur Google Flights' }];
  });
}

/**
 * Tracé SVG d'une série de prix ; une valeur absente coupe la ligne.
 * Le prix le plus haut est en haut, le plus bas en bas. Sans bornes, la série a sa propre échelle.
 * @param {(number | null)[]} valeurs @param {number} largeur @param {number} hauteur
 * @param {{ min: number, max: number } | null} [bornes]
 */
export function cheminCourbe(valeurs, largeur, hauteur, bornes = null) {
  const echelle = bornes ?? bornesCommunes([valeurs]);
  if (!echelle || valeurs.every((v) => v === null)) return '';
  const { x, y } = placeur(valeurs, largeur, hauteur, echelle);
  let d = '';
  let enCours = false;
  valeurs.forEach((v, i) => {
    if (v === null) {
      enCours = false;
      return;
    }
    d += `${enCours ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    enCours = true;
  });
  return d.trim();
}

/**
 * Position du prix le plus bas d'une série (le record), sur la même échelle que sa courbe.
 * @param {(number | null)[]} valeurs @param {number} largeur @param {number} hauteur
 * @param {{ min: number, max: number } | null} bornes
 * @returns {{ x: number, y: number, valeur: number } | null}
 */
export function pointMinimum(valeurs, largeur, hauteur, bornes) {
  if (!bornes) return null;
  let indice = -1;
  valeurs.forEach((v, i) => {
    if (v !== null && (indice === -1 || v < /** @type {number} */ (valeurs[indice]))) indice = i;
  });
  if (indice === -1) return null;
  const valeur = /** @type {number} */ (valeurs[indice]);
  const { x, y } = placeur(valeurs, largeur, hauteur, bornes);
  return { x: x(indice), y: y(valeur), valeur };
}

const DATE_UTC = new Intl.DateTimeFormat('fr-BE', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const DATE_BRUXELLES = new Intl.DateTimeFormat('fr-BE', {
  timeZone: 'Europe/Brussels',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** @param {Intl.DateTimeFormat} format @param {Date} date */
function jourMois(format, date) {
  const parties = format.formatToParts(date);
  const valeur = (type) => parties.find((p) => p.type === type)?.value ?? '';
  return `${valeur('weekday')} ${valeur('day')} ${valeur('month')}`;
}

/** "2030-01-04" -> "ven. 4 janv." @param {string} jour */
export function dateVoyage(jour) {
  return jourMois(DATE_UTC, new Date(`${jour}T12:00:00Z`));
}

/** "2030-01-02T21:17:00Z" -> "mer. 2 janv. · 22h17" (heure de Bruxelles) @param {string} iso */
export function momentJournal(iso) {
  return `${jourMois(DATE_BRUXELLES, new Date(iso))} · ${heureBruxelles(iso)}`;
}

const JOUR_BRUXELLES = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * L'heure du dernier passage de l'agent, avec la date si ce n'était pas aujourd'hui (à Bruxelles).
 * @param {string} iso @param {Date} maintenant
 */
export function texteDernierPassage(iso, maintenant) {
  return JOUR_BRUXELLES.format(new Date(iso)) === JOUR_BRUXELLES.format(maintenant) ? heureBruxelles(iso) : momentJournal(iso);
}

/**
 * La phrase finale du robot, toujours vraie.
 * @param {{ choix: { horaires: { prixParPersonne: number, dansHoraires: boolean } | null, tous: { prixParPersonne: number, dansHoraires: boolean } | null }, nouveauRecord: { horaires: boolean, tous: boolean } } | null} c
 * @param {boolean} erreurRyanair
 */
export function conclusion(c, erreurRyanair) {
  if (erreurRyanair) return 'Ryanair ne répond pas en ce moment. Je réessaierai au prochain passage.';
  if (!c) return "Je n'ai pas pu comparer cette fois-ci. Je réessaierai au prochain passage.";
  const { horaires, tous } = c.choix;
  if (c.nouveauRecord.horaires && horaires) {
    return `🎉 ${formaterPrix(horaires.prixParPersonne)} dans tes horaires, nouveau record ! Je t'envoie l'alerte au prochain passage.`;
  }
  if (c.nouveauRecord.tous && tous && !tous.dansHoraires) {
    return `⏰ Hors de tes horaires : ${formaterPrix(tous.prixParPersonne)}, nouveau record. Alerte au prochain passage.`;
  }
  return horaires
    ? `Pas de nouveau record. Meilleur prix dans tes horaires : ${formaterPrix(horaires.prixParPersonne)}.`
    : 'Pas de nouveau record.';
}
