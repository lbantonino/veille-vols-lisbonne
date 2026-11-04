import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dansHeuresDeTravail } from '../src/horaires.ts';
import { messageAuTravail } from '../src/alertes.ts';
import { messageDeTravail } from '../src/decisions.ts';
import { envoyerTelegram } from '../src/telegram.ts';
import type { Choix, Option } from '../src/types.ts';

const option = (prixParPersonne: number): Option => ({ prixParPersonne, dansHoraires: true, offres: [] });
const choix: Choix = { horaires: option(212), tous: option(202) };

test('heures de travail : de 8h à 22h, heure de Bruxelles', () => {
  assert.equal(dansHeuresDeTravail(new Date('2026-11-05T06:17:00Z')), false); // 7h17 à Bruxelles
  assert.equal(dansHeuresDeTravail(new Date('2026-11-05T07:17:00Z')), true); // 8h17
  assert.equal(dansHeuresDeTravail(new Date('2026-11-05T20:17:00Z')), true); // 21h17, le dernier
  assert.equal(dansHeuresDeTravail(new Date('2026-11-05T21:17:00Z')), false); // 22h17
  assert.equal(dansHeuresDeTravail(new Date('2026-11-05T02:17:00Z')), false); // 3h17
});

test('message au travail : invite à venir le voir, avec le meilleur prix', () => {
  const texte = messageAuTravail(choix, 'https://lisbonia.vercel.app');
  assert.match(texte, /Je suis à mon bureau/);
  assert.match(texte, /212,00/);
  assert.match(texte, /href="https:\/\/lisbonia\.vercel\.app"/);
  assert.match(messageAuTravail({ horaires: null, tous: null }, 'https://lisbonia.vercel.app'), /pas encore de prix complet/);
});

test('message au travail : seulement en journée, et pas si une alerte part déjà', () => {
  const jour = new Date('2026-11-05T10:17:00Z');
  const nuit = new Date('2026-11-05T23:17:00Z');
  assert.ok(messageDeTravail(jour, [], choix));
  assert.equal(messageDeTravail(nuit, [], choix), null);
  assert.equal(messageDeTravail(jour, ['🎉 Nouveau prix le plus bas…'], choix), null);
});

test('Telegram : un message silencieux ne fait pas vibrer le téléphone', async () => {
  const avant = { fetch: globalThis.fetch, jeton: process.env.TELEGRAM_BOT_TOKEN, chat: process.env.TELEGRAM_CHAT_ID };
  let corps: Record<string, unknown> = {};
  process.env.TELEGRAM_BOT_TOKEN = 'jeton-test';
  process.env.TELEGRAM_CHAT_ID = '42';
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    corps = JSON.parse(String(init?.body));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  try {
    await envoyerTelegram('coucou', { silencieux: true });
    assert.equal(corps.disable_notification, true);
    await envoyerTelegram('alerte');
    assert.equal(corps.disable_notification, false);
  } finally {
    globalThis.fetch = avant.fetch;
    if (avant.jeton === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = avant.jeton;
    if (avant.chat === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = avant.chat;
  }
});
