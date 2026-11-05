// Textes des messages Telegram (format HTML accepté par Telegram).
import type { AvisGoogle, Choix, Offre, Option, Source } from './types.ts';
import { horaires, voyage } from './config.ts';
import { dateHeure, html, nomAeroport, prix } from './format.ts';
import { enClair, texteHoraires, volDansHoraires } from './horaires.ts';
import { lienRyanair } from './sources/ryanair.ts';

const NOM_SOURCE: Record<Source, string> = { ryanair: 'Ryanair', google: 'Google Flights' };
const NOM_SENS = { 'aller-retour': 'Aller-retour', aller: 'Aller', retour: 'Retour' } as const;

function lignesVols(titre: string, offre: Offre): string[] {
  const sensJambe = offre.sens === 'retour' ? 'retour' : 'aller';
  return offre.vols.map((v) => {
    const hors = volDansHoraires(sensJambe, v.depart) ? '' : ' · ⏰ hors horaires';
    return `${titre} : ${dateHeure(v.depart)} · ${nomAeroport(v.de)} → ${nomAeroport(v.vers)} · ${html(v.compagnie)} ${html(v.numero)}${hors}`;
  });
}

function liens(option: Option): string[] {
  const [a, b] = option.offres;
  const volA = a?.vols[0];
  const volB = b?.vols[0];
  // Aller et retour Ryanair depuis le même aéroport : un seul lien aller-retour.
  if (a?.source === 'ryanair' && b?.source === 'ryanair' && volA && volB && volA.de === volB.vers) {
    const url = lienRyanair(volA.de, volA.vers, volA.depart.slice(0, 10), voyage.adultes, volB.depart.slice(0, 10));
    return [`👉 <a href="${html(url)}">Réserver l'aller-retour sur Ryanair</a>`];
  }
  return option.offres.map((o) => `👉 <a href="${html(o.lien)}">${NOM_SENS[o.sens]} sur ${NOM_SOURCE[o.source]}</a>`);
}

export function blocOption(option: Option): string {
  const lignes: string[] = [];
  for (const offre of option.offres) {
    if (offre.sens === 'aller-retour') {
      lignes.push(...lignesVols('🛫 Aller', offre));
      lignes.push(
        offre.dansHoraires
          ? `🛬 Retour : ${dateHeure(voyage.retour)} après ${enClair(horaires.retourApres)}, vol au choix sur Google Flights (prix aller-retour)`
          : `🛬 Retour : ${dateHeure(voyage.retour)}, heure au choix sur Google Flights (prix aller-retour)`,
      );
    } else {
      lignes.push(...lignesVols(offre.sens === 'aller' ? '🛫 Aller' : '🛬 Retour', offre));
    }
  }

  lignes.push('', `Total pour ${voyage.adultes} : <b>${prix(option.prixParPersonne * voyage.adultes)}</b>`);
  const valise = option.offres.reduce((somme, o) => somme + o.bagagesParPersonne, 0);
  if (valise > 0) lignes.push(`Valise 10 kg Ryanair comprise : ${prix(valise)} par personne`);
  if (option.offres.some((o) => o.source === 'google')) lignes.push('Bagage cabine compris dans le prix Google');

  for (const offre of option.offres) {
    if (offre.prixSoloParPersonne === undefined) continue;
    const economie = offre.prixParPersonne - offre.prixSoloParPersonne;
    lignes.push(
      `⚠️ ${NOM_SENS[offre.sens]} : pour 1 seule personne, ce vol est à ${prix(offre.prixSoloParPersonne)}. ` +
        `Il ne reste sans doute qu'une place à ce prix : deux réservations séparées feraient économiser ${prix(economie)}.`,
    );
  }

  lignes.push('', ...liens(option));
  return lignes.join('\n');
}

const avant = (ancien: number | null, option: Option): string =>
  ancien !== null ? `\nAvant : ${prix(ancien)} (−${prix(ancien - option.prixParPersonne)})` : '';

export function messageDemarrage(choix: Choix): string {
  const lignes = [
    `✅ <b>Veille Lisbonne démarrée</b>`,
    `Je surveille tous les vols, en priorité dans tes horaires (${texteHoraires()}).`,
    '',
    choix.horaires
      ? `<b>🕘 Dans tes horaires : ${prix(choix.horaires.prixParPersonne)} par personne</b>\n\n${blocOption(choix.horaires)}`
      : `<b>🕘 Dans tes horaires :</b> aucun prix complet pour l'instant.`,
  ];
  if (choix.tous && !choix.tous.dansHoraires) {
    lignes.push(
      '',
      '',
      `<b>⏰ Tous horaires confondus : ${prix(choix.tous.prixParPersonne)} par personne</b>\n\n${blocOption(choix.tous)}`,
    );
  }
  return lignes.join('\n');
}

export function messageRecordHoraires(option: Option, ancien: number | null): string {
  return `🎉 <b>Nouveau prix le plus bas dans tes horaires : ${prix(option.prixParPersonne)} par personne</b>${avant(ancien, option)}\n\n${blocOption(option)}`;
}

export function messageRecordHorsHoraires(option: Option, ancien: number | null, dansTesHoraires: Option | null): string {
  const comparaison = dansTesHoraires
    ? `\nDans tes horaires, le meilleur prix est ${prix(dansTesHoraires.prixParPersonne)}, soit ${prix(dansTesHoraires.prixParPersonne - option.prixParPersonne)} de plus.`
    : '';
  return (
    `⏰ <b>Hors de tes horaires : nouveau prix le plus bas, ${prix(option.prixParPersonne)} par personne</b>` +
    `${avant(ancien, option)}${comparaison}\n\n${blocOption(option)}`
  );
}

export function messagePrixBas(avis: AvisGoogle, option: Option | null): string {
  const fourchette = avis.fourchette
    ? `\nPrix habituels : de ${prix(avis.fourchette[0])} à ${prix(avis.fourchette[1])} par personne`
    : '';
  const actuel = option
    ? `\n\nMeilleure option actuelle : ${prix(option.prixParPersonne)} par personne\n\n${blocOption(option)}`
    : '';
  return `📉 <b>Google juge le prix bas pour tes dates</b>${fourchette}${actuel}`;
}

export function messageCible(option: Option, cible: number): string {
  return (
    `🎯 <b>Prix cible atteint dans tes horaires : ${prix(option.prixParPersonne)} par personne</b> (cible : ${prix(cible)})\n` +
    `C'est le moment de réserver.\n\n${blocOption(option)}`
  );
}

export function messagePanne(source: Source, echecs: number, erreur?: string): string {
  const detail = erreur ? `\nDétail : ${html(erreur)}` : '';
  return `🔧 <b>${NOM_SOURCE[source]} ne répond plus</b> (${echecs} échecs d'affilée).\nLa veille continue avec les autres sources.${detail}`;
}

export function messageRetablie(source: Source): string {
  return `✅ <b>${NOM_SOURCE[source]} répond de nouveau.</b> La veille est complète.`;
}

export function messageFin(): string {
  return `🏁 <b>Veille Lisbonne terminée</b>\nLe jour du départ est arrivé, j'arrête la surveillance.\nBon semi-marathon et joyeux anniversaire ! 🎂🏃`;
}
