import { API_URL } from './config.js';
import {
  garmentSVG, garmentImage, TYPE_META, drawLayer,
  MANNEQUIN_SVG, MANNEQUIN_LM, MANNEQUIN_W, MANNEQUIN_H,
} from './garments.js';

/* ================= Yordamchilar ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const CATS = { tshirt: 'Futbolkalar', shirt: "Ko'ylaklar", hoodie: 'Xudi va sviterlar', jacket: 'Kurtkalar', coat: 'Paltolar', dress: 'Liboslar', pants: 'Shimlar', jeans: 'Jinsilar', skirt: 'Yubkalar' };
const GENDER = { erkak: 'Erkaklar', ayol: 'Ayollar', unisex: 'Uniseks' };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const slotOf = p => TYPE_META[p.type]?.slot || 'top';
/** Mahsulot rasmi: shu rang uchun haqiqiy foto bo'lsa — foto, aks holda chizilgan tasvir */
function productMedia(p, colorName, { eager = false } = {}) {
  const c = p.colors.find(x => x.name === colorName) || p.colors[0];
  const src = p.photos?.[c.name];
  return src
    ? `<img class="photo" src="${esc(src)}" alt="${esc(p.name)} — ${esc(c.name)}" ${eager ? '' : 'loading="lazy"'} decoding="async">`
    : garmentSVG(p.type, c.hex, p.style);
}

const state = {
  products: [],
  byId: new Map(),
  delivery: { freeFrom: 500000, fee: 25000 },
  filters: { q: '', cats: new Set(), gender: 'all', sizes: new Set(), colors: new Set(), min: '', max: '', sale: false, sort: 'popular' },
  cardColor: {},
  cart: store.get('vip_cart', []),
  body: store.get('vip_body', { height: '', weight: '', gender: 'erkak' }),
};

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ================= Modallar ================= */
function openModal(id) {
  $(id).hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal(el) {
  el.hidden = true;
  if (!$$('.modal:not([hidden]), .drawer:not([hidden])').length) document.body.style.overflow = '';
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c) closeModal(c.closest('.modal, .drawer'));
  if (e.target.closest('[data-open-size]')) { e.preventDefault(); openModal('#sizeModal'); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const open = $$('.modal:not([hidden]), .drawer:not([hidden])').pop(); if (open) closeModal(open); }
});

/* ================= O'lcham tavsiyasi ================= */
function recommendIdx() {
  const { height: h, weight: w, gender: g } = state.body;
  if (!h || !w) return null;
  const th = g === 'ayol' ? [48, 55, 63, 72, 83] : [55, 64, 73, 84, 96];
  let idx = th.findIndex(t => w < t);
  if (idx < 0) idx = 5;
  if (h >= (g === 'ayol' ? 175 : 185)) idx += 0.5;
  if (h <= (g === 'ayol' ? 155 : 165)) idx -= 0.5;
  // Rasm asosida yelka kengligi (agar aniqlangan bo'lsa)
  if (T.shoulderCm) {
    const sh = g === 'ayol' ? [36, 38, 40, 43, 46] : [40, 42, 45, 48, 51];
    let si = sh.findIndex(t => T.shoulderCm < t);
    if (si < 0) si = 5;
    idx = (idx * 2 + si) / 3;
  }
  return clamp(Math.round(idx), 0, 5);
}
const recSize = () => { const i = recommendIdx(); return i == null ? null : SIZES[i]; };
function bestSizeFor(p) {
  const r = recommendIdx();
  if (r == null) return p.sizes.includes('M') ? 'M' : p.sizes[Math.floor(p.sizes.length / 2)];
  let best = p.sizes[0], bd = 99;
  for (const s of p.sizes) { const d = Math.abs(SIZES.indexOf(s) - r); if (d < bd) { bd = d; best = s; } }
  return best;
}
function fitInfo(size) {
  const r = recommendIdx();
  if (r == null) return { diff: 0, cls: '', text: "O'lcham tavsiyasi uchun bo'y va vazn kiriting" };
  const diff = SIZES.indexOf(size) - r;
  if (diff === 0) return { diff, cls: 'good', text: "✓ Aynan sizning o'lchamingiz" };
  if (diff < 0) return { diff, cls: 'tight', text: diff === -1 ? 'Biroz tor bo\'ladi' : 'Juda tor — tavsiya etilmaydi' };
  return { diff, cls: 'loose', text: diff === 1 ? 'Biroz erkin bo\'ladi' : 'Juda erkin (oversize)' };
}

