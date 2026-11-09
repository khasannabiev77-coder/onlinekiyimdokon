// vip.uzb — ma'lumotlar bazasi (Netlify Blobs)
// Store'lar:
//   orders    → "o/<vaqt>_<kod>" : buyurtma JSON,  "c/<kod>" : buyurtma kaliti (indeks)
//   customers → "<telefon raqam>" : mijoz JSON
//   meta      → "admins" : Telegram admin chat ID lari
import { getStore } from '@netlify/blobs';
import { tashkentTime } from './util.mjs';

const store = name => getStore({ name, consistency: 'strong' });

export const ORDER_STATUSES = ['yangi', 'tasdiqlandi', 'yuborildi', 'yetkazildi', 'bekor qilindi'];

function makeCode() {
  const d = new Date();
  const ymd = tashkentTime(d).slice(2, 10).replace(/-/g, '');
  return `VIP-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Buyurtmani bazaga yozadi va mijoz ma'lumotini yangilaydi */
export async function saveOrder(data, items) {
  const orders = store('orders');
  let code = makeCode();
  while (await orders.get(`c/${code}`)) code = makeCode();
  const now = new Date();
  const key = `o/${now.toISOString()}_${code}`;
  const order = { ...data, code, items, status: 'yangi', telegram_sent: false, created_at: tashkentTime(now), created_iso: now.toISOString() };
  await orders.setJSON(key, order);
  await orders.set(`c/${code}`, key);

  const customers = store('customers');
  const phoneKey = data.phone.replace(/\D/g, '');
  const prev = await customers.get(phoneKey, { type: 'json' });
  await customers.setJSON(phoneKey, {
    phone: data.phone, name: data.name, region: data.region, address: data.address,
    orders_count: (prev?.orders_count || 0) + 1,
    total_spent: (prev?.total_spent || 0) + data.total,
    first_order: prev?.first_order || order.created_at,
    last_order: order.created_at,
    order_codes: [...(prev?.order_codes || []), code].slice(-50),
  });
  return order;
}

export async function updateOrder(code, patch) {
  const orders = store('orders');
  const key = await orders.get(`c/${code}`);
  if (!key) return null;
  const o = await orders.get(key, { type: 'json' });
  if (!o) return null;
  Object.assign(o, patch);
  await orders.setJSON(key, o);
  return o;
}

export async function setOrderStatus(code, status) {
  if (!ORDER_STATUSES.includes(status)) return null;
  return updateOrder(code, { status, status_updated_at: tashkentTime() });
}

export async function listOrders({ limit = 50, status = null } = {}) {
  const orders = store('orders');
  const { blobs } = await orders.list({ prefix: 'o/' });
  const keys = blobs.map(b => b.key).sort().reverse();
  const out = [];
  for (const k of keys) {
    const o = await orders.get(k, { type: 'json' });
    if (o && (!status || o.status === status)) out.push(o);
    if (out.length >= limit) break;
  }
  return out;
}

export async function stats() {
  const all = await listOrders({ limit: 100000 });
  const today = tashkentTime().slice(0, 10);
  const valid = all.filter(o => o.status !== 'bekor qilindi');
  const td = valid.filter(o => o.created_at.startsWith(today));
  const { blobs } = await store('customers').list();
  return {
    orders: valid.length,
    revenue: valid.reduce((s, o) => s + o.total, 0),
    today_orders: td.length,
    today_revenue: td.reduce((s, o) => s + o.total, 0),
    new_orders: all.filter(o => o.status === 'yangi').length,
    customers: blobs.length,
  };
}

// ---- Telegram adminlar ----
export async function getAdmins() {
  return (await store('meta').get('admins', { type: 'json' })) || [];
}
export async function addAdmin(chatId, name) {
  const list = await getAdmins();
  if (!list.some(a => a.id === String(chatId))) list.push({ id: String(chatId), name, added_at: tashkentTime() });
  await store('meta').setJSON('admins', list);
}
export async function removeAdmin(chatId) {
  const list = (await getAdmins()).filter(a => a.id !== String(chatId));
  await store('meta').setJSON('admins', list);
}
