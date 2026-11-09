// vip.uzb — Telegram bot (webhook rejimi)
import { createHash } from 'node:crypto';
import * as db from './db.mjs';
import { env, escHtml as esc, money } from './util.mjs';

const TOKEN = () => env('TELEGRAM_BOT_TOKEN');
const API = m => `https://api.telegram.org/bot${TOKEN()}/${m}`;

/** Webhook so'rovlari haqiqatan Telegramdan kelganini tekshirish uchun maxfiy kalit */
export const webhookSecret = () => createHash('sha256').update('vipuzb:' + TOKEN()).digest('hex').slice(0, 48);

export async function api(method, params = {}) {
  const r = await fetch(API(method), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  const data = await r.json().catch(() => ({ ok: false }));
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || r.status}`);
  return data.result;
}

async function sendPhoto(chatId, jpeg, caption) {
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  fd.append('caption', caption);
  fd.append('parse_mode', 'HTML');
  fd.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'tryon.jpg');
  const r = await fetch(API('sendPhoto'), { method: 'POST', body: fd });
  if (!r.ok) throw new Error('sendPhoto ' + r.status);
}

const extraIds = () => env('TELEGRAM_CHAT_IDS').split(',').map(s => s.trim()).filter(Boolean);
export async function recipients() {
  return [...new Set([...(await db.getAdmins()).map(a => a.id), ...extraIds()])];
}

export const STATUS_LABELS = {
  yangi: '🆕 Yangi', tasdiqlandi: '✅ Tasdiqlandi', yuborildi: '🚚 Yuborildi',
  yetkazildi: '📦 Yetkazildi', 'bekor qilindi': '❌ Bekor qilindi',
};

const keyboard = code => ({
  inline_keyboard: [
    [{ text: '✅ Tasdiqlash', callback_data: `st|${code}|tasdiqlandi` }, { text: '🚚 Yuborildi', callback_data: `st|${code}|yuborildi` }],
    [{ text: '📦 Yetkazildi', callback_data: `st|${code}|yetkazildi` }, { text: '❌ Bekor qilish', callback_data: `st|${code}|bekor qilindi` }],
  ],
});

function orderMessage(o) {
  const L = [
    `🛍 <b>Yangi buyurtma #${esc(o.code)}</b>`,
    `🕒 ${esc(o.created_at)}`,
    '',
    `👤 <b>Mijoz:</b> ${esc(o.name)}`,
    `📞 <b>Telefon:</b> ${esc(o.phone)}`,
    `📍 <b>Manzil:</b> ${esc(o.region)}, ${esc(o.address)}`,
    `🚚 <b>Yetkazish:</b> ${o.delivery === 'pickup' ? "Do'kondan olib ketish" : 'Kuryer'}`,
    `💳 <b>To'lov:</b> ${esc(o.payment)}`,
    '',
    '<b>Mahsulotlar:</b>',
    ...o.items.map((it, i) => `${i + 1}. ${esc(it.name)} — ${esc(it.color)}, <b>${esc(it.size)}</b> × ${it.qty} = ${money(it.line_total)}`),
    '',
    `Mahsulotlar: ${money(o.subtotal)}`,
    `Yetkazib berish: ${o.delivery_fee ? money(o.delivery_fee) : 'Bepul'}`,
    `💰 <b>Jami: ${money(o.total)}</b>`,
  ];
  if (o.comment) L.push('', `💬 <b>Izoh:</b> ${esc(o.comment)}`);
  if (o.has_tryon) L.push('', "📸 Mijoz virtual kiyib ko'rilgan rasmini ham yubordi (pastda).");
  return L.join('\n');
}

/** Yangi buyurtma haqida barcha adminlarga xabar yuboradi */
export async function notifyOrder(order, tryonJpeg) {
  if (!TOKEN()) return false;
  const targets = await recipients();
  if (!targets.length) { console.warn('[bot] Admin yo\'q — botga /start yozing'); return false; }
  const text = orderMessage(order);
  let sent = false;
  await Promise.all(targets.map(async chat => {
    try {
      await api('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', reply_markup: keyboard(order.code) });
      sent = true;
      if (tryonJpeg) await sendPhoto(chat, tryonJpeg, `📸 #${esc(order.code)} — ${esc(order.name)}: virtual kiyib ko'rish`);
    } catch (e) { console.error('[bot]', chat, e.message); }
  }));
  return sent;
}

// ---------- Kiruvchi xabarlar (webhook) ----------
const HELP = `<b>vip.uzb admin bot</b>

/orders — oxirgi 5 ta buyurtma
/new — yangi (ko'rilmagan) buyurtmalar
/stats — savdo statistikasi
/status KOD holat — holatni o'zgartirish
  (holatlar: ${db.ORDER_STATUSES.join(', ')})
/stop — xabarlarni o'chirish`;

