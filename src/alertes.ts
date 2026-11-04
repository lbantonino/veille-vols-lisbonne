// Textes des messages Telegram (format HTML accepté par Telegram).
import type { AvisGoogle, Offre, Option, Source } from './types.ts';
import { voyage } from './config.ts';
import { dateHeure, html, nomAeroport, prix } from './format.ts';
import { lienRyanair } from './sources/ryanair.ts';

const NOM_SOURCE: Record<Source, string> = { ryanair: 'Ryanair', google: 'Google Flights' };

function lignesVols(titre: string, offre: Offre): string[] {
  return offre.vols.map(
    (v) =>
      `${titre} : ${dateHeure(v.depart)} · ${nomAeroport(v.de)} → ${nomAeroport(v.vers)} · ${html(v.compagnie)} ${html(v.numero)}`,
  );
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
  const nomSens = { 'aller-retour': 'Aller-retour', aller: 'Aller', retour: 'Retour' } as const;
  return option.offres.map((o) => `👉 <a href="${html(o.lien)}">${nomSens[o.sens]} sur ${NOM_SOURCE[o.source]}</a>`);
}

export function blocOption(option: Option): string {
  const lignes: string[] = [];
  for (const offre of option.offres) {
    if (offre.sens === 'aller-retour') {
      lignes.push(...lignesVols('🛫 Aller', offre));
      lignes.push(`🛬 Retour : ${dateHeure(voyage.retour)}, vol au choix sur Google Flights (prix aller-retour)`);
    } else {
      lignes.push(...lignesVols(offre.sens === 'aller' ? '🛫 Aller' : '🛬 Retour', offre));
    }
  }

  lignes.push('', `Total pour ${voyage.adultes} : <b>${prix(option.prixParPersonne * voyage.adultes)}</b>`);
  const valiseEstimee = option.offres.reduce((somme, o) => somme + o.bagagesParPersonne, 0);
  if (valiseEstimee > 0) lignes.push(`Valise 10 kg comprise : ${prix(valiseEstimee)} par personne (estimation Ryanair)`);
  if (option.offres.some((o) => o.source === 'google')) lignes.push('Bagage cabine compris dans le prix Google');

  for (const offre of option.offres) {
    if (offre.prixSoloParPersonne === undefined) continue;
    const economie = offre.prixParPersonne - offre.prixSoloParPersonne;
    lignes.push(
      `⚠️ ${offre.sens === 'retour' ? 'Retour' : 'Aller'} : pour 1 seule personne, ce vol est à ${prix(offre.prixSoloParPersonne)}. ` +
        `Il ne reste sans doute qu'une place à ce prix : deux réservations séparées feraient économiser ${prix(economie)}.`,
    );
  }

  lignes.push('', ...liens(option));
  return lignes.join('\n');
}

export function messageDemarrage(option: Option | null): string {
  if (!option) return `✅ <b>Veille Lisbonne démarrée</b>\nAucun prix trouvé pour l'instant. Je continue à chercher.`;
  return (
    `✅ <b>Veille Lisbonne démarrée</b>\n` +
    `Meilleur prix actuel : <b>${prix(option.prixParPersonne)} par personne</b>, valise comprise.\n` +
    `Je te préviens dès qu'il baisse.\n\n${blocOption(option)}`
  );
}

export function messageRecord(option: Option, ancien: number | null): string {
  const avant = ancien !== null ? `\nAvant : ${prix(ancien)} (−${prix(ancien - option.prixParPersonne)})` : '';
  return `🎉 <b>Nouveau prix le plus bas : ${prix(option.prixParPersonne)} par personne</b>${avant}\n\n${blocOption(option)}`;
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
    `🎯 <b>Prix cible atteint : ${prix(option.prixParPersonne)} par personne</b> (cible : ${prix(cible)})\n` +
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
