// POST /api/orders — yangi buyurtma: tekshiradi → bazaga yozadi → Telegramga yuboradi
import products from '../data/products.mjs';
import * as db from '../lib/db.mjs';
import { notifyOrder } from '../lib/telegram.mjs';
import { clean, env, json } from '../lib/util.mjs';

const byId = new Map(products.map(p => [p.id, p]));
const REGIONS = new Set(['Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro', "Farg'ona", 'Jizzax', 'Xorazm', 'Namangan',
  'Navoiy', 'Qashqadaryo', "Qoraqalpog'iston", 'Samarqand', 'Sirdaryo', 'Surxondaryo']);
const PAYMENTS = new Set(['Naqd pul', 'Click', 'Payme', 'Karta (qabul qilganda)']);
const MAX_TRYON = 3 * 1024 * 1024;

class Invalid extends Error {}

function validate(b) {
  const name = clean(b.name, 80);
  let digits = String(b.phone ?? '').replace(/\D/g, '');
  if (digits.length === 9) digits = '998' + digits;
  const region = clean(b.region, 40);
  const delivery = b.delivery === 'pickup' ? 'pickup' : 'courier';
  const address = clean(b.address, 200);
  const payment = PAYMENTS.has(b.payment) ? b.payment : 'Naqd pul';
  const comment = clean(b.comment, 500);

  if (name.length < 2) throw new Invalid('Ism familiyani kiriting');
  if (!/^998\d{9}$/.test(digits)) throw new Invalid("Telefon raqam noto'g'ri. Masalan: +998 90 123 45 67");
  if (!REGIONS.has(region)) throw new Invalid('Viloyatni tanlang');
  if (delivery === 'courier' && address.length < 5) throw new Invalid("Manzilni to'liqroq kiriting");
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) throw new Invalid("Savat bo'sh");

  const items = b.items.map(it => {
    const p = byId.get(Number(it?.id));
    if (!p) throw new Invalid('Savatdagi mahsulot topilmadi — sahifani yangilang');
    const color = String(it.color ?? ''), size = String(it.size ?? ''), qty = Number(it.qty);
    if (!p.colors.some(c => c.name === color)) throw new Invalid(`${p.name}: rang noto'g'ri`);
    if (!p.sizes.includes(size)) throw new Invalid(`${p.name}: o'lcham noto'g'ri`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new Invalid('Miqdor 1 dan 20 gacha bo\'lishi kerak');
    // Narx faqat serverdagi katalogdan olinadi
    return { id: p.id, name: p.name, color, size, qty, price: p.price, line_total: p.price * qty };
  });

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const freeFrom = +env('FREE_DELIVERY_FROM', '500000');
  const fee = delivery === 'pickup' || subtotal >= freeFrom ? 0 : +env('DELIVERY_FEE', '25000');

  let tryon = null;
  if (typeof b.tryonImage === 'string' && b.tryonImage.startsWith('data:image/jpeg;base64,')) {
    const buf = Buffer.from(b.tryonImage.slice(23), 'base64');
    if (buf.length <= MAX_TRYON && buf[0] === 0xff && buf[1] === 0xd8) tryon = buf;
  }

  const phone = `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  return {
    data: { name, phone, region, address: address || '—', delivery, payment, comment, subtotal, delivery_fee: fee, total: subtotal + fee, has_tryon: !!tryon },
    items, tryon,
  };
}

export default async req => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Faqat POST' });
  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "Noto'g'ri so'rov" }); }
  if (!body || typeof body !== 'object') return json(400, { ok: false, error: "Noto'g'ri so'rov" });

  let v;
  try { v = validate(body); } catch (e) {
    return json(422, { ok: false, error: e instanceof Invalid ? e.message : "Buyurtma ma'lumotlari noto'g'ri" });
  }

  const order = await db.saveOrder(v.data, v.items);
  console.log(`[order] ${order.code} — ${order.name}, ${order.total} so'm`);

  try {
    if (await notifyOrder(order, v.tryon)) await db.updateOrder(order.code, { telegram_sent: true });
  } catch (e) { console.error('[order] telegram:', e.message); }

  return json(201, { ok: true, orderId: order.code, total: order.total });
};

export const config = { path: '/api/orders' };
