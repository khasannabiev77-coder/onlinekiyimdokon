// Umumiy yordamchi funksiyalar
export const env = (k, d = '') => process.env[k] ?? d;

export function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const money = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
export const escHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Toshkent vaqti: "2026-11-09 15:30:00" */
export function tashkentTime(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

export function isAdminRequest(req) {
  const pass = env('ADMIN_PASSWORD');
  const key = req.headers.get('x-admin-key') || new URL(req.url).searchParams.get('key');
  return Boolean(pass) && key === pass;
}