/* ================= Katalog ================= */
async function loadProducts() {
  const grid = $('#productGrid');
  grid.innerHTML = Array.from({ length: 8 }, () => '<div class="card" style="height:380px;opacity:.4"></div>').join('');
  try {
    const r = await fetch(`${API_URL}/api/products`);
    const data = await r.json();
    if (!data.ok) throw new Error();
    state.products = data.products;
    state.delivery = data.delivery || state.delivery;
    state.products.forEach(p => state.byId.set(p.id, p));
    state.cart = state.cart.filter(i => state.byId.has(i.id));
    return true;
  } catch {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-ic">⚠️</div><h3>Server bilan aloqa yo'q</h3>
      <p>Backend ishlayotganiga ishonch hosil qiling: <code>${esc(API_URL)}</code></p>
      <button class="btn btn-primary btn-sm" onclick="location.reload()">Qayta urinish</button></div>`;
    return false;
  }
}

function buildFilters() {
  const counts = {};
  state.products.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
  $('#catFilters').innerHTML = Object.entries(CATS).filter(([k]) => counts[k]).map(([k, v]) =>
    `<label><input type="checkbox" value="${k}"> ${v}<span class="n">${counts[k]}</span></label>`).join('');
  $('#sizeFilters').innerHTML = SIZES.map(s => `<button class="chip" data-s="${s}">${s}</button>`).join('');
  const colors = new Map();
  state.products.forEach(p => p.colors.forEach(c => { if (!colors.has(c.name)) colors.set(c.name, c.hex); }));
  $('#colorFilters').innerHTML = [...colors].map(([n, h]) => `<button class="cdot" style="background:${h}" data-c="${esc(n)}" title="${esc(n)}" aria-label="${esc(n)}"></button>`).join('');

  const colorFor = { tshirt: '#d4af37', shirt: '#f4efe2', hoodie: '#1d7a55', jacket: '#1f4d3a', coat: '#c19a6b', dress: '#8b0035', pants: '#3d4b5c', jeans: '#2d4a7a', skirt: '#f4a261' };
  $('#catStrip').innerHTML = `<button class="cat-pill active" data-cat="">${garmentSVG('tshirt', '#f1d78a')}Barchasi</button>` +
    Object.entries(CATS).filter(([k]) => counts[k]).map(([k, v]) =>
      `<button class="cat-pill" data-cat="${k}">${garmentSVG(k, colorFor[k], k === 'dress' ? 'ikat' : '')}${v}</button>`).join('');
}

function filtered() {
  const f = state.filters;
  const q = f.q.trim().toLowerCase();
  let list = state.products.filter(p => {
    if (q && !(`${p.name} ${CATS[p.type]} ${GENDER[p.gender]} ${p.colors.map(c => c.name).join(' ')} ${p.material}`).toLowerCase().includes(q)) return false;
    if (f.cats.size && !f.cats.has(p.type)) return false;
    if (f.gender !== 'all' && p.gender !== f.gender && !(p.gender === 'unisex' && f.gender !== 'unisex')) return false;
    if (f.sizes.size && !p.sizes.some(s => f.sizes.has(s))) return false;
    if (f.colors.size && !p.colors.some(c => f.colors.has(c.name))) return false;
    if (f.min !== '' && p.price < +f.min) return false;
    if (f.max !== '' && p.price > +f.max) return false;
    if (f.sale && !p.oldPrice) return false;
    return true;
  });
  const disc = p => p.oldPrice ? 1 - p.price / p.oldPrice : 0;
  const sorters = {
    popular: (a, b) => b.reviews - a.reviews,
    new: (a, b) => (b.badge === 'Yangi') - (a.badge === 'Yangi') || b.id - a.id,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    discount: (a, b) => disc(b) - disc(a),
  };
  return list.sort(sorters[f.sort]);
}

function cardHTML(p, i) {
  const ci = state.cardColor[p.id] || 0;
  const c = p.colors[ci];
  const badgeCls = (p.badge || '').toLowerCase();
  return `<article class="card" data-id="${p.id}" style="animation-delay:${Math.min(i, 12) * 40}ms">
    <div class="card-media" style="--c:${c.hex}" data-open>
      ${p.badge ? `<span class="badge ${esc(badgeCls)}">${esc(p.badge)}</span>` : ''}
      <div class="media-el">${productMedia(p, c.name)}</div>
      <button class="quick-try" data-try>✨ Rasmimda kiyib ko'rish</button>
    </div>
    <div class="card-body">
      <div class="card-cat">${CATS[p.type]} · ${GENDER[p.gender]}</div>
      <h3 data-open>${esc(p.name)}</h3>
      <div class="rating"><b>★ ${p.rating.toFixed(1)}</b> (${p.reviews} sharh)</div>
      <div class="swatches">${p.colors.map((x, j) => `<button class="sw ${j === ci ? 'active' : ''}" style="background:${x.hex}" data-ci="${j}" title="${esc(x.name)}" aria-label="${esc(x.name)}"></button>`).join('')}</div>
      <div class="price-row">
        <span class="price">${fmt(p.price)}</span>${p.oldPrice ? `<s class="old">${fmt(p.oldPrice)}</s>` : ''}
        <button class="add-btn" data-add aria-label="Savatga qo'shish">+</button>
      </div>
    </div></article>`;
}

function renderCatalog() {
  const list = filtered();
  $('#productGrid').innerHTML = list.map(cardHTML).join('');
  $('#emptyState').hidden = list.length > 0;
  $('#resultCount').textContent = `${list.length} ta mahsulot`;
  const f = state.filters, chips = [];
  if (f.q) chips.push(['q', `“${f.q}”`]);
  if (f.gender !== 'all') chips.push(['gender', GENDER[f.gender]]);
  f.cats.forEach(c => chips.push(['cat:' + c, CATS[c]]));
  f.sizes.forEach(s => chips.push(['size:' + s, s]));
  f.colors.forEach(c => chips.push(['color:' + c, c]));
  if (f.min !== '' || f.max !== '') chips.push(['price', `${f.min || 0} – ${f.max || '∞'}`]);
  if (f.sale) chips.push(['sale', 'Chegirma']);
  $('#activeFilters').innerHTML = chips.map(([k, l]) => `<span class="af">${esc(l)}<button data-rm="${esc(k)}" aria-label="Olib tashlash">✕</button></span>`).join('');
  $$('.cat-pill').forEach(b => b.classList.toggle('active', b.dataset.cat ? f.cats.size === 1 && f.cats.has(b.dataset.cat) : f.cats.size === 0));
}

function syncFilterUI() {
  const f = state.filters;
  $$('#genderChips .chip').forEach(b => b.classList.toggle('active', b.dataset.g === f.gender));
  $$('#catFilters input').forEach(i => { i.checked = f.cats.has(i.value); });
  $$('#sizeFilters .chip').forEach(b => b.classList.toggle('active', f.sizes.has(b.dataset.s)));
  $$('#colorFilters .cdot').forEach(b => b.classList.toggle('active', f.colors.has(b.dataset.c)));
  $('#priceMin').value = f.min; $('#priceMax').value = f.max;
  $('#onlySale').checked = f.sale;
  $('#searchInput').value = f.q;
}
function resetFilters() {
  Object.assign(state.filters, { q: '', gender: 'all', min: '', max: '', sale: false });
  state.filters.cats.clear(); state.filters.sizes.clear(); state.filters.colors.clear();
  syncFilterUI(); renderCatalog();
}

function bindCatalog() {
  let qTimer;
  $('#searchInput').addEventListener('input', e => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      state.filters.q = e.target.value;
      renderCatalog();
      if (e.target.value && window.scrollY < $('#catalog').offsetTop - 200) $('#catalog').scrollIntoView({ behavior: 'smooth' });
    }, 200);
  });
  $('#sortSelect').addEventListener('change', e => { state.filters.sort = e.target.value; renderCatalog(); });
  $('#genderChips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; state.filters.gender = b.dataset.g; syncFilterUI(); renderCatalog(); });
  $('#catFilters').addEventListener('change', e => { const s = state.filters.cats; e.target.checked ? s.add(e.target.value) : s.delete(e.target.value); renderCatalog(); });
  $('#sizeFilters').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; const s = state.filters.sizes; s.has(b.dataset.s) ? s.delete(b.dataset.s) : s.add(b.dataset.s); syncFilterUI(); renderCatalog(); });
  $('#colorFilters').addEventListener('click', e => { const b = e.target.closest('.cdot'); if (!b) return; const s = state.filters.colors; s.has(b.dataset.c) ? s.delete(b.dataset.c) : s.add(b.dataset.c); syncFilterUI(); renderCatalog(); });
  $('#priceMin').addEventListener('input', e => { state.filters.min = e.target.value; renderCatalog(); });
  $('#priceMax').addEventListener('input', e => { state.filters.max = e.target.value; renderCatalog(); });
  $('#onlySale').addEventListener('change', e => { state.filters.sale = e.target.checked; renderCatalog(); });
  $('#resetFilters').addEventListener('click', resetFilters);
  $('#emptyReset').addEventListener('click', resetFilters);
  // Mobil: filtrlar pastdan chiqadigan oyna
  const sheet = open => {
    $('#filters').classList.toggle('open', open);
    $('#filtersBackdrop').classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    document.body.classList.toggle('sheet-open', open);
  };
  $('#filterToggle').addEventListener('click', () => sheet(true));
  $('#bnFilters').addEventListener('click', () => { $('#catalog').scrollIntoView({ behavior: 'smooth' }); sheet(true); });
  $('#filtersClose').addEventListener('click', () => sheet(false));
  $('#filtersBackdrop').addEventListener('click', () => sheet(false));
  $('#filtersApply').addEventListener('click', () => { sheet(false); $('#catalog').scrollIntoView({ behavior: 'smooth' }); });
  $('#activeFilters').addEventListener('click', e => {
    const k = e.target.closest('[data-rm]')?.dataset.rm; if (!k) return;
    const f = state.filters;
    if (k === 'q') f.q = ''; else if (k === 'gender') f.gender = 'all'; else if (k === 'price') { f.min = ''; f.max = ''; }
    else if (k === 'sale') f.sale = false;
    else { const [t, v] = k.split(/:(.*)/); ({ cat: f.cats, size: f.sizes, color: f.colors })[t].delete(v); }
    syncFilterUI(); renderCatalog();
  });
  $('#catStrip').addEventListener('click', e => {
    const b = e.target.closest('.cat-pill'); if (!b) return;
    state.filters.cats.clear(); if (b.dataset.cat) state.filters.cats.add(b.dataset.cat);
    syncFilterUI(); renderCatalog();
    $('#catalog').scrollIntoView({ behavior: 'smooth' });
  });
  $$('[data-nav-gender]').forEach(a => a.addEventListener('click', () => { resetFilters(); state.filters.gender = a.dataset.navGender; syncFilterUI(); renderCatalog(); }));
  $$('[data-nav-flag]').forEach(a => a.addEventListener('click', () => { resetFilters(); state.filters.sale = true; syncFilterUI(); renderCatalog(); }));

  $('#productGrid').addEventListener('click', e => {
    const card = e.target.closest('.card'); if (!card) return;
    const p = state.byId.get(+card.dataset.id);
    const sw = e.target.closest('.sw');
    if (sw) {
      state.cardColor[p.id] = +sw.dataset.ci;
      const c = p.colors[+sw.dataset.ci];
      const media = $('.card-media', card);
      media.style.setProperty('--c', c.hex);
      $('.media-el', media).innerHTML = productMedia(p, c.name);
      $$('.sw', card).forEach((x, j) => x.classList.toggle('active', j === +sw.dataset.ci));
      return;
    }
    if (e.target.closest('[data-try]')) { e.stopPropagation(); tryProduct(p, p.colors[state.cardColor[p.id] || 0].name); return; }
    if (e.target.closest('[data-add]') || e.target.closest('[data-open]')) openProduct(p, state.cardColor[p.id] || 0);
  });
}

/* ================= Mahsulot oynasi ================= */
const pm = { p: null, ci: 0, size: null, qty: 1 };
function openProduct(p, ci = 0) {
  Object.assign(pm, { p, ci, size: recSize() && p.sizes.includes(bestSizeFor(p)) && recommendIdx() != null ? bestSizeFor(p) : null, qty: 1 });
  $('#pmCat').textContent = `${CATS[p.type]} · ${GENDER[p.gender]}`;
  $('#pmName').textContent = p.name;
  $('#pmRating').innerHTML = `<b>★ ${p.rating.toFixed(1)}</b> · ${p.reviews} ta sharh`;
  $('#pmPrice').innerHTML = `<span class="price">${fmt(p.price)}</span>${p.oldPrice ? `<s class="old">${fmt(p.oldPrice)}</s>` : ''}`;
  $('#pmDesc').textContent = p.desc || '';
  $('#pmMaterial').textContent = p.material || '';
  renderPM();
  openModal('#productModal');
}
function renderPM() {
  const { p, ci, size, qty } = pm;
  const c = p.colors[ci];
  $('#pmMedia').style.setProperty('--c', c.hex);
  $('#pmMedia').innerHTML = productMedia(p, c.name, { eager: true });
  $('#pmMedia').classList.toggle('has-photo', !!p.photos?.[c.name]);
  $('#pmColorName').textContent = c.name;
  $('#pmColors').innerHTML = p.colors.map((x, j) => `<button class="sw ${j === ci ? 'active' : ''}" style="background:${x.hex}" data-ci="${j}" title="${esc(x.name)}" aria-label="${esc(x.name)}"></button>`).join('');
  const r = recSize();
  $('#pmSizes').innerHTML = p.sizes.map(s => `<button class="sz ${s === size ? 'active' : ''} ${s === r ? 'rec-mark' : ''}" data-s="${s}">${s}</button>`).join('');
  const rec = $('#pmRec');
  if (r) {
    const fi = size ? fitInfo(size) : null;
    rec.className = 'pm-rec' + (fi && fi.cls !== 'good' ? ' warn' : '');
    rec.textContent = fi ? fi.text : `★ Sizga tavsiya etilgan o'lcham: ${r}`;
  } else {
    rec.className = 'pm-rec warn';
    rec.innerHTML = `O'lchamingizni bilmaysizmi? <a href="#studio" class="link" data-close>Bo'y va vazningizni kiriting</a>`;
  }
  $('#pmQty').textContent = qty;
}
$('#pmColors').addEventListener('click', e => { const b = e.target.closest('.sw'); if (b) { pm.ci = +b.dataset.ci; renderPM(); } });
$('#pmSizes').addEventListener('click', e => { const b = e.target.closest('.sz'); if (b) { pm.size = b.dataset.s; renderPM(); } });
$('#pmMinus').addEventListener('click', () => { pm.qty = Math.max(1, pm.qty - 1); renderPM(); });
$('#pmPlus').addEventListener('click', () => { pm.qty = Math.min(20, pm.qty + 1); renderPM(); });
$('#pmAdd').addEventListener('click', () => {
  if (!pm.size) {
    const s = $('#pmSizes'); s.classList.remove('pm-shake'); void s.offsetWidth; s.classList.add('pm-shake');
    toast("Iltimos, o'lchamni tanlang");
    return;
  }
  addToCart(pm.p.id, pm.p.colors[pm.ci].name, pm.size, pm.qty);
  closeModal($('#productModal'));
});
$('#pmTry').addEventListener('click', () => {
  closeModal($('#productModal'));
  tryProduct(pm.p, pm.p.colors[pm.ci].name, pm.size);
});

