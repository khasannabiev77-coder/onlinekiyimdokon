// GET /api/admin/orders?status=yangi&limit=50   (sarlavha: X-Admin-Key: ADMIN_PASSWORD)
// GET /api/admin/stats
import * as db from '../lib/db.mjs';
import { isAdminRequest, json } from '../lib/util.mjs';

export default async (req, context) => {
  if (!isAdminRequest(req)) return json(401, { ok: false, error: "Ruxsat yo'q" });
  const q = new URL(req.url).searchParams;
  if (context.params.what === 'stats') return json(200, { ok: true, stats: await db.stats() });
  if (context.params.what === 'orders') {
    const limit = Math.min(+(q.get('limit') || 50), 500);
    return json(200, { ok: true, orders: await db.listOrders({ limit, status: q.get('status') }) });
  }
  return json(404, { ok: false, error: 'Topilmadi' });
};

export const config = { path: '/api/admin/:what' };
