// Tes horaires préférés : aller avant 12h, retour après 17h (réglables dans config.ts).
import { horaires } from './config.ts';

// "2027-03-05T08:10:00" -> "08:10" (heure locale de l'aéroport)
const heure = (iso: string): string => (iso.split('T')[1] ?? '').slice(0, 5);

export function volDansHoraires(sens: 'aller' | 'retour', depart: string): boolean {
  const h = heure(depart);
  return sens === 'aller' ? h < horaires.allerAvant : h >= horaires.retourApres;
}

// "12:00" -> "11:59"
export function minuteAvant(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const total = h * 60 + m - 1;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// "12:00" -> "12h", "17:30" -> "17h30"
export function enClair(hhmm: string): string {
  const [h = '0', m = '00'] = hhmm.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
}

export const texteHoraires = (): string =>
  `aller avant ${enClair(horaires.allerAvant)}, retour après ${enClair(horaires.retourApres)}`;
