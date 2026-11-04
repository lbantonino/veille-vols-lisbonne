// Essai unique de Google Flights (consomme 2 recherches sur 250) pour vérifier deux choses :
//  - la clé SerpApi fonctionne ;
//  - le prix renvoyé pour 2 adultes est bien le total du groupe (environ le double du prix pour 1).
import { lireQuotaSerpApi, parametresGoogle, type ReponseGoogle } from '../sources/google.ts';

const cle = process.env.SERPAPI_KEY;
if (!cle) {
  console.error('Ajoute SERPAPI_KEY dans le fichier .env, puis relance.');
  process.exit(1);
}

console.log(`Recherches restantes avant l'essai : ${await lireQuotaSerpApi(cle)}`);

for (const adultes of [1, 2]) {
  const reponse = await fetch(
    `https://serpapi.com/search.json?${parametresGoogle({ sens: 'aller-retour', horaires: false }, adultes, cle)}`,
  );
  const json = (await reponse.json()) as ReponseGoogle;
  console.log(`\n${adultes} adulte(s) :`);
  if (json.error) {
    console.log(`  ${json.error}`);
    continue;
  }
  const resultats = [...(json.best_flights ?? []), ...(json.other_flights ?? [])];
  for (const r of resultats.slice(0, 6)) {
    const vols = r.flights.map((v) => `${v.airline} ${v.flight_number} ${v.departure_airport.id} ${v.departure_airport.time}`);
    console.log(`  ${r.price ?? '?'} €  ${vols.join(' + ')}`);
  }
  console.log(`  Avis Google : ${JSON.stringify(json.price_insights ?? null)}`);
}

console.log(`\nRecherches restantes après l'essai : ${await lireQuotaSerpApi(cle)}`);
console.log('Si les prix à 2 adultes valent environ le double de ceux à 1 adulte, garde prixEstTotalDuGroupe = true.');
