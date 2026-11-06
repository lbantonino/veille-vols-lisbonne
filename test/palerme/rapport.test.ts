import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALERME } from '../../src/missions.ts';
import { avecValise, construireRapport, doitFaireRapport, type Rapport } from '../../src/palerme/rapport.ts';
import { messageBascule, messageRapport } from '../../src/palerme/messages.ts';
import type { SemaineRyanair } from '../../src/sources/ryanair.ts';
import type { OffreTrajetGoogle } from '../../src/sources/google.ts';

const mardi = new Date('2027-03-09T10:00:00Z');
const semaine: SemaineRyanair = {
  aller: { compagnie: 'Ryanair', numero: 'FR6302', de: 'CRL', vers: 'PMO', depart: '2027-05-27T21:40:00' },
  retour: { compagnie: 'Ryanair', numero: 'FR6268', de: 'PMO', vers: 'CRL', depart: '2027-06-03T06:20:00' },
  prixParPersonne: 72,
  lien: 'https://www.ryanair.com/reserver',
};
const googleIta: OffreTrajetGoogle = {
  compagnie: 'ITA',
  vols: [{ compagnie: 'ITA', numero: 'AZ 123', de: 'BRU', vers: 'PMO', depart: '2027-05-27T10:00' }],
  prixParPersonne: 120,
  lien: 'https://www.google.com/travel/flights?semaine',
};

test('valise de 20 kg : ajoutée pour une compagnie connue, sinon signalée « non comprise »', () => {
  assert.deepEqual(avecValise(72.48, 'Ryanair', PALERME), { prixHorsValise: 72.48, prixParPersonne: 152.48, valiseParPersonne: 80 });
  assert.equal(avecValise(150, 'ITA', PALERME).valiseParPersonne, null);
  assert.equal(avecValise(150, 'ITA', PALERME).prixParPersonne, 150);
});

test('rapport : le meilleur prix ignore une offre dont la valise est inconnue, et l’évolution est calculée', () => {
  const precedent = { meilleurParPersonne: 160 } as Rapport;
  const r = construireRapport({ maintenant: mardi, mission: PALERME, ryanair: semaine, google: googleIta, precedent });
  assert.equal(r.semaine, '2027-W10');
  assert.deepEqual(r.fenetre, { debut: '2027-04-08', fin: '2027-06-07' });
  assert.equal(r.ryanair?.prixParPersonne, 152);
  assert.equal(r.google?.valiseParPersonne, null);
  assert.equal(r.meilleurParPersonne, 152); // ITA à 120 € n'a pas sa valise comptée : exclue
  assert.equal(r.evolution, -8);
  assert.equal(construireRapport({ maintenant: mardi, mission: PALERME, ryanair: semaine, google: null, precedent: null }).evolution, null);
});

test('rapport : un seul par semaine, le suivant le lundi à 8h', () => {
  const r = construireRapport({ maintenant: mardi, mission: PALERME, ryanair: semaine, google: null, precedent: null });
  assert.equal(doitFaireRapport(null, mardi), true);
  assert.equal(doitFaireRapport(r, new Date('2027-03-09T15:00:00Z')), false);
  assert.equal(doitFaireRapport(r, new Date('2027-03-15T06:59:00Z')), false);
  assert.equal(doitFaireRapport(r, new Date('2027-03-15T07:30:00Z')), true);
});

test('message du rapport : dates, prix valise comprise, évolution, comparaison Google, liens', () => {
  const precedent = { meilleurParPersonne: 160 } as Rapport;
  const texte = messageRapport(construireRapport({ maintenant: mardi, mission: PALERME, ryanair: semaine, google: googleIta, precedent }), PALERME);
  assert.match(texte, /PalermoIA/);
  assert.match(texte, /jeu\. 27 mai à 21:40/);
  assert.match(texte, /jeu\. 3 juin à 06:20/);
  assert.match(texte, /152,00\s€/);
  assert.match(texte, /valise 20 kg comprise \(estimation\)/);
  assert.match(texte, /−8,00\s€ depuis la semaine dernière/);
  assert.match(texte, /ITA AZ 123/);
  assert.match(texte, /valise non comprise/);
  assert.match(texte, /href="https:\/\/www\.ryanair\.com\/reserver"/);
  assert.match(texte, /href="https:\/\/lisbonia\.vercel\.app"/);
});

test('message du rapport : Google absent ou aucune semaine trouvée', () => {
  const sansGoogle = messageRapport(
    construireRapport({ maintenant: mardi, mission: PALERME, ryanair: semaine, google: null, googleAbsent: 'quota gardé en réserve', precedent: null }),
    PALERME,
  );
  assert.match(sansGoogle, /quota gardé en réserve/);
  assert.match(sansGoogle, /Premier rapport/);
  const rien = messageRapport(construireRapport({ maintenant: mardi, mission: PALERME, ryanair: null, google: null, precedent: null }), PALERME);
  assert.match(rien, /aucune semaine trouvée/i);
  assert.match(rien, /jeu\. 8 avr\..*lun\. 7 juin/);
});

test('message de bascule : nouveau nom et rappels', () => {
  const texte = messageBascule(PALERME);
  assert.match(texte, /LisbonIA devient PalermoIA/);
  assert.match(texte, /31 mars 2027/);
  assert.match(texte, /\/setname/);
  assert.match(texte, /escale-ia\.vercel\.app/);
});
