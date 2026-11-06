// Mission Palerme (PalermoIA) : un passage. Le jour de la bascule, il annonce le changement ;
// ensuite, un rapport par semaine (le lundi à partir de 8h). Un passage qui n'a rien à faire n'écrit RIEN.
import { fenetreDeDepart, PALERME, semaineDeRapport, type MissionPalerme } from '../missions.ts';
import { quotaGoogle } from '../config.ts';
import { messagePanne } from '../alertes.ts';
import { texteErreur } from '../format.ts';
import { envoyerTelegram } from '../telegram.ts';
import { chercherSemaineRyanair, type SemaineRyanair } from '../sources/ryanair.ts';
import { chercherTrajetGoogle, lireQuotaSerpApi, type OffreTrajetGoogle } from '../sources/google.ts';
import { construireRapport, doitFaireRapport, type Rapport } from './rapport.ts';
import { messageBascule, messagePanneRyanair, messageRapport } from './messages.ts';
import { ajouterRapport, DOSSIER_PALERME, ecrireEtatPalerme, lireEtatPalerme, type EtatPalerme } from './stockage.ts';

const ECHECS_AVANT_ALERTE = 3;

export interface DepsPalerme {
  chercherRyanair?: typeof chercherSemaineRyanair;
  chercherGoogle?: typeof chercherTrajetGoogle;
  quota?: () => Promise<number>; // recherches SerpApi restantes (vérification gratuite)
  envoyer?: (texte: string) => Promise<void>;
  dossier?: URL;
  cle?: string; // clé SerpApi
}

export async function passagePalerme(maintenant: Date, deps: DepsPalerme = {}): Promise<void> {
  const m = PALERME;
  const dossier = deps.dossier ?? DOSSIER_PALERME;
  const envoyer = deps.envoyer ?? envoyerTelegram;
  const etat = await lireEtatPalerme(dossier);

  if (etat.basculeAnnonceeLe !== null && !doitFaireRapport(etat.dernierRapport, maintenant)) {
    console.log(`${m.robot} : rapport de la semaine déjà envoyé, rien à faire.`);
    return;
  }

  // 1. La bascule, une seule fois (enregistrée tout de suite, même si le rapport échoue ensuite).
  if (etat.basculeAnnonceeLe === null) {
    try {
      await envoyer(messageBascule(m));
    } catch (e) {
      console.error(`Message de bascule non envoyé : ${texteErreur(e)}`);
      process.exitCode = 1;
      return;
    }
    etat.basculeAnnonceeLe = maintenant.toISOString();
    await ecrireEtatPalerme(etat, dossier);
  }

  // 2. Un rapport de cette semaine déjà construit mais pas parti (Telegram en échec) : renvoyé tel quel,
  // sans nouvelle recherche (au plus 1 recherche SerpApi par rapport).
  const semaineEnCours = semaineDeRapport(maintenant);
  if (etat.rapportEnAttente?.semaine === semaineEnCours) {
    await envoyerRapport(etat.rapportEnAttente, etat, { envoyer, dossier, m });
    return;
  }

  // 3. Ryanair : la semaine la moins chère de la période (gratuit).
  const fenetre = fenetreDeDepart(maintenant, m);
  let semaine: SemaineRyanair | null;
  try {
    semaine = await (deps.chercherRyanair ?? chercherSemaineRyanair)({
      depuis: m.depuisRyanair,
      vers: m.vers,
      debut: fenetre.debut,
      fin: fenetre.fin,
      dureeJours: m.dureeJours,
      adultes: m.adultes,
    });
    etat.echecs.ryanair = 0;
    etat.panneRyanairSignalee = null;
  } catch (e) {
    etat.echecs.ryanair += 1;
    console.error(`Ryanair en échec : ${texteErreur(e)}`);
    // Une alerte par semaine de rapport tant que la panne dure ; comptée seulement si elle est bien partie.
    if (etat.echecs.ryanair >= ECHECS_AVANT_ALERTE && etat.panneRyanairSignalee !== semaineEnCours) {
      try {
        await envoyer(messagePanneRyanair(etat.echecs.ryanair, texteErreur(e)));
        etat.panneRyanairSignalee = semaineEnCours;
      } catch (erreurEnvoi) {
        console.error(`Alerte de panne non envoyée : ${texteErreur(erreurEnvoi)}`);
      }
    }
    await ecrireEtatPalerme(etat, dossier); // pas de rapport : nouvel essai au prochain passage
    return;
  }

  // 4. Google : les mêmes dates chez les autres compagnies (1 recherche, jamais sous la réserve).
  let google: OffreTrajetGoogle | null = null;
  let googleAbsent: string | undefined;
  if (semaine) {
    const cle = deps.cle ?? process.env.SERPAPI_KEY;
    try {
      const restantes = deps.quota ? await deps.quota() : cle ? await lireQuotaSerpApi(cle) : null;
      if (restantes === null || !cle) googleAbsent = 'pas de clé SerpApi';
      else if (restantes <= quotaGoogle.reserve) googleAbsent = 'quota gardé en réserve';
      else {
        google = await (deps.chercherGoogle ?? chercherTrajetGoogle)(
          { depuis: m.depuisGoogle, vers: m.vers, aller: semaine.aller.depart.slice(0, 10), retour: semaine.retour.depart.slice(0, 10), adultes: m.adultes },
          cle,
        );
      }
      etat.echecs.google = 0;
    } catch (e) {
      etat.echecs.google += 1;
      googleAbsent = 'Google n’a pas répondu';
      console.error(`Google Flights en échec : ${texteErreur(e)}`);
      if (etat.echecs.google === ECHECS_AVANT_ALERTE) {
        await envoyer(messagePanne('google', etat.echecs.google, texteErreur(e))).catch(() => {});
      }
    }
  }

  // 5. Le rapport.
  const rapport = construireRapport({ maintenant, mission: m, ryanair: semaine, google, ...(googleAbsent ? { googleAbsent } : {}), precedent: etat.dernierRapport });
  await envoyerRapport(rapport, etat, { envoyer, dossier, m });
}

// Compté comme fait seulement s'il est bien parti ; sinon gardé en attente pour le passage suivant.
async function envoyerRapport(
  rapport: Rapport,
  etat: EtatPalerme,
  o: { envoyer: (texte: string) => Promise<void>; dossier: URL; m: MissionPalerme },
): Promise<void> {
  try {
    await o.envoyer(messageRapport(rapport, o.m));
  } catch (e) {
    console.error(`Rapport non envoyé : ${texteErreur(e)}`);
    etat.rapportEnAttente = rapport;
    await ecrireEtatPalerme(etat, o.dossier);
    process.exitCode = 1;
    return;
  }
  etat.dernierRapport = rapport;
  etat.rapportEnAttente = null;
  await ecrireEtatPalerme(etat, o.dossier);
  await ajouterRapport(rapport, o.dossier);
  console.log(`${o.m.robot} : rapport envoyé (${rapport.meilleurParPersonne ?? '—'} € par personne).`);
}
