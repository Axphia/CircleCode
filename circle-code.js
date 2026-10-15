/* Circle Code codec v1 — dependency-free JavaScript library.
 *
 * Use as an ES module:
 *   import { buildModel, renderToCanvas, parsePayloadBits } from 'https://circlecode.js.org/circle-code.js';
 *   import { buildModel } from './circle-code.js';
 *
 * Or with a module script tag + window global:
 *   <script type="module">import 'https://circlecode.js.org/circle-code.js';
 *     const m = window.CircleCode.buildModel('hello', { rings: 5, density: 0.35 });</script>
 *
 * No DOM is touched at import time. Canvas/SVG renderers take explicit
 * contexts/strings, so this file also imports cleanly in Node.
 */

export const VERSION = '1.1.4';
export const DISC_R = 190;
export const R_START = 55;
export const R_END = 157;
export const CENTER_R = 42;
export const DASH_OFF = 0.28; // dash start, centered at 0.50 of slot
export const DASH_LEN = 0.44; // dash length, leaves generous gap for optical scanning

export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return function () { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; };
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function rngFrom(s) { return mulberry32(xmur3(s)()); }

export function radii(k) {
  const out = [];
  if (k === 1) return [110];
  for (let i = 0; i < k; i++) out.push(R_START + (R_END - R_START) * i / (k - 1));
  return out;
}
export function slotCount(r, density) { return Math.max(12, Math.floor(r * density)); }

// ---- encode ----
export function buildModel(payload, opts) {
  const o = Object.assign({ mode: 'data', rings: 5, density: 0.35 }, opts);
  const bytes = new TextEncoder().encode(payload);
  const rs = radii(o.rings);
  const ns = rs.map(r => slotCount(r, o.density));
  const cap = ns.reduce((a, n) => a + (n - 1), 0);
  let bits = new Array(cap).fill(0), used = 0, checksum = 0;
  if (o.mode === 'data') {
    bytes.forEach(b => checksum = (checksum + b) & 255);
    const need = 16 + bytes.length * 8 + 8;
    if (need > cap) throw new Error('Payload too long: need ' + need + ' bits, capacity ' + cap + '. Shorten text or add rings.');
    const seq = [];
    for (let i = 15; i >= 0; i--) seq.push((bytes.length >> i) & 1);
    bytes.forEach(b => { for (let i = 7; i >= 0; i--) seq.push((b >> i) & 1); });
    for (let i = 7; i >= 0; i--) seq.push((checksum >> i) & 1);
    const rnd = rngFrom(payload + '#pad');
    while (seq.length < cap) seq.push(rnd() > 0.5 ? 1 : 0);
    bits = seq; used = need;
  } else {
    const rnd = rngFrom(payload + '#art');
    bits = bits.map(() => rnd() > 0.5 ? 1 : 0);
    used = cap;
  }
  const rings = []; let idx = 0;
  rs.forEach((r, i) => {
    const n = ns[i], slots = [];
    for (let j = 0; j < n; j++) {
      if (j === 0) slots.push({ finder: true, bit: 1 });
      else slots.push({ finder: false, bit: bits[idx++] });
    }
    rings.push({ r, n, slots });
  });
  return { rings, cap, used, bytes: bytes.length, checksum, payload };
}