const reply = (chat_id, text) => api('sendMessage', { chat_id, text, parse_mode: 'HTML' }).catch(e => console.error(e.message));

async function onMessage(msg) {
  const chatId = String(msg.chat.id);
  const text = (msg.text || '').trim();
  const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || 'admin';
  const admins = await db.getAdmins();
  const isAdmin = admins.some(a => a.id === chatId) || extraIds().includes(chatId);
  const [rawCmd, ...rest] = text.split(/\s+/);
  const cmd = (rawCmd || '').split('@')[0].toLowerCase();
  const arg = rest.join(' ');
  const pass = env('ADMIN_PASSWORD');

  if (cmd === '/start' || cmd === '/login') {
    if (isAdmin) return reply(chatId, '✅ Siz allaqachon adminsiz. Yangi buyurtmalar shu yerga keladi.\n\n' + HELP);
    if (!admins.length && cmd === '/start') {
      await db.addAdmin(chatId, name);
      return reply(chatId, `🎉 Xush kelibsiz, ${esc(name)}!\nSiz <b>vip.uzb</b> do'konining admini bo'ldingiz. Endi barcha buyurtmalar shu chatga keladi.\n\n${HELP}`);
    }
    if (pass && arg === pass) {
      await db.addAdmin(chatId, name);
      return reply(chatId, '✅ Parol to\'g\'ri. Siz admin sifatida qo\'shildingiz.\n\n' + HELP);
    }
    return reply(chatId, "👋 Assalomu alaykum! Bu bot <b>vip.uzb</b> do'koni xodimlari uchun.\nAdmin bo'lish uchun: <code>/login PAROL</code>\n\nXarid qilish uchun saytimizga tashrif buyuring 🛍");
  }
  if (!isAdmin) return reply(chatId, 'Bu buyruq faqat adminlar uchun. <code>/login PAROL</code> yozing.');

  if (cmd === '/stop') { await db.removeAdmin(chatId); return reply(chatId, '🔕 Xabarlar o\'chirildi. Qayta yoqish: <code>/login PAROL</code>'); }
  if (cmd === '/orders' || cmd === '/new') {
    const list = await db.listOrders({ limit: 5, status: cmd === '/new' ? 'yangi' : null });
    if (!list.length) return reply(chatId, 'Hozircha buyurtmalar yo\'q.');
    return reply(chatId, list.map(o => `<b>#${esc(o.code)}</b> · ${STATUS_LABELS[o.status] || o.status}\n${esc(o.name)}, ${esc(o.phone)}\n${o.items.length} ta mahsulot — <b>${money(o.total)}</b>\n<i>${esc(o.created_at)}</i>`).join('\n\n'));
  }
  if (cmd === '/stats') {
    const s = await db.stats();
    return reply(chatId, `📊 <b>Statistika</b>\n\nBugun: ${s.today_orders} ta buyurtma, ${money(s.today_revenue)}\nJami: ${s.orders} ta, ${money(s.revenue)}\nKo'rilmagan: ${s.new_orders} ta\nMijozlar: ${s.customers} ta`);
  }
  if (cmd === '/status') {
    const [code, ...st] = rest;
    const status = st.join(' ').toLowerCase();
    if (code && await db.setOrderStatus(code.toUpperCase(), status)) return reply(chatId, `✅ #${esc(code.toUpperCase())}: ${STATUS_LABELS[status]}`);
    return reply(chatId, `Format: <code>/status VIP-261109-1234 yuborildi</code>\nHolatlar: ${db.ORDER_STATUSES.join(', ')}`);
  }
  return reply(chatId, HELP);
}

async function onCallback(cb) {
  const chatId = String(cb.message?.chat?.id);
  const allowed = (await recipients()).includes(chatId);
  if (!allowed) return api('answerCallbackQuery', { callback_query_id: cb.id, text: 'Ruxsat yo\'q' });
  const [kind, code, status] = (cb.data || '').split('|');
  if (kind !== 'st') return api('answerCallbackQuery', { callback_query_id: cb.id });
  const o = await db.setOrderStatus(code, status);
  const label = STATUS_LABELS[status] || status;
  await api('answerCallbackQuery', { callback_query_id: cb.id, text: o ? `#${code}: ${label}` : 'Buyurtma topilmadi' });
  if (o) await reply(chatId, `#${esc(code)} → ${label} (${esc(cb.from?.first_name || 'admin')})`);
}

export async function handleUpdate(u) {
  if (u.message?.text) return onMessage(u.message);
  if (u.callback_query) return onCallback(u.callback_query);
}