/* ================= Savat ================= */
const cartKey = (id, color, size) => `${id}|${color}|${size}`;
function saveCart() { store.set('vip_cart', state.cart); renderCartCount(); }
function renderCartCount() {
  const n = state.cart.reduce((s, i) => s + i.qty, 0);
  const el = $('#cartCount');
  el.textContent = n;
  const bn = $('#bnCount');
  bn.textContent = n; bn.dataset.n = n;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
function addToCart(id, color, size, qty = 1, silent = false) {
  const k = cartKey(id, color, size);
  const ex = state.cart.find(i => i.key === k);
  if (ex) ex.qty = Math.min(20, ex.qty + qty);
  else state.cart.push({ key: k, id, color, size, qty });
  saveCart();
  if (!silent) toast(`🛍 ${state.byId.get(id).name} (${size}) savatga qo'shildi`);
}
function totals() {
  const sub = state.cart.reduce((s, i) => s + state.byId.get(i.id).price * i.qty, 0);
  const pickup = $('#checkoutForm [name=delivery]')?.value === 'pickup';
  const fee = !sub || pickup || sub >= state.delivery.freeFrom ? 0 : state.delivery.fee;
  return { sub, fee, total: sub + fee };
}
function colorHex(p, name) { return (p.colors.find(c => c.name === name) || p.colors[0]).hex; }
function renderCart() {
  const box = $('#cartItems');
  if (!state.cart.length) {
    box.innerHTML = `<div class="cart-empty"><div>🛍</div><p>Savatingiz hozircha bo'sh</p><a href="#catalog" class="btn btn-primary btn-sm" data-close>Xaridni boshlash</a></div>`;
    $('#cartFoot').hidden = true;
    return;
  }
  $('#cartFoot').hidden = false;
  box.innerHTML = state.cart.map(i => {
    const p = state.byId.get(i.id);
    return `<div class="ci" data-k="${esc(i.key)}">
      <div class="ci-thumb">${productMedia(p, i.color)}</div>
      <div class="ci-info"><b>${esc(p.name)}</b><span>${esc(i.color)} · O'lcham: ${i.size}</span><span>${fmt(p.price)}</span></div>
      <div class="ci-right"><button class="ci-del" data-del>O'chirish</button>
        <div class="qty"><button data-q="-1" aria-label="Kamaytirish">−</button><span>${i.qty}</span><button data-q="1" aria-label="Ko'paytirish">+</button></div></div>
    </div>`;
  }).join('');
  const t = totals();
  $('#cartSubtotal').textContent = fmt(t.sub);
  $('#cartDelivery').textContent = t.fee ? fmt(t.fee) : 'Bepul';
  $('#cartTotal').textContent = fmt(t.total);
  const left = state.delivery.freeFrom - t.sub;
  $('#freeShip').innerHTML = left > 0
    ? `Bepul yetkazib berishgacha yana <b>${fmt(left)}</b><div class="bar"><i style="width:${(t.sub / state.delivery.freeFrom) * 100}%"></i></div>`
    : `🎉 Sizga <b>bepul yetkazib berish</b>!<div class="bar"><i style="width:100%"></i></div>`;
}
$('#cartBtn').addEventListener('click', () => { renderCart(); openModal('#cartDrawer'); });
$('#bnCart').addEventListener('click', () => { renderCart(); openModal('#cartDrawer'); });
$('#cartItems').addEventListener('click', e => {
  const row = e.target.closest('.ci'); if (!row) return;
  const i = state.cart.findIndex(x => x.key === row.dataset.k);
  if (e.target.closest('[data-del]')) state.cart.splice(i, 1);
  const q = e.target.closest('[data-q]');
  if (q) { state.cart[i].qty += +q.dataset.q; if (state.cart[i].qty < 1) state.cart.splice(i, 1); else state.cart[i].qty = Math.min(20, state.cart[i].qty); }
  saveCart(); renderCart();
});

/* ================= Buyurtma ================= */
function renderSummary() {
  const t = totals();
  $('#coSummary').innerHTML = state.cart.map(i => {
    const p = state.byId.get(i.id);
    return `<div class="sum-row"><span>${esc(p.name)} · ${esc(i.color)}, ${i.size} × ${i.qty}</span><b>${fmt(p.price * i.qty)}</b></div>`;
  }).join('') + `<div class="sum-row"><span>Yetkazib berish</span><b>${t.fee ? fmt(t.fee) : 'Bepul'}</b></div>
    <div class="sum-row total"><span>Jami</span><b>${fmt(t.total)}</b></div>`;
}
$('#checkoutBtn').addEventListener('click', () => {
  if (!state.cart.length) return;
  closeModal($('#cartDrawer'));
  $('#checkoutForm').hidden = false;
  $('#successView').hidden = true;
  $('#formError').hidden = true;
  $('#attachTryWrap').hidden = !(T.img && !T.isMannequin && Object.keys(T.layers).length);
  renderSummary();
  openModal('#checkoutModal');
});
$('#checkoutForm [name=delivery]').addEventListener('change', renderSummary);
$('#checkoutForm [name=phone]').addEventListener('input', e => {
  let d = e.target.value.replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  e.target.value = '+998' + (parts.length ? ' ' + parts.join(' ') : '');
});
$('#checkoutForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const fd = Object.fromEntries(new FormData(form));
  const err = $('#formError');
  $$('.invalid', form).forEach(x => x.classList.remove('invalid'));
  const bad = [];
  if ((fd.name || '').trim().length < 2) bad.push('name');
  if ((fd.phone || '').replace(/\D/g, '').length !== 12) bad.push('phone');
  if (fd.delivery === 'courier' && (fd.address || '').trim().length < 5) bad.push('address');
  if (bad.length) {
    bad.forEach(n => form.elements[n].classList.add('invalid'));
    err.textContent = "Iltimos, belgilangan maydonlarni to'g'ri to'ldiring";
    err.hidden = false;
    return;
  }
  const payload = {
    name: fd.name, phone: fd.phone, region: fd.region, address: fd.address, delivery: fd.delivery,
    payment: fd.payment, comment: fd.comment,
    items: state.cart.map(({ id, color, size, qty }) => ({ id, color, size, qty })),
  };
  if (fd.attachTryon && T.img) payload.tryonImage = exportTryon(1024, 0.85);
  const btn = $('#coSubmit');
  btn.disabled = true; btn.textContent = 'Yuborilmoqda…'; err.hidden = true;
  try {
    const r = await fetch(`${API_URL}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || 'Buyurtmani yuborib bo\'lmadi');
    state.cart = []; saveCart();
    form.reset();
    $('#successId').textContent = '#' + data.orderId;
    form.hidden = true;
    $('#successView').hidden = false;
  } catch (ex) {
    err.textContent = ex.message === 'Failed to fetch' ? "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring." : ex.message;
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'Buyurtmani tasdiqlash';
  }
});

/* ================= Virtual kiyib ko'rish ================= */
const T = {
  img: null, W: 0, H: 0, lm: null, isMannequin: false, shoulderCm: null,
  layers: {},          // { top: {pid, color, size, adj, img}, bottom: {...} }
  active: null,
  pickerTab: 'top',
};
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
let poseP = null;
function getPose() {
  if (!poseP) {
    poseP = (async () => {
      const v = await import(`${CDN}/vision_bundle.mjs`);
      const files = await v.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const opts = d => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: 'IMAGE', numPoses: 1 });
      try { return await v.PoseLandmarker.createFromOptions(files, opts('GPU')); }
      catch { return await v.PoseLandmarker.createFromOptions(files, opts('CPU')); }
    })();
    poseP.catch(() => { poseP = null; });
  }
  return poseP;
}

const cv = $('#stageCanvas');
const ctx = cv.getContext('2d');

function setStatus(html) { $('#stageStatus').innerHTML = html; }
function loading(on, text) { $('#stageLoading').hidden = !on; if (text) $('#stageLoadingText').textContent = text; }

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function useMannequin() {
  const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(MANNEQUIN_SVG));
  Object.assign(T, { img, W: MANNEQUIN_W, H: MANNEQUIN_H, lm: MANNEQUIN_LM, isMannequin: true, shoulderCm: null });
  showStage();
  setStatus(`<span class="ok">Maneken tayyor.</span> O'z rasmingizda ko'rish uchun <b>“Boshqa rasm”</b> tugmasini bosing.`);
  if (!Object.keys(T.layers).length) {
    const p = state.byId.get(7) || state.products[0];
    if (p) await setLayer(p, p.colors[0].name);
  }
  renderStage(); renderRec();
}

async function handlePhoto(file) {
  if (!file || !file.type.startsWith('image/')) { toast('Iltimos, rasm faylini tanlang'); return; }
  if (file.size > 25 * 1024 * 1024) { toast('Rasm juda katta (25 MB dan kichik bo\'lsin)'); return; }
  const url = URL.createObjectURL(file);
  let img;
  try { img = await loadImage(url); } catch { toast("Rasmni o'qib bo'lmadi"); return; } finally { URL.revokeObjectURL(url); }
  // Katta rasmlarni kichraytiramiz (tezlik uchun)
  const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
  const base = document.createElement('canvas');
  base.width = Math.round(img.naturalWidth * k); base.height = Math.round(img.naturalHeight * k);
  base.getContext('2d').drawImage(img, 0, 0, base.width, base.height);
  Object.assign(T, { img: base, W: base.width, H: base.height, lm: null, isMannequin: false, shoulderCm: null });
  showStage(); renderStage();
  loading(true, "AI tana nuqtalarini aniqlamoqda…");
  try {
    const pose = await getPose();
    const res = pose.detect(base);
    const l = res.landmarks?.[0];
    if (!l) throw new Error('no-pose');
    T.lm = l.map(p => ({ x: p.x * T.W, y: p.y * T.H, v: p.visibility ?? 1 }));
    estimateShoulder();
    const full = T.lm[27].v > 0.5 && T.lm[28].v > 0.5;
    setStatus(`<span class="ok">✓ Tana aniqlandi.</span> ${full ? "To'liq bo'y ko'rinmoqda — shim va libos ham aniq joylashadi." : "Faqat yuqori qism ko'rinmoqda — shim uchun to'liq bo'yli rasm yuklang."}`);
  } catch (e) {
    T.lm = null;
    setStatus(`<span class="warn">⚠ Tana avtomatik aniqlanmadi${e?.message === 'no-pose' ? '' : " (AI modelni yuklab bo'lmadi)"}.</span> Kiyimni qo'lda surib, “Aniq sozlash” orqali joylashtiring.`);
  } finally {
    loading(false);
  }
  if (!Object.keys(T.layers).length) {
    const p = state.byId.get(7) || state.products[0];
    if (p) await setLayer(p, p.colors[0].name);
  }
  Object.values(T.layers).forEach(L => { L.adj = { dx: 0, dy: 0, s: 1, r: 0 }; });
  syncAdjust(); renderLayers(); renderRec(); renderStage();
}

function estimateShoulder() {
  const lm = T.lm, h = +state.body.height;
  T.shoulderCm = null;
  if (!lm || !h || lm[27].v < 0.5 || lm[28].v < 0.5 || lm[0].v < 0.5) return;
  const ankleY = (lm[27].y + lm[28].y) / 2;
  const heightPx = (ankleY - lm[0].y) / 0.88;
  if (heightPx <= 0) return;
  const shoulderPx = Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y);
  T.shoulderCm = Math.round(shoulderPx / (heightPx / h) * 1.18);
}

function showStage() {
  $('#stageEmpty').hidden = true;
  $('#stageActions').hidden = false;
  $('#stageHint').hidden = false;
}

function layerList() {
  return ['bottom', 'top'].map(k => T.layers[k]).filter(Boolean);
}

function renderStage() {
  if (!T.img) return;
  if (cv.width !== T.W || cv.height !== T.H) { cv.width = T.W; cv.height = T.H; }
  ctx.clearRect(0, 0, T.W, T.H);
  ctx.drawImage(T.img, 0, 0, T.W, T.H);
  for (const L of layerList()) {
    if (!L.img) continue;
    const p = state.byId.get(L.pid);
    const fi = fitInfo(L.size);
    const d = clamp(fi.diff, -2, 3);
    drawLayer(ctx, { img: L.img, slot: slotOf(p), fitW: 1 + d * 0.07, fitH: 1 + d * 0.025, adj: L.adj }, T.lm, T.W, T.H);
  }
}

async function setLayer(p, colorName, size) {
  const slot = slotOf(p);
  const key = slot === 'bottom' ? 'bottom' : 'top';
  if (slot === 'full') delete T.layers.bottom;
  if (slot === 'bottom' && T.layers.top && slotOf(state.byId.get(T.layers.top.pid)) === 'full') delete T.layers.top;
  const L = { pid: p.id, color: colorName || p.colors[0].name, size: size || bestSizeFor(p), adj: { dx: 0, dy: 0, s: 1, r: 0 }, img: null };
  T.layers[key] = L;
  T.active = key;
  L.img = await garmentImage(p.type, colorHex(p, L.color), p.style);
  renderLayers(); renderPicker(); syncAdjust(); renderStage();
}

async function tryProduct(p, colorName, size) {
  $('#studio').scrollIntoView({ behavior: 'smooth' });
  if (!T.img) await useMannequin();
  await setLayer(p, colorName, size);
  toast(`✨ ${p.name} kiyib ko'rilmoqda`);
}

function renderPicker() {
  const tab = T.pickerTab;
  const list = state.products.filter(p => (tab === 'bottom') === (slotOf(p) === 'bottom'));
  const on = new Set(Object.values(T.layers).map(l => l.pid));
  $('#picker').innerHTML = list.map(p => `<button class="pick ${on.has(p.id) ? 'on' : ''}" data-id="${p.id}" title="${esc(p.name)} — ${fmt(p.price)}">${garmentSVG(p.type, p.colors[0].hex, p.style)}</button>`).join('');
}

function renderLayers() {
  const box = $('#layers');
  const entries = Object.entries(T.layers);
  if (!entries.length) { box.innerHTML = '<p class="muted">Hali kiyim tanlanmadi</p>'; $('#outfitTotal').hidden = true; return; }
  const r = recSize();
  box.innerHTML = entries.map(([k, L]) => {
    const p = state.byId.get(L.pid);
    const fi = fitInfo(L.size);
    return `<div class="layer ${T.active === k ? 'active' : ''}" data-k="${k}">
      <div class="layer-thumb">${garmentSVG(p.type, colorHex(p, L.color), p.style)}</div>
      <div class="layer-info"><b>${esc(p.name)}</b>
        <div class="swatches">${p.colors.map(c => `<button class="sw ${c.name === L.color ? 'active' : ''}" style="background:${c.hex}" data-color="${esc(c.name)}" title="${esc(c.name)}" aria-label="${esc(c.name)}"></button>`).join('')}</div>
        <div class="sizes">${p.sizes.map(s => `<button class="sz ${s === L.size ? 'active' : ''} ${s === r ? 'rec-mark' : ''}" data-size="${s}">${s}</button>`).join('')}</div>
        <span class="fit ${fi.cls}">${fi.text}</span>
      </div>
      <button class="layer-x" data-x aria-label="Olib tashlash">✕</button>
    </div>`;
  }).join('');
  const sum = entries.reduce((s, [, L]) => s + state.byId.get(L.pid).price, 0);
  $('#outfitPrice').textContent = fmt(sum);
  $('#outfitTotal').hidden = false;
}

function renderRec() {
  const box = $('#recBox');
  const r = recSize();
  if (!r) { box.className = 'rec'; box.textContent = "O'lcham tavsiyasini olish uchun bo'y va vazningizni kiriting"; return; }
  box.className = 'rec has';
  const extra = T.shoulderCm ? `<br><small>📐 Rasmingiz bo'yicha yelka kengligi ≈ <b>${T.shoulderCm} sm</b> (hisobga olindi)</small>` : '';
  box.innerHTML = `<span class="big">${r}</span> sizga tavsiya etilgan o'lcham. Kiyimlar shu o'lchamga nisbatan kiydiriladi.${extra}`;
}

function syncAdjust() {
  const L = T.layers[T.active];
  $('#adjustBlock').hidden = !L || !T.img;
  if (!L) return;
  $('#adjustName').textContent = state.byId.get(L.pid).name;
  $('#adjS').value = L.adj.s; $('#adjX').value = L.adj.dx; $('#adjY').value = L.adj.dy; $('#adjR').value = L.adj.r;
}

function exportTryon(max = 1600, q = 0.92) {
  const k = Math.min(1, max / Math.max(cv.width, cv.height));
  const c = document.createElement('canvas');
  c.width = Math.round(cv.width * k); c.height = Math.round(cv.height * k);
  const x = c.getContext('2d');
  x.drawImage(cv, 0, 0, c.width, c.height);
  x.font = `700 ${Math.round(c.width * 0.04)}px Manrope, sans-serif`;
  x.fillStyle = 'rgba(255,255,255,.85)';
  x.textAlign = 'right';
  x.fillText('vip.uzb', c.width - 14, c.height - 14);
  return c.toDataURL('image/jpeg', q);
}

function bindStudio() {
  // Tana o'lchamlari
  $('#bodyHeight').value = state.body.height || '';
  $('#bodyWeight').value = state.body.weight || '';
  $$('#bodyGender button').forEach(b => b.classList.toggle('active', b.dataset.v === state.body.gender));
  const onBody = () => {
    const h = +$('#bodyHeight').value, w = +$('#bodyWeight').value;
    state.body.height = h >= 120 && h <= 220 ? h : '';
    state.body.weight = w >= 30 && w <= 200 ? w : '';
    store.set('vip_body', state.body);
    estimateShoulder(); renderRec(); renderLayers(); renderStage();
  };
  $('#bodyHeight').addEventListener('input', onBody);
  $('#bodyWeight').addEventListener('input', onBody);
  $('#bodyGender').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.body.gender = b.dataset.v;
    $$('#bodyGender button').forEach(x => x.classList.toggle('active', x === b));
    onBody();
  });

  // Rasm yuklash
  $('#photoInput').addEventListener('change', e => handlePhoto(e.target.files[0]));
  $('#cameraInput').addEventListener('change', e => { handlePhoto(e.target.files[0]); e.target.value = ''; });
  $('#photoInput2').addEventListener('change', e => { handlePhoto(e.target.files[0]); e.target.value = ''; });
  $('#useMannequin').addEventListener('click', useMannequin);
  const stage = $('#stage');
  ['dragenter', 'dragover'].forEach(ev => stage.addEventListener(ev, e => { e.preventDefault(); stage.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => stage.addEventListener(ev, e => { e.preventDefault(); stage.classList.remove('drag'); }));
  stage.addEventListener('drop', e => handlePhoto(e.dataTransfer.files[0]));

  // Kiyim tanlash
  $('#pickerTabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    T.pickerTab = b.dataset.v;
    $$('#pickerTabs button').forEach(x => x.classList.toggle('active', x === b));
    renderPicker();
  });
  $('#picker').addEventListener('click', async e => {
    const b = e.target.closest('.pick'); if (!b) return;
    const p = state.byId.get(+b.dataset.id);
    const key = slotOf(p) === 'bottom' ? 'bottom' : 'top';
    if (T.layers[key]?.pid === p.id) { delete T.layers[key]; T.active = Object.keys(T.layers)[0] || null; renderLayers(); renderPicker(); syncAdjust(); renderStage(); return; }
    if (!T.img) await useMannequin();
    await setLayer(p);
  });

  // Obraz qatlamlari
  $('#layers').addEventListener('click', async e => {
    const row = e.target.closest('.layer'); if (!row) return;
    const k = row.dataset.k, L = T.layers[k], p = state.byId.get(L.pid);
    if (e.target.closest('[data-x]')) {
      delete T.layers[k]; T.active = Object.keys(T.layers)[0] || null;
      renderLayers(); renderPicker(); syncAdjust(); renderStage(); return;
    }
    const sw = e.target.closest('[data-color]');
    if (sw) { L.color = sw.dataset.color; L.img = await garmentImage(p.type, colorHex(p, L.color), p.style); }
    const sz = e.target.closest('[data-size]');
    if (sz) L.size = sz.dataset.size;
    T.active = k;
    renderLayers(); syncAdjust(); renderStage();
  });

  // Aniq sozlash
  const bindRange = (id, prop) => $(id).addEventListener('input', e => {
    const L = T.layers[T.active]; if (!L) return;
    L.adj[prop] = +e.target.value; renderStage();
  });
  bindRange('#adjS', 's'); bindRange('#adjX', 'dx'); bindRange('#adjY', 'dy'); bindRange('#adjR', 'r');
  $('#resetAdjust').addEventListener('click', () => { Object.values(T.layers).forEach(L => { L.adj = { dx: 0, dy: 0, s: 1, r: 0 }; }); syncAdjust(); renderStage(); });

  // Sichqoncha / barmoq bilan surish, ikki barmoq bilan kattalashtirish
  const pts = new Map();
  let pinch = null;
  const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  cv.addEventListener('pointerdown', e => {
    if (!T.layers[T.active]) return;
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) pinch = { d: gap(), s: T.layers[T.active].adj.s };
  });
  cv.addEventListener('pointermove', e => {
    const prev = pts.get(e.pointerId);
    const L = T.layers[T.active];
    if (!prev || !L) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2 && pinch) {
      L.adj.s = clamp(pinch.s * gap() / pinch.d, 0.6, 1.6);
    } else if (pts.size === 1) {
      const rect = cv.getBoundingClientRect();
      L.adj.dx = clamp(L.adj.dx + (e.clientX - prev.x) / rect.width * 100, -30, 30);
      L.adj.dy = clamp(L.adj.dy + (e.clientY - prev.y) / rect.height * 100, -30, 30);
    }
    syncAdjust(); renderStage();
  });
  const end = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  // Sichqoncha g'ildiragi bilan kattalashtirish (desktop)
  cv.addEventListener('wheel', e => {
    const L = T.layers[T.active]; if (!L) return;
    e.preventDefault();
    L.adj.s = clamp(L.adj.s * (e.deltaY < 0 ? 1.03 : 0.97), 0.6, 1.6);
    syncAdjust(); renderStage();
  }, { passive: false });

  $('#downloadTry').addEventListener('click', () => {
    if (!T.img) return;
    const a = document.createElement('a');
    a.href = exportTryon();
    a.download = 'vip-uzb-obraz.jpg';
    a.click();
  });
  $('#outfitToCart').addEventListener('click', () => {
    const ls = Object.values(T.layers);
    ls.forEach(L => addToCart(L.pid, L.color, L.size, 1, true));
    toast(`🛍 Obraz (${ls.length} ta kiyim) savatga qo'shildi`);
  });
}

