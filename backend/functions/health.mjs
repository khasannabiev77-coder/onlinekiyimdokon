// GET /api/health — tizim holati
import { recipients } from '../lib/telegram.mjs';
import { env, json } from '../lib/util.mjs';

export default async () => {
  let admins = 0, database = 'ok';
  try { admins = (await recipients()).length; } catch (e) { database = 'xato: ' + e.message; }
  return json(200, { ok: true, telegram_token: Boolean(env('TELEGRAM_BOT_TOKEN')), telegram_admins: admins, database });
};

export const config = { path: '/api/health' };
