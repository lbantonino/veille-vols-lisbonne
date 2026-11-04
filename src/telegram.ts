// Envoi des alertes sur ton téléphone via ton bot Telegram (gratuit).
// Sans jeton ni identifiant de conversation, l'agent tourne en « mode essai » et affiche les messages.
export const telegramConfigure = (): boolean =>
  Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

// `silencieux` : le message arrive sans sonnerie ni vibration (messages de routine).
export async function envoyerTelegram(texte: string, options: { silencieux?: boolean } = {}): Promise<void> {
  const jeton = process.env.TELEGRAM_BOT_TOKEN;
  const conversation = process.env.TELEGRAM_CHAT_ID;

  if (!jeton || !conversation) {
    console.log(`\n[mode essai : pas de Telegram configuré]\n${texte.replace(/<[^>]+>/g, '')}\n`);
    return;
  }

  const reponse = await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: conversation,
      text: texte,
      parse_mode: 'HTML',
      disable_notification: options.silencieux === true,
      link_preview_options: { is_disabled: true },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!reponse.ok) throw new Error(`Telegram a répondu ${reponse.status} : ${await reponse.text()}`);
}