/* ================= Hero ================= */
async function renderHero() {
  const c = $('#heroCanvas'), x = c.getContext('2d');
  try {
    const base = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(MANNEQUIN_SVG));
    const [jeans, hoodie] = await Promise.all([garmentImage('pants', '#c8ad7f'), garmentImage('jacket', '#1f4d3a')]);
    x.drawImage(base, 0, 0, MANNEQUIN_W, MANNEQUIN_H);
    const n = { dx: 0, dy: 0, s: 1, r: 0 };
    drawLayer(x, { img: jeans, slot: 'bottom', fitW: 1, fitH: 1, adj: n }, MANNEQUIN_LM, MANNEQUIN_W, MANNEQUIN_H);
    drawLayer(x, { img: hoodie, slot: 'top', fitW: 1, fitH: 1, adj: n }, MANNEQUIN_LM, MANNEQUIN_W, MANNEQUIN_H);
  } catch { /* hero bezak — xato bo'lsa e'tiborsiz */ }
}

/* ================= Ishga tushirish ================= */
(async function init() {
  renderHero();
  bindCatalog();
  bindStudio();
  renderCartCount();
  renderRec();
  if (await loadProducts()) {
    buildFilters();
    renderCatalog();
    renderPicker();
    saveCart();
  }
})();
