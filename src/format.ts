const euros = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });

export const prix = (n: number): string => euros.format(n);

export const arrondi = (n: number): number => Math.round(n * 100) / 100;

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// "2027-03-05T15:35:00" -> "ven. 5 mars à 15:35" (heure locale de l'aéroport, sans conversion)
export function dateHeure(iso: string): string {
  const [date = '', heure = ''] = iso.split('T');
  const [annee = 0, mois = 1, jour = 1] = date.split('-').map(Number);
  const jourSemaine = new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay();
  const texte = `${JOURS[jourSemaine]} ${jour} ${MOIS[mois - 1]}`;
  return heure ? `${texte} à ${heure.slice(0, 5)}` : texte;
}

const AEROPORTS: Record<string, string> = { CRL: 'Charleroi', BRU: 'Zaventem', LIS: 'Lisbonne', PMO: 'Palerme' };

export const nomAeroport = (code: string): string => AEROPORTS[code] ?? code;

// Échappe le texte venant de l'extérieur avant de l'envoyer en HTML à Telegram.
export const html = (texte: string): string =>
  texte.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export const texteErreur = (e: unknown): string => (e instanceof Error ? e.message : String(e));
