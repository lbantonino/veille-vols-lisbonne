// Un passage de l'agent. GitHub le lance toutes les heures (voir .github/workflows/veille.yml).
import { appendFile } from 'node:fs/promises';
import { alertes, fraicheurMaxHeures, quotaGoogle, voyage } from './config.ts';
import { choisir, creneauGoogle, fusionnerOffres, memesVols } from './analyse.ts';
import { decider, optionRecord, type Reglages } from './decisions.ts';
import { messageFin } from './alertes.ts';
import { chercherRyanair } from './sources/ryanair.ts';
import { chercherGoogle, cleRequete, lireQuotaSerpApi, REQUETES_GOOGLE } from './sources/google.ts';
import { ajouterHistorique, ecrireEtat, lireEtat } from './stockage.ts';
import { envoyerTelegram, telegramConfigure } from './telegram.ts';
import { prix, texteErreur } from './format.ts';
import type { AvisGoogle, Offre, ResultatSource } from './types.ts';

const reglages: Reglages = {
  baisseMinimale: alertes.baisseMinimale,
  prixCible: alertes.prixCible,
  echecsAvantAlerte: alertes.echecsAvantAlerte,
};

async function signalerFinAGitHub(): Promise<void> {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'termine=true\n');
}

async function main(): Promise<void> {
  const maintenant = new Date();
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const etat = await lireEtat();

  // Le jour du départ, la veille s'arrête d'elle-même.
  if (aujourdhui >= voyage.aller) {
    if (!etat.termine) {
      await envoyerTelegram(messageFin());
      etat.termine = true;
      await ecrireEtat(etat);
    }
    await signalerFinAGitHub();
    console.log('Voyage commencé : veille terminée.');
    return;
  }

  const nouvelles: Offre[] = [];
  const clesRafraichies: string[] = [];
  const resultats: ResultatSource[] = [];
  let avis: AvisGoogle | null = null;

  // Ryanair : à chaque passage (gratuit, sans quota).
  try {
    nouvelles.push(...(await chercherRyanair(maintenant)));
    clesRafraichies.push('ryanair:aller', 'ryanair:retour');
    resultats.push({ source: 'ryanair', ok: true });
  } catch (e) {
    resultats.push({ source: 'ryanair', ok: false, erreur: texteErreur(e) });
    console.error(`Ryanair en échec : ${texteErreur(e)}`);
  }

  // Google Flights : au plus une recherche par créneau de 4 heures, jamais sous la réserve.
  const cle = process.env.SERPAPI_KEY;
  const creneau = creneauGoogle(maintenant, quotaGoogle.heuresParCreneau);
  if (!cle) {
    console.log('Google Flights ignoré : pas de clé SerpApi.');
  } else if (creneau === etat.google.dernierCreneau) {
    console.log('Google Flights : déjà interrogé dans ce créneau.');
  } else {
    try {
      const restantes = await lireQuotaSerpApi(cle);
      if (restantes <= quotaGoogle.reserve) {
        console.log(`Google Flights en pause : ${restantes} recherches restantes, réserve de ${quotaGoogle.reserve} gardée.`);
      } else {
        const requete = REQUETES_GOOGLE[etat.google.rotation % REQUETES_GOOGLE.length] ?? REQUETES_GOOGLE[0]!;
        const resultat = await chercherGoogle(requete, voyage.adultes, cle, maintenant);
        nouvelles.push(...resultat.offres);
        clesRafraichies.push(cleRequete(requete));
        avis = resultat.avis;
        etat.google.rotation += 1;
        console.log(`Google Flights (${cleRequete(requete)}) : ${resultat.offres.length} offres, ${restantes - 1} recherches restantes.`);
      }
      etat.google.dernierCreneau = creneau;
      resultats.push({ source: 'google', ok: true });
    } catch (e) {
      resultats.push({ source: 'google', ok: false, erreur: texteErreur(e) });
      console.error(`Google Flights en échec : ${texteErreur(e)}`);
    }
  }

  etat.dernieresOffres = fusionnerOffres(etat.dernieresOffres, nouvelles, clesRafraichies, maintenant, fraicheurMaxHeures);
  const choix = choisir(etat.dernieresOffres);

  // Nouveau record venant de Google : une recherche pour 1 personne (au plus une par jour)
  // pour repérer une place seule moins chère.
  const offreGoogle = optionRecord(etat, choix, reglages)?.offres.find((o) => o.source === 'google');
  if (cle && offreGoogle && etat.google.soloLe !== aujourdhui) {
    try {
      if ((await lireQuotaSerpApi(cle)) > quotaGoogle.reserve) {
        const requete = { sens: offreGoogle.sens, horaires: offreGoogle.requete?.endsWith(':horaires') ?? false };
        const solo = await chercherGoogle(requete, 1, cle, maintenant);
        const memeVol = solo.offres.find((o) => memesVols(o, offreGoogle));
        if (memeVol && memeVol.prixParPersonne < offreGoogle.prixParPersonne - 0.01) {
          offreGoogle.prixSoloParPersonne = memeVol.prixParPersonne;
        }
        etat.google.soloLe = aujourdhui;
      }
    } catch (e) {
      console.error(`Vérification pour 1 personne impossible : ${texteErreur(e)}`);
    }
  }

  const { etat: etatApres, messages } = decider(etat, choix, avis, resultats, reglages, maintenant);

  const enTexte = (p: number | undefined) => (p === undefined ? 'aucun' : prix(p));
  console.log(
    `Dans tes horaires : ${enTexte(choix.horaires?.prixParPersonne)} par personne` +
      ` | tous horaires : ${enTexte(choix.tous?.prixParPersonne)}` +
      ` | records : ${enTexte(etatApres.records.horaires?.prixParPersonne)} / ${enTexte(etatApres.records.tous?.prixParPersonne)}.`,
  );

  await ajouterHistorique({
    le: maintenant.toISOString(),
    meilleurDansHoraires: choix.horaires?.prixParPersonne ?? null,
    meilleurTousHoraires: choix.tous?.prixParPersonne ?? null,
    records: {
      horaires: etatApres.records.horaires?.prixParPersonne ?? null,
      tous: etatApres.records.tous?.prixParPersonne ?? null,
    },
    avisGoogle: avis,
    offres: nouvelles.map((o) => ({
      source: o.source,
      sens: o.sens,
      prixParPersonne: o.prixParPersonne,
      dansHoraires: o.dansHoraires,
      ...(o.prixSoloParPersonne !== undefined ? { soloParPersonne: o.prixSoloParPersonne } : {}),
      vols: o.vols.map((v) => `${v.numero} ${v.de}-${v.vers} ${v.depart}`),
    })),
    pannes: resultats.filter((r) => !r.ok).map((r) => r.source),
  });

  try {
    for (const message of messages) await envoyerTelegram(message);
    // En mode essai, rien n'est vraiment envoyé : on ne marque pas les alertes comme parties,
    // pour que tu reçoives bien le message de démarrage une fois Telegram branché.
    await ecrireEtat(telegramConfigure() ? etatApres : etat);
  } catch (e) {
    // Les alertes non envoyées seront recalculées et renvoyées au prochain passage.
    console.error(`Envoi Telegram impossible : ${texteErreur(e)}`);
    await ecrireEtat(etat);
    process.exitCode = 1;
  }
}

await main();
