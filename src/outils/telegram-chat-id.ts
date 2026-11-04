// Trouve ton TELEGRAM_CHAT_ID : envoie d'abord « bonjour » à ton bot, puis lance npm run telegram:id
const jeton = process.env.TELEGRAM_BOT_TOKEN;
if (!jeton) {
  console.error('Ajoute TELEGRAM_BOT_TOKEN dans le fichier .env, puis relance.');
  process.exit(1);
}

const reponse = await fetch(`https://api.telegram.org/bot${jeton}/getUpdates`);
const json = (await reponse.json()) as {
  ok: boolean;
  result: { message?: { chat: { id: number; first_name?: string; username?: string } } }[];
};

if (!json.ok) {
  console.error('Telegram refuse ce jeton : vérifie TELEGRAM_BOT_TOKEN.');
  process.exit(1);
}

const conversations = new Map<number, string>();
for (const maj of json.result) {
  if (maj.message) conversations.set(maj.message.chat.id, maj.message.chat.first_name ?? maj.message.chat.username ?? '');
}

if (conversations.size === 0) {
  console.log('Aucun message reçu. Ouvre ton bot dans Telegram, envoie-lui « bonjour », puis relance cette commande.');
} else {
  for (const [id, nom] of conversations) console.log(`TELEGRAM_CHAT_ID=${id}   (${nom})`);
}
