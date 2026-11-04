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

/** "2026-11-04T21:17:00Z" -> "22h17" (heure de Bruxelles) @param {string} iso */
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

/** "2027-03-05T08:10:00" -> "ven 08:10" (heure locale de l'aéroport, sans conversion) @param {string} depart */
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
 * Tracé SVG d'une série de prix ; une valeur absente coupe la ligne.
 * Le prix le plus haut est en haut, le plus bas en bas.
 * @param {(number | null)[]} valeurs @param {number} largeur @param {number} hauteur
 */
export function cheminCourbe(valeurs, largeur, hauteur) {
  const nombres = valeurs.filter((v) => v !== null);
  if (nombres.length === 0) return '';
  const min = Math.min(...nombres);
  const max = Math.max(...nombres);
  const pasX = valeurs.length > 1 ? largeur / (valeurs.length - 1) : 0;
  const y = (v) => (max === min ? hauteur / 2 : hauteur - ((v - min) / (max - min)) * hauteur);
  let d = '';
  let enCours = false;
  valeurs.forEach((v, i) => {
    if (v === null) {
      enCours = false;
      return;
    }
    const x = valeurs.length > 1 ? i * pasX : largeur / 2;
    d += `${enCours ? 'L' : 'M'}${x.toFixed(1)} ${y(v).toFixed(1)} `;
    enCours = true;
  });
  return d.trim();
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
