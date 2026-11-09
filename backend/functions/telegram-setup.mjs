// GET /api/telegram-setup?key=ADMIN_PASSWORD — botni sayt bilan bog'lash (webhook o'rnatish).
// Deploydan keyin bir marta brauzerda oching.
import { api, recipients, webhookSecret } from '../lib/telegram.mjs';
import { env, isAdminRequest, json } from '../lib/util.mjs';

export default async req => {
  if (!env('TELEGRAM_BOT_TOKEN')) return json(500, { ok: false, error: 'Netlify sozlamalarida TELEGRAM_BOT_TOKEN yo\'q' });
  if (!isAdminRequest(req)) return json(401, { ok: false, error: "Ruxsat yo'q: ?key=ADMIN_PASSWORD qo'shing" });
  const url = `${new URL(req.url).origin}/api/telegram`;
  try {
    const me = await api('getMe');
    await api('setWebhook', { url, secret_token: webhookSecret(), allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
    const admins = await recipients();
    return json(200, {
      ok: true,
      bot: '@' + me.username,
      webhook: url,
      admins: admins.length,
      next: admins.length ? 'Tayyor! Buyurtmalar Telegramga keladi.' : `Endi Telegramda @${me.username} ga /start yozing — siz admin bo'lasiz.`,
    });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
};

export const config = { path: '/api/telegram-setup' };
