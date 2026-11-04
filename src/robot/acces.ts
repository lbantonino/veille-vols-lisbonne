// Le code d'accès de la page : choisi par Antonino, rangé dans Vercel (variable CODE_ACCES).
import { createHash, timingSafeEqual } from 'node:crypto';

const LONGUEUR_MINIMALE = 12;

const empreinte = (texte: string): Buffer => createHash('sha256').update(texte, 'utf8').digest();

// Compare en temps constant : la durée ne trahit pas les caractères justes.
export function codeValide(fourni: string | null, attendu: string | undefined): boolean {
  if (!attendu || attendu.length < LONGUEUR_MINIMALE || !fourni) return false;
  return timingSafeEqual(empreinte(fourni), empreinte(attendu));
}

// Attente imposée après des mauvais codes à la suite : 1 s, 2 s, 4 s, puis 8 s au maximum.
export function delaiApresEchecs(echecs: number): number {
  if (echecs <= 0) return 0;
  return Math.min(1000 * 2 ** (echecs - 1), 8000);
}
