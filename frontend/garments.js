// vip.uzb — kiyim tasvirlari (SVG) va virtual kiyib ko'rish uchun geometriya
// Barcha kiyimlar 400x520 o'lchamli koordinatalarda chizilgan.
// Ustki kiyim langarlari: yelkalar (120,70) va (280,70), son bo'g'imlari y=330.
// Pastki kiyim langarlari: son bo'g'imlari (150,40) va (250,40), to'piqlar y=480.

export const VIEW_W = 400, VIEW_H = 520;

export const TYPE_META = {
  tshirt: { slot: 'top' },
  shirt:  { slot: 'top' },
  hoodie: { slot: 'top' },
  jacket: { slot: 'top' },
  coat:   { slot: 'top' },
  dress:  { slot: 'full' },
  pants:  { slot: 'bottom' },
  jeans:  { slot: 'bottom' },
  skirt:  { slot: 'bottom' },
};

// Kiyimdagi langar nuqtalari (SVG koordinatalarida)
export const ANCHOR = {
  top:    { ox: 200, oy: 70, width: 160, length: 260 },  // yelka o'rtasi, yelka kengligi, yelka→son
  bottom: { ox: 200, oy: 40, width: 100, length: 440 },  // son o'rtasi, son kengligi, son→to'piq
};

let seq = 0;
const uid = () => 'g' + (++seq).toString(36) + Math.random().toString(36).slice(2, 6);