function drawCenterLogo(ctx, cx, cy, s, center, centerBg) {
  if (!center) return;
  const isWhiteBg = centerBg === '#ffffff';
  const textFill = isWhiteBg ? '#000000' : '#ffffff';

  // 1. Image object or image element
  if (center instanceof Image || (typeof center === 'object' && center.img)) {
    const img = center instanceof Image ? center : center.img;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 39 * s, 0, Math.PI * 2);
    ctx.clip();
    const targetSize = 64 * s;
    const aspect = (img.width || 1) / (img.height || 1);
    let dw, dh;
    if (aspect >= 1) { dw = targetSize; dh = targetSize / aspect; }
    else { dh = targetSize; dw = targetSize * aspect; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
    return;
  }

  // 2. App Clip preset
  if (center === 'appclip') {
    ctx.save();
    ctx.strokeStyle = textFill;
    ctx.lineWidth = 2.2 * s;
    ctx.setLineDash([4 * s, 3.5 * s]);
    ctx.beginPath();
    ctx.arc(cx, cy, 24 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = textFill;
    const r = 11 * s;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath(); ctx.roundRect(cx - r, cy - r, r * 2, r * 2, 4 * s); ctx.fill();
    } else {
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.fillStyle = isWhiteBg ? '#ffffff' : '#000000';
    ctx.beginPath(); ctx.arc(cx, cy, 3.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  // 3. Apple Pay preset
  // 3. Apple Logo Preset (only if explicitly requested with Pay or apple)
  if (center === 'Pay' || center === 'apple') {
    ctx.save();
    ctx.fillStyle = textFill;
    ctx.translate(cx - 23 * s, cy - 9 * s);
    ctx.scale(1.15 * s, 1.15 * s);
    if (typeof Path2D !== 'undefined') {
      const apple = new Path2D('M15.22 8.44c-.03-2.03 1.66-3.02 1.74-3.07-.95-1.38-2.42-1.57-2.94-1.59-1.25-.13-2.45.74-3.09.74-.64 0-1.62-.72-2.67-.7-1.37.02-2.64.8-3.34 2.03-1.43 2.48-.37 6.16 1.02 8.17.68.98 1.49 2.08 2.55 2.04 1.02-.04 1.41-.66 2.65-.66 1.23 0 1.59.66 2.66.64 1.09-.02 1.78-.99 2.45-1.98.78-1.13 1.1-2.23 1.12-2.29-.02-.01-2.14-.82-2.15-3.33zM13.63 3.19c.56-.68.94-1.63.84-2.58-.81.03-1.8.54-2.38 1.22-.51.6-.96 1.56-.84 2.48.9.07 1.83-.45 2.38-1.12z');
      ctx.fill(apple);
    }
    ctx.restore();
    ctx.fillStyle = textFill;
    ctx.font = 'bold ' + Math.round(18 * s) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Pay', cx - 1 * s, cy + 1 * s);
    return;
  }

  // 4. Custom text
  const text = typeof center === 'object' ? (center.text || '') : String(center);
  ctx.fillStyle = textFill;
  ctx.font = 'bold ' + Math.round(19 * s) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

export function getRuns(bits) {
  const n = bits.length;
  let allOnes = true;
  for (let i = 0; i < n; i++) {
    if (bits[i] !== 1) { allOnes = false; break; }
  }
  if (allOnes) return [{ start: 0, len: n, full: true }];

  let firstZero = 0;
  while (firstZero < n && bits[firstZero] === 1) firstZero++;

  const runs = [];
  let i = 0;
  while (i < n) {
    const idx = (firstZero + i) % n;
    if (bits[idx] === 1) {
      const runStart = idx;
      let len = 0;
      while (i < n && bits[(firstZero + i) % n] === 1) {
        len++;
        i++;
      }
      runs.push({ start: runStart, len });
    } else {
      i++;
    }
  }
  return runs;
}

export function renderToCanvas(model, ctx, size, style) {
  const o = Object.assign({ dark: '#000000', light: '#8e8e93', center: 'Pay', centerBg: '#000000' }, style);
  const s = size / 400, cx = size / 2, cy = size / 2;
  const isLonCle = !!(o.style === 'loncle' || o.loncle || o.lonCle || o.appleStyle || o.connectedArcs || o.merged || o.style === 'apple');
  ctx.clearRect(0, 0, size, size);
  if (o.bg !== 'transparent') {
    ctx.beginPath(); ctx.fillStyle = o.bg || '#ffffff';
    ctx.arc(cx, cy, DISC_R * s, 0, Math.PI * 2); ctx.fill();
  }

  if (isLonCle) {
    // LonCle Mode: connected sweeping arcs with variable lengths
    model.rings.forEach((rg) => {
      const n = rg.n;
      const slot = (Math.PI * 2) / n;
      const bits = rg.slots.map(sl => (sl.finder || sl.bit === 1) ? 1 : 0);
      const runs = getRuns(bits);
      ctx.strokeStyle = o.dark || '#000000';
      ctx.lineWidth = (o.lineWidth || 7.5) * s;
      ctx.lineCap = 'round';
      runs.forEach(({ start, len, full }) => {
        ctx.beginPath();
        if (full) {
          ctx.arc(cx, cy, rg.r * s, 0, Math.PI * 2);
        } else {
          const a0 = (start / n) * Math.PI * 2 + slot * DASH_OFF;
          const a1 = a0 + (len - 1) * slot + slot * DASH_LEN;
          ctx.arc(cx, cy, rg.r * s, a0, a1);
        }
        ctx.stroke();
      });
    });
  } else {
    // Circle Mode: classic discrete dashed pills
    model.rings.forEach((rg) => {
      const slot = Math.PI * 2 / rg.n;
      rg.slots.forEach((sl, j) => {
        const isBit1 = sl.finder || sl.bit === 1;
        const col = isBit1 ? (o.dark || '#000000') : (o.light || '#8e8e93');
        const a0 = (j / rg.n) * Math.PI * 2 + slot * DASH_OFF;
        const a1 = a0 + slot * DASH_LEN;
        ctx.beginPath();
        ctx.strokeStyle = col;
        ctx.lineWidth = (o.lineWidth || 7.5) * s;
        ctx.lineCap = 'round';
        ctx.arc(cx, cy, rg.r * s, a0, a1);
        ctx.stroke();
      });
    });
  }

  if (o.centerBg !== 'transparent') {
    ctx.beginPath(); ctx.fillStyle = o.centerBg || '#000000';
    ctx.arc(cx, cy, CENTER_R * s, 0, Math.PI * 2); ctx.fill();
  }
  drawCenterLogo(ctx, cx, cy, s, o.center, o.centerBg);
}

export function renderToSVG(model, style) {
  const o = Object.assign({ dark: '#000000', light: '#8e8e93', center: 'Pay', centerBg: '#000000' }, style);
  const cx = 200, cy = 200;
  const isLonCle = !!(o.style === 'loncle' || o.loncle || o.lonCle || o.appleStyle || o.connectedArcs || o.merged || o.style === 'apple');
  const pol = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  let h = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">';
  if (o.bg !== 'transparent') {
    h += '<circle cx="200" cy="200" r="190" fill="' + (o.bg || '#ffffff') + '"/>';
  }
  const w = o.lineWidth || 7.5;

  if (isLonCle) {
    // LonCle Mode: connected sweeping arcs with variable lengths
    model.rings.forEach((rg) => {
      const n = rg.n;
      const slot = (Math.PI * 2) / n;
      const bits = rg.slots.map(sl => (sl.finder || sl.bit === 1) ? 1 : 0);
      const runs = getRuns(bits);
      runs.forEach(({ start, len, full }) => {
        if (full) {
          h += '<circle cx="200" cy="200" r="' + rg.r + '" stroke="' + (o.dark || '#000000') +
            '" stroke-width="' + w + '" fill="none"/>';
        } else {
          const a0 = (start / n) * Math.PI * 2 + slot * DASH_OFF;
          const a1 = a0 + (len - 1) * slot + slot * DASH_LEN;
          const p0 = pol(rg.r, a0), p1 = pol(rg.r, a1);
          const largeArc = (a1 - a0) > Math.PI ? 1 : 0;
          h += '<path d="M ' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A ' + rg.r + ' ' + rg.r +
            ' 0 ' + largeArc + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + '" stroke="' + (o.dark || '#000000') +
            '" stroke-width="' + w + '" stroke-linecap="round" fill="none"/>';
        }
      });
    });
  } else {
    // Circle Mode: classic discrete dashed pills
    model.rings.forEach((rg) => {
      const slot = Math.PI * 2 / rg.n;
      rg.slots.forEach((sl, j) => {
        const isBit1 = sl.finder || sl.bit === 1;
        const col = isBit1 ? (o.dark || '#000000') : (o.light || '#8e8e93');
        const a0 = (j / rg.n) * Math.PI * 2 + slot * DASH_OFF;
        const a1 = a0 + slot * DASH_LEN;
        const p0 = pol(rg.r, a0), p1 = pol(rg.r, a1);
        h += '<path d="M ' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A ' + rg.r + ' ' + rg.r +
          ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + '" stroke="' + col +
          '" stroke-width="' + w + '" stroke-linecap="round" fill="none"/>';
      });
    });
  }

  const centerBg = o.centerBg || '#000000';
  if (centerBg !== 'transparent') {
    h += '<circle cx="200" cy="200" r="42" fill="' + centerBg + '"/>';
  }
  const textFill = centerBg === '#ffffff' ? '#000000' : '#ffffff';

  if (typeof o.center === 'object' && o.center.dataUrl) {
    const targetSize = 64;
    h += '<defs><clipPath id="centerClip"><circle cx="200" cy="200" r="39"/></clipPath></defs>';
    h += '<image href="' + o.center.dataUrl + '" x="' + (200 - targetSize/2) + '" y="' + (200 - targetSize/2) + '" width="' + targetSize + '" height="' + targetSize + '" clip-path="url(#centerClip)" preserveAspectRatio="xMidYMid meet"/>';
  } else if (o.center === 'appclip') {
    h += '<circle cx="200" cy="200" r="24" stroke="' + textFill + '" stroke-width="2.2" stroke-dasharray="4 3.5" fill="none"/>';
    h += '<rect x="189" y="189" width="22" height="22" rx="4" fill="' + textFill + '"/>';
    h += '<circle cx="200" cy="200" r="3.5" fill="' + (centerBg === '#ffffff' ? '#ffffff' : '#000000') + '"/>';
  } else if (o.center === 'Pay' || o.center === 'Pay' || o.center === 'apple') {
    h += '<path transform="translate(177, 191) scale(1.15)" d="M15.22 8.44c-.03-2.03 1.66-3.02 1.74-3.07-.95-1.38-2.42-1.57-2.94-1.59-1.25-.13-2.45.74-3.09.74-.64 0-1.62-.72-2.67-.7-1.37.02-2.64.8-3.34 2.03-1.43 2.48-.37 6.16 1.02 8.17.68.98 1.49 2.08 2.55 2.04 1.02-.04 1.41-.66 2.65-.66 1.23 0 1.59.66 2.66.64 1.09-.02 1.78-.99 2.45-1.98.78-1.13 1.1-2.23 1.12-2.29-.02-.01-2.14-.82-2.15-3.33zM13.63 3.19c.56-.68.94-1.63.84-2.58-.81.03-1.8.54-2.38 1.22-.51.6-.96 1.56-.84 2.48.9.07 1.83-.45 2.38-1.12z" fill="' + textFill + '"/>';
    h += '<text x="199" y="201" fill="' + textFill + '" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="18" font-weight="bold" text-anchor="start" dominant-baseline="central">Pay</text>';
  } else {
    const safe = String(o.center).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    h += '<text x="200" y="200" fill="' + textFill + '" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="19" font-weight="bold" text-anchor="middle" dominant-baseline="central">' + safe + '</text>';
  }
  h += '</svg>';
  return h;
}

// ---- decode (bits level) ----
export function modelToBits(model) {
  const flat = [];
  model.rings.forEach(rg => rg.slots.forEach(sl => { if (!sl.finder) flat.push(sl.bit); }));
  return flat;
}
export function parseBitsAt(bits, len) {
  if (len < 0 || len > 120 || 16 + len * 8 + 8 > bits.length) return { ok: false, reason: 'bad len' };
  const bytes = [];
  for (let q = 0; q < len; q++) { let b = 0; for (let i = 0; i < 8; i++) b = (b << 1) | bits[16 + q * 8 + i]; bytes.push(b); }
  let chk = 0; for (let i = 0; i < 8; i++) chk = (chk << 1) | bits[16 + len * 8 + i];
  let sum = 0; bytes.forEach(b => sum = (sum + b) & 255);
  if (sum !== chk) return { ok: false, reason: 'checksum', needFix: true, len, bytes, chk, sum };
  let text = '';
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); }
  catch (e) { return { ok: false, reason: 'utf8' }; }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) return { ok: false, reason: 'implausible text' };
  return { ok: true, text, len, chk };
}
export function parseBits(bits) {
  return parsePayloadBits(bits);
}
export function parsePayloadBits(bits) {
  if (bits.length < 24) return { ok: false, reason: 'too few bits' };
  let len = 0; for (let i = 0; i < 16; i++) len = (len << 1) | bits[i];
  if (len < 0 || len > 120 || 16 + len * 8 + 8 > bits.length) return { ok: false, reason: 'bad header len=' + len };
  return parseBitsAt(bits, len);
}
export function repairLens(header16, capBits) {
  const out = [], seen = {};
  const max = Math.min(120, Math.floor((capBits - 24) / 8));
  const push = L => { if (L >= 1 && L <= max && !seen[L]) { seen[L] = 1; out.push(L); } };
  let base = 0; for (let i = 0; i < 16; i++) base = (base << 1) | header16[i];
  push(base);
  for (let f = 0; f < 16; f++) {
    const h = header16.slice(); h[f] ^= 1;
    let L = 0; for (let i = 0; i < 16; i++) L = (L << 1) | h[i];
    push(L);
  }
  return out;
}
export function correctBitFlips(bits, conf, len, aggressive) {
  const end = 16 + len * 8 + 8, order = [];
  for (let i = 16; i < end && i < bits.length; i++) order.push(i);
  order.sort((a, b) => conf[a] - conf[b]);
  const weak = order.filter(i => conf[i] < 30);
  for (const i of weak.slice(0, 8)) {
    const t = bits.slice(); t[i] ^= 1;
    const r = parseBitsAt(t, len);
    if (r.ok) return Object.assign({}, r, { fixed: 1 });
  }
  if (aggressive) {
    const pool = weak.slice(0, 7);
    for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) {
      const t = bits.slice(); t[pool[a]] ^= 1; t[pool[b]] ^= 1;
      const r = parseBitsAt(t, len);
      if (r.ok) return Object.assign({}, r, { fixed: 2 });
    }
    const pool3 = weak.slice(0, 6);
    for (let a = 0; a < pool3.length; a++) for (let b = a + 1; b < pool3.length; b++) for (let c = b + 1; c < pool3.length; c++) {
      const t = bits.slice(); t[pool3[a]] ^= 1; t[pool3[b]] ^= 1; t[pool3[c]] ^= 1;
      const r = parseBitsAt(t, len);
      if (r.ok) return Object.assign({}, r, { fixed: 3 });
    }
  }
  return null;
}
// full bit-level decode: checksum fix + header repair (gate repair to aligned patterns)
export function finishBits(bits, conf, aggressive, gate) {
  let p = parsePayloadBits(bits), fixed = 0;
  if (!p.ok && p.reason === 'checksum') {
    const c = correctBitFlips(bits, conf, p.len, aggressive);
    if (c) { p = c; fixed = c.fixed; }
  }
  if (!p.ok && p.reason.indexOf('bad header') === 0 && gate && gate.fMean < 70 && gate.minSep > 35) {
    const cands = repairLens(bits.slice(0, 16), bits.length);
    for (const L of cands) {
      const q = parseBitsAt(bits, L);
      if (q.ok) { p = q; fixed = 1; break; }
      if (q.needFix) {
        const c = correctBitFlips(bits, conf, L, aggressive);
        if (c) { p = c; fixed = 1 + c.fixed; break; }
      }
    }
  }
  return { p, fixed };
}
// reorder per-ring luminance arrays sampled in mirrored order (jp ascending,
// finder excluded) back into original bitstream order; needs rotation from
// mirrored-finder alignment (see scanner app)
export function orderMirroredBits(ringsLums, ringThr) {
  const bits = [], conf = [];
  ringsLums.forEach((lums, ri) => {
    const thr = ringThr[ri];
    for (let k = lums.length - 1; k >= 0; k--) {
      bits.push(lums[k] < thr ? 1 : 0); conf.push(Math.abs(lums[k] - thr));
    }
  });
  return { bits, conf };
}
export function otsuThreshold(vals) {
  const hist = new Array(256).fill(0);
  for (const v of vals) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = vals.length; let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (wB === 0) continue;
    const wF = total - wB; if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
  for (const v of vals) { if (v <= thr) { s0 += v; n0++; } else { s1 += v; n1++; } }
  if (!n0 || !n1) return { thr: thr + 0.5, sep: 0 };
  return { thr: (s0 / n0 + s1 / n1) / 2, sep: Math.abs(s1 / n1 - s0 / n0) };
}
export function kmeansThreshold(vals) {
  const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  if (hi - lo < 8) return { thr: (lo + hi) / 2, sep: hi - lo };
  let c0 = lo, c1 = hi;
  for (let it = 0; it < 12; it++) {
    let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
    for (const v of vals) { if (Math.abs(v - c0) < Math.abs(v - c1)) { s0 += v; n0++; } else { s1 += v; n1++; } }
    if (!n0 || !n1) break;
    const nc0 = s0 / n0, nc1 = s1 / n1;
    if (Math.abs(nc0 - c0) < 0.5 && Math.abs(nc1 - c1) < 0.5) { c0 = nc0; c1 = nc1; break; }
    c0 = nc0; c1 = nc1;
  }
  return { thr: (c0 + c1) / 2, sep: Math.abs(c1 - c0), dark: Math.min(c0, c1) };
}

const CircleCode = {
  VERSION, DISC_R, R_START, R_END, CENTER_R, DASH_OFF, DASH_LEN,
  xmur3, mulberry32, rngFrom, radii, slotCount,
  buildModel, renderToCanvas, renderToSVG,
  modelToBits, parseBits, parsePayloadBits, parseBitsAt, repairLens,
  correctBitFlips, finishBits, orderMirroredBits,
  otsuThreshold, kmeansThreshold
};
export default CircleCode;
if (typeof window !== 'undefined') window.CircleCode = CircleCode;
