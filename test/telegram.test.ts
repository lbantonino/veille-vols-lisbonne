import { test } from 'node:test';
import assert from 'node:assert/strict';
import { envoyerTelegram } from '../src/telegram.ts';

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
