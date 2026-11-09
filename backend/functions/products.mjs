// GET /api/products — mahsulotlar katalogi
import products from '../data/products.mjs';
import { env } from '../lib/util.mjs';

export default async () => new Response(JSON.stringify({
  ok: true,
  products,
  delivery: { freeFrom: +env('FREE_DELIVERY_FROM', '500000'), fee: +env('DELIVERY_FEE', '25000') },
}), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
});

export const config = { path: '/api/products' };
