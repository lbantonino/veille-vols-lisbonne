// Les messages Telegram de la mission Palerme, dans le ton de LisbonIA (HTML accepté par Telegram).
import type { MissionPalerme } from '../missions.ts';
import { dateHeure, html, nomAeroport, prix } from '../format.ts';
import type { Rapport } from './rapport.ts';
import type { Vol } from '../types.ts';

const ligneVol = (titre: string, v: Vol): string =>
  `${titre} : ${dateHeure(v.depart)} · ${nomAeroport(v.de)} → ${nomAeroport(v.vers)} · ${html(v.compagnie)} ${html(v.numero)}`;

function texteEvolution(evolution: number | null): string {
  if (evolution === null) return 'Premier rapport.';
  if (evolution === 0) return 'Même prix que la semaine dernière.';
  return evolution < 0 ? `−${prix(-evolution)} depuis la semaine dernière.` : `+${prix(evolution)} depuis la semaine dernière.`;
}

export function messageRapport(r: Rapport, m: MissionPalerme): string {
  const titre = `🌴 <b>${m.robot} : ton rapport de la semaine</b>`;
  const periode = `départ entre le ${dateHeure(r.fenetre.debut)} et le ${dateHeure(r.fenetre.fin)}`;
  if (!r.ryanair) {
    return `${titre}\nAucune semaine trouvée chez Ryanair pour un séjour de ${m.dureeJours} jours, ${periode}. Je réessaie lundi prochain.\n\n👉 <a href="${html(m.lienPage)}">Voir ${m.robot}</a>`;
  }
  const estimation = m.valiseEstimee ? ' (estimation)' : '';
  const lignes = [
    titre,
    `La semaine la moins chère pour Palerme (${m.dureeJours} jours, ${periode}) :`,
    '',
    r.meilleurParPersonne !== null
      ? `<b>${prix(r.meilleurParPersonne)}</b> par personne, valise 20 kg comprise${estimation}`
      : 'Pas de prix valise comprise cette semaine.',
    texteEvolution(r.evolution),
    '',
    ligneVol('🛫 Aller', r.ryanair.aller),
    ligneVol('🛬 Retour', r.ryanair.retour),
    `Ryanair : ${prix(r.ryanair.prixParPersonne)} valise comprise${estimation} (${prix(r.ryanair.prixHorsValise)} + ${prix(r.ryanair.valiseParPersonne ?? 0)} de valise)`,
  ];
  if (r.google) {
    const vol = r.google.vols[0];
    const valise = r.google.valiseParPersonne === null ? 'valise non comprise' : `valise comprise${estimation}`;
    lignes.push(`Google Flights, mêmes dates : ${html(r.google.compagnie)}${vol ? ` ${html(vol.numero)}` : ''} à ${prix(r.google.prixParPersonne)} (${valise})`);
  } else {
    lignes.push(`Google Flights : pas de comparaison cette semaine${r.googleAbsent ? ` (${html(r.googleAbsent)})` : ''}.`);
  }
  const liens = [`<a href="${html(r.ryanair.lien)}">Réserver sur Ryanair</a>`];
  if (r.google) liens.push(`<a href="${html(r.google.lien)}">Voir sur Google Flights</a>`);
  liens.push(`<a href="${html(m.lienPage)}">Voir ${m.robot}</a>`);
  lignes.push('', `👉 ${liens.join(' · ')}`);
  return lignes.join('\n');
}

export function messageBascule(m: MissionPalerme): string {
  return [
    `✈️ <b>LisbonIA devient ${m.robot}</b>`,
    'Lisbonne, c’est fait : place à Palerme ! 🌴',
    `Désormais, chaque lundi matin, je t’envoie la semaine la moins chère pour ${m.dureeJours} jours à Palerme (départ dans 1 à 3 mois), pour ${m.adultes} adulte avec une valise de 20 kg.`,
    '',
    '<b>Trois choses à faire de ton côté :</b>',
    '1. 🔑 Renouvelle la clé GitHub de la page <b>avant le 31 mars 2027</b> : github.com/settings/personal-access-tokens → ta clé → Regenerate token, puis colle-la dans Vercel (Settings → Environments → Production → GITHUB_TOKEN) et redéploie.',
    `2. 🤖 Renomme ton bot dans Telegram : ouvre @BotFather, envoie /setname, choisis ton bot et tape « ${m.robot} ».`,
    '3. 🌐 Facultatif : ajoute l’adresse escale-ia.vercel.app à ta page (Vercel → Settings → Domains → Add).',
    '',
    'Ton premier rapport arrive juste après ce message.',
  ].join('\n');
}

// Sans Ryanair, pas de rapport (Google a besoin de ses dates) : envoyé une fois par semaine tant que la panne dure.
export function messagePanneRyanair(echecs: number, erreur?: string): string {
  const detail = erreur ? `\nDétail : ${html(erreur)}` : '';
  return `🔧 <b>Ryanair ne répond plus</b> (${echecs} échecs d'affilée).\nLe rapport de la semaine attend : je réessaie à chaque passage.${detail}`;
}
