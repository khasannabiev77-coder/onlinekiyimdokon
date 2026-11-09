// POST /api/telegram — Telegram webhook (bot buyruqlari va tugmalar)
import { handleUpdate, webhookSecret } from '../lib/telegram.mjs';

export default async req => {
  if (req.method !== 'POST') return new Response('ok');
  if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret()) return new Response('forbidden', { status: 403 });
  try {
    await handleUpdate(await req.json());
  } catch (e) {
    console.error('[telegram]', e.message);
  }
  return new Response('ok'); // Telegram qayta yubormasligi uchun doim 200
};

export const config = { path: '/api/telegram' };