export function shade(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
export function luminance(hex) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const PATHS = {
  tshirt: 'M163,46 Q200,80 237,46 L292,64 Q318,74 330,100 L356,150 L318,174 L292,140 L286,362 Q200,372 114,362 L108,140 L82,174 L44,150 L70,100 Q82,74 108,64 Z',
  long:   'M163,46 Q200,78 237,46 L292,62 Q320,76 326,110 L336,220 L342,352 L306,356 L298,240 L290,160 L290,362 Q200,372 110,362 L110,160 L102,240 L94,356 L58,352 L64,220 L74,110 Q80,76 108,62 Z',
  coat:   'M163,46 Q200,78 237,46 L294,62 Q322,76 328,110 L338,220 L344,352 L308,356 L300,240 L294,165 L302,470 Q200,482 98,470 L106,165 L100,240 L92,356 L56,352 L62,220 L72,110 Q78,76 106,62 Z',
  dress:  'M150,50 Q200,96 250,50 L292,64 Q306,80 300,106 L282,120 Q270,180 268,230 Q300,360 336,500 Q200,516 64,500 Q100,360 132,230 Q130,180 118,120 L100,106 Q94,80 108,64 Z',
  pants:  'M122,14 L278,14 L290,130 L282,500 L214,500 L204,190 L196,190 L186,500 L118,500 L110,130 Z',
  skirt:  'M128,14 L272,14 Q300,150 332,300 Q200,322 68,300 Q100,150 128,14 Z',
  pencil: 'M128,14 L272,14 L284,150 L270,330 L130,330 L116,150 Z',
};
const CUFFS = 'M94,356 L58,352 L60,332 L96,336 Z M306,356 L342,352 L340,332 L304,336 Z';

function bodyPath(type, style) {
  if (type === 'tshirt') return PATHS.tshirt;
  if (type === 'coat') return PATHS.coat;
  if (type === 'dress') return PATHS.dress;
  if (type === 'pants' || type === 'jeans') return PATHS.pants;
  if (type === 'skirt') return style === 'pencil' ? PATHS.pencil : PATHS.skirt;
  return PATHS.long;
}

function patternDef(id, style, hex) {
  if (style === 'ikat') {
    const g = '#f2c14e', w = '#fff7e6', d = shade(hex, -0.45);
    return `<pattern id="${id}" width="60" height="80" patternUnits="userSpaceOnUse">
      <rect width="60" height="80" fill="${hex}"/>
      <path d="M30,2 L56,40 L30,78 L4,40 Z" fill="${g}" opacity=".92"/>
      <path d="M30,14 L46,40 L30,66 L14,40 Z" fill="${w}"/>
      <path d="M30,26 L37,40 L30,54 L23,40 Z" fill="${d}"/>
      <path d="M0,0 L6,10 L0,20 Z M60,0 L54,10 L60,20 Z M0,60 L6,70 L0,80 Z M60,60 L54,70 L60,80 Z" fill="${w}" opacity=".8"/>
      <path d="M4,40 L0,36 M56,40 L60,44" stroke="${d}" stroke-width="3"/></pattern>`;
  }
  if (style === 'floral') {
    const p = shade(hex, -0.35), w = '#ffffff', l = '#6aa56a';
    const flower = (x, y, c) => `<g transform="translate(${x},${y})">${[0, 72, 144, 216, 288].map(a => `<ellipse rx="5" ry="9" fill="${c}" transform="rotate(${a}) translate(0,-8)"/>`).join('')}<circle r="4" fill="#ffd166"/></g>`;
    return `<pattern id="${id}" width="70" height="70" patternUnits="userSpaceOnUse">
      <rect width="70" height="70" fill="${hex}"/>
      <path d="M8,50 q8,-6 14,2 M44,18 q8,-6 14,2" stroke="${l}" stroke-width="2.5" fill="none"/>
      ${flower(18, 20, w)}${flower(52, 52, p)}${flower(60, 8, w)}</pattern>`;
  }
  return '';
}

/** Kiyim SVG matnini qaytaradi */
export function garmentSVG(type, hex, style = '', { width, height, cls = '' } = {}) {
  const id = uid();
  const d = bodyPath(type, style);
  const lum = luminance(hex);
  const line = lum > 0.55 ? shade(hex, -0.28) : shade(hex, 0.22);
  const dark = shade(hex, -0.18);
  const pat = patternDef(id + 'p', style, hex);
  const fill = pat ? `url(#${id}p)` : hex;
  const sz = width ? `width="${width}" height="${height}"` : '';
  let pre = '', det = '';

  const sleeveCuffs = `<path d="${CUFFS}" fill="${dark}"/>`;

  switch (type) {
    case 'tshirt':
      det += `<path d="M163,46 Q200,80 237,46" fill="none" stroke="${dark}" stroke-width="9"/>`;
      det += `<path d="M118,140 L108,140 M282,140 L292,140" stroke="${line}" stroke-width="2" opacity=".5"/>`;
      if (style === 'polo') {
        det += `<path d="M163,46 L178,96 L200,70 Z" fill="${shade(hex, lum > .5 ? -0.08 : 0.08)}" stroke="${line}" stroke-width="2"/>
                <path d="M237,46 L222,96 L200,70 Z" fill="${shade(hex, lum > .5 ? -0.08 : 0.08)}" stroke="${line}" stroke-width="2"/>
                <rect x="192" y="70" width="16" height="70" rx="3" fill="none" stroke="${line}" stroke-width="2"/>
                <circle cx="200" cy="92" r="4" fill="${line}"/><circle cx="200" cy="120" r="4" fill="${line}"/>`;
      }
      break;
    case 'shirt':
      det += `<path d="M200,62 L200,368" stroke="${line}" stroke-width="2"/>`;
      det += [96, 146, 196, 246, 296, 340].map(y => `<circle cx="206" cy="${y}" r="4" fill="${line}"/>`).join('');
      det += `<path d="M232,118 h40 v42 q-20,8 -40,0 Z" fill="none" stroke="${line}" stroke-width="2"/>`;
      det += sleeveCuffs;
      det += `<path d="M160,44 L178,96 L200,62 Z" fill="${shade(hex, lum > .5 ? -0.06 : 0.1)}" stroke="${line}" stroke-width="2"/>
              <path d="M240,44 L222,96 L200,62 Z" fill="${shade(hex, lum > .5 ? -0.06 : 0.1)}" stroke="${line}" stroke-width="2"/>`;
      break;
    case 'hoodie':
      pre += `<path d="M138,74 Q126,2 200,0 Q274,2 262,74 Q232,52 200,52 Q168,52 138,74 Z" fill="${shade(hex, -0.25)}"/>`;
      det += `<path d="M148,60 Q200,118 252,60" fill="none" stroke="${shade(hex, -0.22)}" stroke-width="12"/>`;
      det += `<path d="M186,86 L182,160 M214,86 L218,160" stroke="${lum > .5 ? '#555' : '#eee'}" stroke-width="3"/><circle cx="182" cy="162" r="4" fill="${lum > .5 ? '#555' : '#eee'}"/><circle cx="218" cy="162" r="4" fill="${lum > .5 ? '#555' : '#eee'}"/>`;
      det += `<path d="M140,262 L260,262 L278,334 L122,334 Z" fill="${shade(hex, -0.06)}" stroke="${line}" stroke-width="2"/>`;
      det += `<path d="M110,338 Q200,348 290,338 L290,362 Q200,372 110,362 Z" fill="${dark}"/>`;
      det += sleeveCuffs;
      break;
    case 'jacket': {
      det += `<path d="M152,50 Q200,28 248,50 L244,68 Q200,52 156,68 Z" fill="${dark}"/>`;
      det += `<path d="M200,64 L200,362" stroke="${style === 'denim' ? '#b98b3a' : '#c9c9c9'}" stroke-width="${style === 'denim' ? 2 : 4}" ${style === 'denim' ? '' : 'stroke-dasharray="3 3"'}/>`;
      det += `<path d="M132,252 L160,300 M268,252 L240,300" stroke="${line}" stroke-width="4" stroke-linecap="round"/>`;
      det += `<path d="M110,340 Q200,350 290,340 L290,362 Q200,372 110,362 Z" fill="${dark}"/>`;
      det += sleeveCuffs;
      if (style === 'puffer') {
        det += [110, 155, 200, 245, 290].map(y => `<path d="M40,${y} Q200,${y + 14} 360,${y}" fill="none" stroke="${shade(hex, -0.2)}" stroke-width="3"/>`).join('');
        det += [130, 175, 220, 265, 310].map(y => `<path d="M40,${y} Q200,${y + 14} 360,${y}" fill="none" stroke="#fff" stroke-width="10" opacity=".08"/>`).join('');
      }
      if (style === 'denim') {
        det += `<path d="M130,120 h50 v46 h-50 Z M220,120 h50 v46 h-50 Z" fill="none" stroke="#b98b3a" stroke-width="2" stroke-dasharray="5 4"/>`;
        det += `<path d="M110,200 L290,200" stroke="#b98b3a" stroke-width="2" stroke-dasharray="5 4"/>`;
      }
      if (style === 'leather') {
        det += `<path d="M150,60 L120,140 L170,190" fill="none" stroke="${shade(hex, 0.18)}" stroke-width="3"/>`;
        det += `<path d="M138,100 Q150,220 140,330 M262,100 Q250,220 260,330 M320,120 Q332,230 330,340" stroke="#fff" stroke-width="12" opacity=".08" fill="none"/>`;
      }
      break;
    }
    case 'coat':
      det += `<path d="M163,46 L138,82 L162,112 L148,122 L200,206 Z" fill="${dark}" stroke="${line}" stroke-width="2"/>
              <path d="M237,46 L262,82 L238,112 L252,122 L200,206 Z" fill="${dark}" stroke="${line}" stroke-width="2"/>`;
      det += `<path d="M212,206 L214,474" stroke="${line}" stroke-width="2"/>`;
      det += [250, 310, 370].map(y => `<circle cx="180" cy="${y}" r="6" fill="${line}"/><circle cx="232" cy="${y}" r="6" fill="${line}"/>`).join('');
      det += `<path d="M118,330 h40 M242,330 h40" stroke="${line}" stroke-width="4" stroke-linecap="round"/>`;
      det += `<path d="M92,356 L56,352 L58,332 L94,336 Z M308,356 L344,352 L342,332 L306,336 Z" fill="${dark}"/>`;
      if (style === 'trench') {
        det += `<path d="M98,292 L302,292 L302,314 L98,314 Z" fill="${dark}"/><rect x="190" y="288" width="22" height="30" rx="3" fill="none" stroke="#c9a14a" stroke-width="3"/>`;
      }
      break;
    case 'dress':
      det += `<path d="M132,230 Q200,244 268,230" fill="none" stroke="${shade(hex, -0.3)}" stroke-width="7"/>`;
      det += `<path d="M170,246 Q160,380 136,504 M200,248 L200,510 M230,246 Q240,380 264,504" fill="none" stroke="#000" stroke-width="6" opacity=".09"/>`;
      if (!style) det += `<path d="M150,140 Q170,210 160,230" fill="none" stroke="#fff" stroke-width="10" opacity=".1"/>`;
      break;
    case 'pants':
    case 'jeans': {
      const st = type === 'jeans';
      det += `<path d="M122,14 L278,14 L279,38 L121,38 Z" fill="${dark}"/>`;
      det += [140, 180, 220, 260].map(x => `<rect x="${x}" y="12" width="6" height="28" rx="2" fill="${shade(hex, -0.3)}"/>`).join('');
      det += `<path d="M200,38 L200,170 M200,160 Q218,150 218,96" fill="none" stroke="${line}" stroke-width="2"/>`;
      det += `<path d="M126,44 Q150,70 162,40 M274,44 Q250,70 238,40" fill="none" stroke="${line}" stroke-width="2.5"/>`;
      det += st
        ? `<path d="M122,40 L112,130 L120,498 M278,40 L288,130 L280,498" fill="none" stroke="#c9963f" stroke-width="2" stroke-dasharray="6 4"/>
           <path d="M126,44 Q150,70 162,40 M274,44 Q250,70 238,40" fill="none" stroke="#c9963f" stroke-width="2" stroke-dasharray="5 3" transform="translate(0,6)"/>
           <circle cx="200" cy="26" r="5" fill="#c9a14a"/>`
        : `<path d="M160,80 L152,500 M240,80 L248,500" stroke="${line}" stroke-width="2" opacity=".55"/>`;
      det += `<path d="M150,190 Q148,340 152,498 M250,190 Q252,340 248,498" stroke="#fff" stroke-width="14" opacity=".06" fill="none"/>`;
      break;
    }
    case 'skirt':
      det += `<path d="M128,14 L272,14 L274,38 L126,38 Z" fill="${dark}"/>`;
      if (style === 'pencil') {
        det += `<path d="M200,280 L200,330" stroke="${line}" stroke-width="3"/><path d="M160,40 L150,320 M240,40 L250,320" stroke="#000" stroke-width="8" opacity=".07"/>`;
      } else {
        det += [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(i => `<path d="M${200 + i * 13},40 L${200 + i * 24},312" stroke="${i % 2 ? shade(hex, -0.25) : shade(hex, 0.15)}" stroke-width="2.5"/>`).join('');
      }
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" ${sz} class="${cls}">
<defs>${pat}
<linearGradient id="${id}s" x1="0" x2="1" y1="0" y2="0">
 <stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".2" stop-color="#000" stop-opacity=".04"/>
 <stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset=".8" stop-color="#000" stop-opacity=".04"/>
 <stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
<linearGradient id="${id}v" x1="0" x2="0" y1="0" y2="1">
 <stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/>
 <stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
<clipPath id="${id}c"><path d="${d}"/></clipPath>
</defs>
${pre}
<path d="${d}" fill="${fill}"/>
<g clip-path="url(#${id}c)">${det}
<path d="${d}" fill="url(#${id}s)"/><path d="${d}" fill="url(#${id}v)"/></g>
<path d="${d}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.5"/>
</svg>`;
}

// Canvas uchun kiyim rasmlari keshi
const imgCache = new Map();
export function garmentImage(type, hex, style = '') {
  const key = type + hex + style;
  if (imgCache.has(key)) return imgCache.get(key);
  const p = new Promise((resolve, reject) => {
    const svg = garmentSVG(type, hex, style, { width: VIEW_W * 2, height: VIEW_H * 2 });
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  imgCache.set(key, p);
  return p;
}

// ---------- Maneken (namuna model) ----------
export const MANNEQUIN_W = 600, MANNEQUIN_H = 900;
export const MANNEQUIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
<defs>
 <radialGradient id="mbg" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#173a2c"/><stop offset="1" stop-color="#070907"/></radialGradient>
 <linearGradient id="msk" x1="0" x2="1"><stop offset="0" stop-color="#b9a596"/><stop offset=".45" stop-color="#ecdccd"/><stop offset="1" stop-color="#a8968a"/></linearGradient>
</defs>
<rect width="600" height="900" fill="url(#mbg)"/>
<ellipse cx="300" cy="880" rx="150" ry="14" fill="#000" opacity=".45"/>
<ellipse cx="300" cy="104" rx="46" ry="56" fill="url(#msk)"/>
<rect x="280" y="150" width="40" height="44" fill="url(#msk)"/>
<path fill="url(#msk)" d="M278,180 L322,180 Q330,198 360,202 Q402,208 410,240 L424,340 L434,470 L438,530 Q430,545 418,532 L408,470 L396,350 L388,300 Q384,360 386,400 Q400,440 396,500 L384,620 L372,840 L380,872 L334,874 L330,840 L314,600 L300,520 L286,600 L270,840 L266,874 L220,872 L228,840 L216,620 L204,500 Q200,440 214,400 Q216,360 212,300 L204,350 L192,470 L182,532 Q170,545 162,530 L166,470 L176,340 L190,240 Q198,208 240,202 Q270,198 278,180 Z"/>
</svg>`;
const L = (x, y) => ({ x, y, v: 1 });
export const MANNEQUIN_LM = (() => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0 }));
  lm[0] = L(300, 120);
  lm[11] = L(385, 215); lm[12] = L(215, 215);
  lm[23] = L(360, 470); lm[24] = L(240, 470);
  lm[25] = L(355, 660); lm[26] = L(245, 660);
  lm[27] = L(350, 845); lm[28] = L(250, 845);
  return lm;
})();

/**
 * Kiyimni tana nuqtalariga moslab canvasga chizadi.
 * layer: { img, slot, fitW, fitH, adj:{dx,dy,s,r} }
 */
export function placement(slot, lm, W, H) {
  const ok = i => lm && lm[i] && lm[i].v > 0.35;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  if (slot === 'bottom') {
    if (ok(23) && ok(24)) {
      let a = lm[23], b = lm[24];
      if (a.x < b.x) [a, b] = [b, a];
      const c = mid(a, b), w = dist(a, b);
      let sy;
      if (ok(27) && ok(28)) sy = dist(c, mid(lm[27], lm[28])) / ANCHOR.bottom.length;
      else if (ok(25) && ok(26)) sy = dist(c, mid(lm[25], lm[26])) / 220;
      else sy = (w / ANCHOR.bottom.width) * 0.72;
      return { cx: c.x, cy: c.y, angle: Math.atan2(a.y - b.y, a.x - b.x), sx: w / ANCHOR.bottom.width, sy, unit: w };
    }
    const s = (W * 0.3) / ANCHOR.bottom.width;
    return { cx: W / 2, cy: H * 0.52, angle: 0, sx: s, sy: s * 0.8, unit: W * 0.3, manual: true };
  }
  if (ok(11) && ok(12)) {
    let a = lm[11], b = lm[12];
    if (a.x < b.x) [a, b] = [b, a];
    const c = mid(a, b), w = dist(a, b);
    let sy = w / ANCHOR.top.width * 1.02;
    if (ok(23) && ok(24)) sy = dist(c, mid(lm[23], lm[24])) / ANCHOR.top.length;
    return { cx: c.x, cy: c.y, angle: Math.atan2(a.y - b.y, a.x - b.x), sx: w / ANCHOR.top.width, sy, unit: w };
  }
  const s = (W * 0.36) / ANCHOR.top.width;
  return { cx: W / 2, cy: H * 0.26, angle: 0, sx: s, sy: s, unit: W * 0.36, manual: true };
}

export function drawLayer(ctx, layer, lm, W, H) {
  const slot = layer.slot === 'full' ? 'top' : layer.slot;
  const p = placement(slot, lm, W, H);
  const a = ANCHOR[slot];
  const adj = layer.adj || { dx: 0, dy: 0, s: 1, r: 0 };
  ctx.save();
  ctx.translate(p.cx + adj.dx * W / 100, p.cy + adj.dy * H / 100);
  ctx.rotate(p.angle + adj.r * Math.PI / 180);
  ctx.scale(p.sx * layer.fitW * adj.s, p.sy * layer.fitH * adj.s);
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = Math.max(6, p.unit * 0.08);
  ctx.shadowOffsetY = Math.max(2, p.unit * 0.02);
  ctx.drawImage(layer.img, -a.ox, -a.oy, VIEW_W, VIEW_H);
  ctx.restore();
}
