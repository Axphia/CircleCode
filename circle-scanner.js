/* Circle Code Scanner v1.0.0 — dependency-free JavaScript circular code decoder.
 *
 * Scans Apple Pay-style circular codes from images, canvases, and live camera streams.
 * Works 100% client-side in the browser or headless in Node.js.
 *
 * ES Module:
 *   import { scanCanvas, scanImage, scanImageData, CircleScanner } from './circle-scanner.js';
 *
 * Classic Script:
 *   <script type="module" src="./circle-scanner.js"></script>
 *   <!-- Exposes window.CircleScanner -->
 */

export const VERSION = '1.0.0';
export const DISC_R = 190;
export const R_START = 55;
export const R_END = 157;
export const CENTER_R = 42;

export function radii(k) {
  const out = [];
  if (k === 1) return [110];
  for (let i = 0; i < k; i++) out.push(R_START + (R_END - R_START) * i / (k - 1));
  return out;
}

export function slotCount(r, density) {
  return Math.max(12, Math.floor(r * density));
}

// -------------------------------------------------------------
// Data-Oriented Precomputed Look-Up Tables (LUT) & Scratch Buffers
// -------------------------------------------------------------

// Fast 360-degree trigonometric LUT (1024-entry circle for high angular precision)
const TABLE_SIZE = 1024;
const TABLE_MASK = TABLE_SIZE - 1;
const RAD_TO_INDEX = TABLE_SIZE / (Math.PI * 2);
const SIN_LUT = new Float32Array(TABLE_SIZE);
const COS_LUT = new Float32Array(TABLE_SIZE);

for (let i = 0; i < TABLE_SIZE; i++) {
  const rad = (i * Math.PI * 2) / TABLE_SIZE;
  SIN_LUT[i] = Math.sin(rad);
  COS_LUT[i] = Math.cos(rad);
}

// Inline fast sin & cos lookup
export function fastCos(rad) {
  let idx = (rad * RAD_TO_INDEX) | 0;
  return COS_LUT[((idx % TABLE_SIZE) + TABLE_SIZE) & TABLE_MASK];
}

export function fastSin(rad) {
  let idx = (rad * RAD_TO_INDEX) | 0;
  return SIN_LUT[((idx % TABLE_SIZE) + TABLE_SIZE) & TABLE_MASK];
}

// Flat scratch histogram buffer for zero-allocation Otsu thresholding
const OTSU_HIST = new Int32Array(256);

// Pre-allocated flat scratch buffers for candidate sweeps
const SCRATCH_CANDS_ROT = new Float32Array(256);
const SCRATCH_CANDS_SCORE = new Float32Array(256);
const SCRATCH_CANDS_IDX = new Int32Array(256);

// -------------------------------------------------------------
// Grayscale & Sampling Utilities
// -------------------------------------------------------------

export function toGrayscale(imageData, mode = 'luminance') {
  const data = imageData.data || imageData;
  const len = (imageData.width * imageData.height) | 0;
  const g = new Float32Array(len);
  const loopEnd = len << 2;
  let p = 0;

  if (mode === 'red') {
    for (let idx = 0; idx < loopEnd; idx += 4) {
      g[p++] = data[idx];
    }
  } else if (mode === 'blue') {
    for (let idx = 0; idx < loopEnd; idx += 4) {
      g[p++] = data[idx + 2];
    }
  } else if (mode === 'green') {
    for (let idx = 0; idx < loopEnd; idx += 4) {
      g[p++] = data[idx + 1];
    }
  } else {
    // Fast 32-bit integer luminance weighting: (77*R + 150*G + 29*B) >> 8
    for (let idx = 0; idx < loopEnd; idx += 4) {
      g[p++] = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
    }
  }
  return g;
}

export function sample(g, w, h, cx, cy, r = 0, ang = 0, aspect = 1.0, tilt = 0) {
  let xr = 0, yr = 0;
  if (r !== 0) {
    xr = r * fastCos(ang);
    yr = r * fastSin(ang);
    if (aspect !== 1.0) {
      const cosT = fastCos(tilt), sinT = fastSin(tilt);
      const u = xr * cosT + yr * sinT;
      const v = (-xr * sinT + yr * cosT) * aspect;
      xr = u * cosT - v * sinT;
      yr = u * sinT + v * cosT;
    }
  }
  const x = cx + xr;
  const y = cy + yr;
  
  // 3x3 box sample with fast integer boundary guards
  const xi0 = (x + 0.5) | 0;
  const yi0 = (y + 0.5) | 0;
  
  if (xi0 >= 1 && yi0 >= 1 && xi0 < w - 1 && yi0 < h - 1) {
    const row0 = (yi0 - 1) * w + (xi0 - 1);
    const row1 = yi0 * w + (xi0 - 1);
    const row2 = (yi0 + 1) * w + (xi0 - 1);
    return (
      g[row0] + g[row0 + 1] + g[row0 + 2] +
      g[row1] + g[row1 + 1] + g[row1 + 2] +
      g[row2] + g[row2 + 1] + g[row2 + 2]
    ) * 0.11111111; // 1 / 9
  }
  
  let s = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const xi = ((x + dx) + 0.5) | 0;
      const yi = ((y + dy) + 0.5) | 0;
      if (xi >= 0 && yi >= 0 && xi < w && yi < h) {
        s += g[yi * w + xi];
        n++;
      }
    }
  }
  return n ? s / n : 255;
}

export function sampleRadialMin(g, w, h, cx, cy, r, ang, scale = 1.0, aspect = 1.0, tilt = 0) {
  const dr = 2.2 * (scale > 0.6 ? scale : 0.6);
  const s0 = sample(g, w, h, cx, cy, r, ang, aspect, tilt);
  const s1 = sample(g, w, h, cx, cy, r - dr, ang, aspect, tilt);
  const s2 = sample(g, w, h, cx, cy, r + dr, ang, aspect, tilt);
  return s0 < s1 ? (s0 < s2 ? s0 : s2) : (s1 < s2 ? s1 : s2);
}

export function median3(g, w, h, cx, cy, r, ang, slot, scale = 1.0, aspect = 1.0, tilt = 0) {
  // Use slot * 0.14 so taps remain inside the solid body of the dash
  const off = slot * 0.14;
  const a0 = sampleRadialMin(g, w, h, cx, cy, r, ang - off, scale, aspect, tilt);
  const a1 = sampleRadialMin(g, w, h, cx, cy, r, ang, scale, aspect, tilt);
  const a2 = sampleRadialMin(g, w, h, cx, cy, r, ang + off, scale, aspect, tilt);
  
  // Fast branchless/minimal branch 3-element median (no array allocation, no .sort())
  if (a0 > a1) {
    if (a1 > a2) return a1;
    return a0 > a2 ? a2 : a0;
  } else {
    if (a0 > a2) return a0;
    return a1 > a2 ? a2 : a1;
  }
}

// Otsu automatic thresholding per ring with zero GC allocations
export function otsuThr(vals) {
  const total = vals.length | 0;
  OTSU_HIST.fill(0);
  
  for (let i = 0; i < total; i++) {
    const v = (vals[i] + 0.5) | 0;
    const bin = v < 0 ? 0 : (v > 255 ? 255 : v);
    OTSU_HIST[bin]++;
  }
  
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * OTSU_HIST[i];

  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let t = 0; t < 256; t++) {
    const h = OTSU_HIST[t];
    wB += h;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * h;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const diff = mB - mF;
    const between = wB * wF * diff * diff;
    if (between > best) {
      best = between;
      thr = t;
    }
  }

  let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
  for (let i = 0; i < total; i++) {
    const v = vals[i];
    if (v <= thr) { s0 += v; n0++; }
    else { s1 += v; n1++; }
  }
  if (!n0 || !n1) return { thr: thr + 0.5, sep: 0 };
  return { thr: (s0 / n0 + s1 / n1) * 0.5, sep: Math.abs(s1 / n1 - s0 / n0) };
}

export function kmeans2(vals) {
  let lo = 1e9, hi = -1e9;
  const len = vals.length | 0;
  for (let i = 0; i < len; i++) {
    const v = vals[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi - lo < 8) return { thr: (lo + hi) * 0.5, sep: hi - lo };
  
  let c0 = lo, c1 = hi;
  for (let it = 0; it < 12; it++) {
    let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
    for (let i = 0; i < len; i++) {
      const v = vals[i];
      if (Math.abs(v - c0) < Math.abs(v - c1)) { s0 += v; n0++; }
      else { s1 += v; n1++; }
    }
    if (!n0 || !n1) break;
    const nc0 = s0 / n0, nc1 = s1 / n1;
    if (Math.abs(nc0 - c0) < 0.5 && Math.abs(nc1 - c1) < 0.5) break;
    c0 = nc0; c1 = nc1;
  }
  return { thr: (c0 + c1) * 0.5, sep: Math.abs(c1 - c0) };
}

// Bit & Header Parsing + Checksum Guided Error Correction
export function parseBitsAt(bits, len) {
  const maxLen = Math.floor((bits.length - 24) / 8);
  if (len < 1 || len > maxLen || 16 + len * 8 + 8 > bits.length) {
    return { ok: false, reason: 'bad length' };
  }
  const bytes = [];
  for (let q = 0; q < len; q++) {
    let b = 0;
    for (let i = 0; i < 8; i++) b = (b << 1) | bits[16 + q * 8 + i];
    if ((b < 32 && b !== 9 && b !== 10 && b !== 13) || b === 127) {
      return { ok: false, reason: 'control char' };
    }
    bytes.push(b);
  }
  let chk = 0;
  for (let i = 0; i < 8; i++) chk = (chk << 1) | bits[16 + len * 8 + i];

  let sum = 0;
  bytes.forEach(b => sum = (sum + b) & 255);
  if (sum !== chk) {
    return { ok: false, reason: 'checksum', needFix: true, len, bytes, chk, sum };
  }

  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch (e) {
    return { ok: false, reason: 'utf8 error' };
  }
  if (text.length < 1 || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) {
    return { ok: false, reason: 'implausible text' };
  }
  return { ok: true, text, bytes, len, chk };
}

export function parseBits(bits) {
  if (bits.length < 24) return { ok: false, reason: 'too few bits' };
  let len = 0;
  for (let i = 0; i < 16; i++) len = (len << 1) | bits[i];
  const maxLen = Math.floor((bits.length - 24) / 8);
  if (len < 1 || len > maxLen || 16 + len * 8 + 8 > bits.length) {
    return { ok: false, reason: 'bad header len=' + len };
  }
  return parseBitsAt(bits, len);
}

export function correctBits(bits, conf, len, aggressive, gate) {
  // Allow error correction on payloads with at least 2 bytes
  if (len < 2) return null;
  if (gate && (gate.fMean > 155 || gate.minSep < 8)) return null;
  const end = 16 + len * 8 + 8;
  const order = [];
  for (let i = 16; i < end && i < bits.length; i++) order.push(i);
  order.sort((a, b) => conf[a] - conf[b]);

  const bytes = [];
  for (let q = 0; q < len; q++) {
    let b = 0;
    for (let i = 0; i < 8; i++) b = (b << 1) | bits[16 + q * 8 + i];
    bytes.push(b);
  }
  let chk = 0;
  for (let i = 0; i < 8; i++) chk = (chk << 1) | bits[16 + len * 8 + i];
  let sum = 0;
  bytes.forEach(b => sum = (sum + b) & 255);

  // 1. Check if error was in checksum byte itself
  const chkDiff = sum ^ chk;
  if (chkDiff > 0 && (chkDiff & (chkDiff - 1)) === 0) {
    let text = '';
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); } catch (e) { text = ''; }
    if (text && text.length >= 2 && !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) {
      return { ok: true, text, bytes, len, chk: sum, fixed: 1 };
    }
  }

  // 2. Check 1-bit payload flip strictly matching the mathematical difference weight
  const diffPlus = (sum - chk) & 255;
  const diffMinus = (chk - sum) & 255;
  const weak = order.slice(0, 16);
  for (const i of weak) {
    const bitPos = 7 - ((i - 16) % 8);
    const weight = 1 << bitPos;
    const curBit = bits[i];
    if ((curBit === 1 && diffPlus === weight) || (curBit === 0 && diffMinus === weight)) {
      const t = bits.slice(); t[i] ^= 1;
      const r = parseBitsAt(t, len);
      if (r.ok) return { ...r, fixed: 1 };
    }
  }

  // 3. 2-bit flips ONLY if aggressive, len >= 4, high contrast, and mathematically matching delta!
  if (aggressive && len >= 4 && gate && gate.minSep > 12 && gate.fMean < 145) {
    const targetDelta = (chk - sum) & 255;
    const pool = order.slice(0, 8);
    for (let a = 0; a < pool.length; a++) {
      const ia = pool[a];
      const wa = (1 << (7 - ((ia - 16) % 8))) * (bits[ia] === 0 ? 1 : -1);
      for (let b = a + 1; b < pool.length; b++) {
        const ib = pool[b];
        const wb = (1 << (7 - ((ib - 16) % 8))) * (bits[ib] === 0 ? 1 : -1);
        if (((wa + wb) & 255) === targetDelta) {
          const t = bits.slice(); t[ia] ^= 1; t[ib] ^= 1;
          const r = parseBitsAt(t, len);
          if (r.ok) return { ...r, fixed: 2 };
        }
      }
    }
  }
  return null;
}

export function repairLens(header16, capBits) {
  const out = [], seen = {};
  const max = Math.min(120, Math.floor((capBits - 24) / 8));
  const push = L => { if (L >= 2 && L <= max && !seen[L]) { seen[L] = 1; out.push(L); } };
  let base = 0;
  for (let i = 0; i < 16; i++) base = (base << 1) | header16[i];
  push(base);
  for (let f = 0; f < 16; f++) {
    const h = header16.slice();
    h[f] ^= 1;
    let L = 0;
    for (let i = 0; i < 16; i++) L = (L << 1) | h[i];
    push(L);
  }
  return out;
}

function finishBits(bits, conf, aggressive, gate) {
  let p = parseBits(bits), fixed = 0;
  if (!p.ok && p.reason === 'checksum') {
    const c = correctBits(bits, conf, p.len, aggressive, gate);
    if (c) { p = c; fixed = c.fixed; }
  }
  if (!p.ok && String(p.reason).indexOf('bad header') === 0 && aggressive && gate && gate.fMean < 60 && gate.minSep > 35) {
    const cands = repairLens(bits.slice(0, 16), bits.length);
    for (const L of cands) {
      const q = parseBitsAt(bits, L);
      if (q.ok) { p = q; fixed = 1; break; }
    }
  }
  return { p, fixed };
}

// -------------------------------------------------------------
// Finder Sweep & Configuration Testing
// -------------------------------------------------------------

export function finderScore(g, w, h, cx, cy, scale, k, density, rot, aspect = 1.0, tilt = 0) {
  const rs = radii(k);
  let s = 0;
  for (let ri = 0; ri < rs.length; ri++) {
    const n = slotCount(rs[ri], density);
    const mid = (Math.PI * 2 / n) * 0.5 + rot;
    s += sample(g, w, h, cx, cy, rs[ri] * scale, mid, aspect, tilt);
  }
  return s / rs.length;
}

export function mirrorFinderScore(g, w, h, cx, cy, scale, k, density, rot, aspect = 1.0, tilt = 0) {
  const rs = radii(k);
  let s = 0;
  for (let ri = 0; ri < rs.length; ri++) {
    const n = slotCount(rs[ri], density);
    s += sample(g, w, h, cx, cy, rs[ri] * scale, rot - (Math.PI * 2 / n) * 0.5, aspect, tilt);
  }
  return s / rs.length;
}

export function tryConfig(g, w, h, cx, cy, scale, k, density, rot, aggressive, aspect = 1.0, tilt = 0) {
  const rs = radii(k), ns = rs.map(r => slotCount(r, density));
  const finderLum = [], rings = [];

  rs.forEach((r, ri) => {
    const n = ns[ri], slot = Math.PI * 2 / n, lums = [];
    for (let j = 1; j < n; j++) {
      const mid = (j / n) * Math.PI * 2 + slot * 0.5 + rot;
      lums.push(median3(g, w, h, cx, cy, r * scale, mid, slot, scale, aspect, tilt));
    }
    const fslot = Math.PI * 2 / n, fmid = fslot * 0.5 + rot;
    finderLum.push(median3(g, w, h, cx, cy, r * scale, fmid, fslot, scale, aspect, tilt));
    rings.push({ lums, ri });
  });

  const flat = [].concat(...rings.map(rg => rg.lums)).concat(finderLum);
  const kmAll = kmeans2(flat);
  if (kmAll.sep < 10) return { ok: false, reason: 'low contrast' };

  let minSep = 1e9;
  const ringThr = rings.map(rg => {
    const o = otsuThr(rg.lums);
    if (o.sep < minSep) minSep = o.sep;
    if (o.sep >= 16) {
      return o.thr * 0.7 + kmAll.thr * 0.3;
    }
    return kmAll.thr;
  });

  const fMean = finderLum.reduce((a, b) => a + b, 0) / finderLum.length;
  if (fMean > 165 || fMean > kmAll.thr + 5) return { ok: false, reason: 'finder not dark' };
  const darkFinders = finderLum.filter(v => v <= kmAll.thr + 18).length;
  if (darkFinders < Math.max(2, k - 1)) return { ok: false, reason: 'broken finder' };

  const bits = [], conf = [], pos = [];
  rings.forEach((rg, ri) => {
    const thr = ringThr[ri];
    rg.lums.forEach((v, idx) => {
      bits.push(v < thr ? 1 : 0);
      conf.push(Math.abs(v - thr));
      pos.push({ ri, j: idx + 1, v, thr });
    });
  });

  const f = finishBits(bits, conf, aggressive, { fMean, minSep: kmAll.sep });
  if (!f.p.ok) return { ok: false, reason: f.p.reason };
  const p = f.p;
  return {
    ok: true,
    text: p.text,
    bytes: p.bytes,
    len: p.len,
    chk: p.chk,
    rings: k,
    density,
    rot,
    sep: kmAll.sep,
    fMean,
    bits,
    pos,
    fixed: f.fixed,
    mirrored: false
  };
}

export function tryConfigMirrored(g, w, h, cx, cy, scale, k, density, rot, aggressive) {
  const rs = radii(k), ns = rs.map(r => slotCount(r, density));
  const finderLum = [], rings = [];

  rs.forEach((r, ri) => {
    const n = ns[ri], slot = Math.PI * 2 / n, lums = [];
    for (let jp = 0; jp <= n - 2; jp++) {
      const mid = jp * slot + slot * 0.5 + rot;
      lums.push({ v: median3(g, w, h, cx, cy, r * scale, mid, slot, scale), jp });
    }
    finderLum.push(median3(g, w, h, cx, cy, r * scale, rot - slot * 0.5, slot, scale));
    rings.push({ lums, ri });
  });

  const flat = [].concat(...rings.map(rg => rg.lums.map(e => e.v))).concat(finderLum);
  const kmAll = kmeans2(flat);
  if (kmAll.sep < 10) return { ok: false, reason: 'low contrast' };

  let minSep = 1e9;
  const ringThr = rings.map(rg => {
    const o = otsuThr(rg.lums.map(e => e.v));
    if (o.sep < minSep) minSep = o.sep;
    if (o.sep >= 16) {
      return o.thr * 0.7 + kmAll.thr * 0.3;
    }
    return kmAll.thr;
  });

  const fMean = finderLum.reduce((a, b) => a + b, 0) / finderLum.length;
  if (fMean > 165 || fMean > kmAll.thr + 5) return { ok: false, reason: 'finder not dark' };
  const darkFinders = finderLum.filter(v => v <= kmAll.thr + 18).length;
  if (darkFinders < Math.max(2, k - 1)) return { ok: false, reason: 'broken finder' };

  const bits = [], conf = [];
  rings.forEach((rg, ri) => {
    const thr = ringThr[ri];
    for (let p = rg.lums.length - 1; p >= 0; p--) {
      const e = rg.lums[p];
      bits.push(e.v < thr ? 1 : 0);
      conf.push(Math.abs(e.v - thr));
    }
  });

  const f = finishBits(bits, conf, aggressive, { fMean, minSep: kmAll.sep });
  if (!f.p.ok) return { ok: false, reason: f.p.reason };
  const p = f.p;
  return {
    ok: true,
    text: p.text,
    bytes: p.bytes,
    len: p.len,
    chk: p.chk,
    rings: k,
    density,
    rot,
    sep: kmAll.sep,
    fMean,
    bits,
    fixed: f.fixed,
    mirrored: true
  };
}

export function findCenterAndScale(g, w, h) {
  let best = null, bestScore = -1, bestInMean = 0, bestOutMean = 0;
  const minDim = Math.min(w, h);
  const step = Math.max(4, Math.min(12, Math.floor(minDim / 80)));
  const maxBadgeR = Math.floor(minDim * 0.35);
  const minBadgeR = Math.max(10, Math.floor(minDim * 0.025));

  for (let y = 24; y < h - 24; y += step) {
    for (let x = 24; x < w - 24; x += step) {
      for (let r = minBadgeR; r <= maxBadgeR; r += 4) {
        const gapR = 1.15 * r;
        if (x - gapR < 2 || y - gapR < 2 || x + gapR >= w - 2 || y + gapR >= h - 2) continue;

        // Fast 4-point pre-check on inner rim (0.80 * r)
        const in4 = sample(g, w, h, x, y, 0.80 * r, 0) +
                    sample(g, w, h, x, y, 0.80 * r, Math.PI / 2) +
                    sample(g, w, h, x, y, 0.80 * r, Math.PI) +
                    sample(g, w, h, x, y, 0.80 * r, Math.PI * 1.5);
        if (in4 > 4 * 165) continue; // Skip quickly if outer rim is not dark

        let inSum = in4, outSum = 0;
        for (let a = 1; a < 8; a += 2) {
          const th = a * Math.PI / 4;
          inSum += sample(g, w, h, x, y, 0.80 * r, th);
        }
        for (let a = 0; a < 8; a++) {
          const th = a * Math.PI / 4;
          outSum += sample(g, w, h, x, y, 1.12 * r, th);
        }
        const inMean = inSum / 8;
        const outMean = outSum / 8;
        const diff = outMean - inMean;

        if (diff > bestScore && diff > 18 && outMean > inMean * 1.15 && inMean < 165) {
          bestScore = diff;
          bestInMean = inMean;
          bestOutMean = outMean;
          best = { cx: x, cy: y, r, scale: r / CENTER_R, score: diff };
        }
      }
    }
  }

  // Centroid & subpixel edge refinement via radial boundary circle fitting
  // Detects the outer rim transition of the center badge across 24 radial rays.
  // Because rays search strictly at the outer circumference (0.72*r to 1.35*r),
  // internal brand logos or text ("Code", "Pay", Apple logo, avatars) have ZERO impact on centroid accuracy!
  if (best) {
    const roughX = best.cx, roughY = best.cy, roughR = best.r;
    const edgePts = [];
    const numRays = 24;
    const rStart = roughR * 0.72;
    const rEnd = roughR * 1.35;
    const rStep = Math.max(0.5, roughR * 0.02);

    for (let i = 0; i < numRays; i++) {
      const ang = (i * 2 * Math.PI) / numRays;
      const cosA = fastCos(ang), sinA = fastSin(ang);
      let maxGrad = -1, bestR = roughR;

      for (let r = rStart; r <= rEnd; r += rStep) {
        const rIn = r - 2, rOut = r + 2;
        const xIn = (roughX + rIn * cosA + 0.5) | 0;
        const yIn = (roughY + rIn * sinA + 0.5) | 0;
        const xOut = (roughX + rOut * cosA + 0.5) | 0;
        const yOut = (roughY + rOut * sinA + 0.5) | 0;

        if (xIn >= 0 && xIn < w && yIn >= 0 && yIn < h && xOut >= 0 && xOut < w && yOut >= 0 && yOut < h) {
          const grad = g[yOut * w + xOut] - g[yIn * w + xIn];
          if (grad > maxGrad) {
            maxGrad = grad;
            bestR = r;
          }
        }
      }
      if (maxGrad > 20) {
        edgePts.push({
          x: roughX + bestR * cosA,
          y: roughY + bestR * sinA
        });
      }
    }

    if (edgePts.length >= 8) {
      // Algebraic circle fit (Kasa method):
      // (x - xc)^2 + (y - yc)^2 = R^2  =>  2*x*xc + 2*y*yc + C = x^2 + y^2
      const N = edgePts.length;
      let sX = 0, sY = 0, sX2 = 0, sY2 = 0, sXY = 0, sZ = 0, sXZ = 0, sYZ = 0;
      for (let i = 0; i < N; i++) {
        const px = edgePts[i].x, py = edgePts[i].y;
        const pz = px * px + py * py;
        sX += px; sY += py;
        sX2 += px * px; sY2 += py * py; sXY += px * py;
        sZ += pz; sXZ += px * pz; sYZ += py * pz;
      }

      const A = sX2, B = sXY, C_ = sX;
      const D = sXY, E = sY2, F = sY;
      const G_ = sX,  H = sY,  I = N;

      const det = A * (E * I - F * H) - B * (D * I - F * G_) + C_ * (D * H - E * G_);
      if (Math.abs(det) > 1e-5) {
        const inv00 = (E * I - F * H) / det;
        const inv01 = (C_ * H - B * I) / det;
        const inv02 = (B * F - C_ * E) / det;
        const inv10 = (F * G_ - D * I) / det;
        const inv11 = (A * I - C_ * G_) / det;
        const inv12 = (C_ * D - A * F) / det;

        const twoXc = inv00 * sXZ + inv01 * sYZ + inv02 * sZ;
        const twoYc = inv10 * sXZ + inv11 * sYZ + inv12 * sZ;
        const fitXc = twoXc / 2;
        const fitYc = twoYc / 2;

        let rSum = 0;
        for (let i = 0; i < N; i++) {
          rSum += Math.hypot(edgePts[i].x - fitXc, edgePts[i].y - fitYc);
        }
        const fitR = rSum / N;

        // Validate that fit is physically plausible (within 35% of rough position)
        if (Math.hypot(fitXc - roughX, fitYc - roughY) < roughR * 0.35 && fitR > 8 && fitR < Math.min(w, h) * 0.4) {
          return {
            cx: fitXc,
            cy: fitYc,
            r: fitR,
            scale: fitR / CENTER_R,
            score: bestScore
          };
        }
      }
    }
    return best;
  }
  return null;
}

export function estimateDisc(g, w, h, cx, cy) {
  const edges = [];
  const maxR = Math.floor(Math.min(w, h) / 2) - 2;
  for (let a = 0; a < 8; a++) {
    const th = a * Math.PI / 4;
    let prev = null, maxG = -1, edge = -1;
    for (let r = maxR; r >= 20; r -= 2) {
      const v = sample(g, w, h, cx, cy, r, th);
      if (prev !== null) {
        const gr = Math.abs(v - prev);
        if (gr > maxG) { maxG = gr; edge = r; }
      }
      prev = v;
    }
    if (maxG > 50) edges.push(edge);
  }
  if (edges.length < 5) return null;
  edges.sort((x, y) => x - y);
  const med = edges[Math.floor(edges.length / 2)];
  if (edges.filter(e => Math.abs(e - med) < med * 0.15).length < 5) return null;
  return med / DISC_R;
}

// -------------------------------------------------------------
// High-Level Scanning API
// -------------------------------------------------------------

/**
 * Scan an ImageData object (or { data, width, height })
 * @param {ImageData|Object} imageData
 * @param {Object} [options]
 * @returns {Object} { ok: boolean, text?: string, bytes?: number[], rings?: number, ... }
 */
export function scanImageData(imageData, options = {}) {
  const w = imageData.width;
  const h = imageData.height;

  // Auto-downsample ultra high-res images (> 600px) directly in pure JS (for 10x faster execution and robust decoding)
  const maxDim = options.maxScanDimension || 600;
  if ((w > maxDim || h > maxDim) && imageData.data) {
    const sc = Math.min(maxDim / w, maxDim / h);
    const targetW = Math.round(w * sc);
    const targetH = Math.round(h * sc);
    const downData = new Uint8ClampedArray(targetW * targetH * 4);
    const srcData = imageData.data;
    const invSc = 1 / sc;
    for (let dy = 0; dy < targetH; dy++) {
      const sy = Math.min(h - 1, Math.round(dy * invSc));
      const rowOffset = dy * targetW * 4;
      const srcRowOffset = sy * w * 4;
      for (let dx = 0; dx < targetW; dx++) {
        const sx = Math.min(w - 1, Math.round(dx * invSc));
        const dstIdx = rowOffset + dx * 4;
        const srcIdx = srcRowOffset + sx * 4;
        downData[dstIdx] = srcData[srcIdx];
        downData[dstIdx + 1] = srcData[srcIdx + 1];
        downData[dstIdx + 2] = srcData[srcIdx + 2];
        downData[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }
    const downOpts = { ...options };
    if (options.cx !== undefined) downOpts.cx = options.cx * sc;
    if (options.cy !== undefined) downOpts.cy = options.cy * sc;
    if (options.scale !== undefined) downOpts.scale = options.scale * sc;
    const res = scanImageData({ data: downData, width: targetW, height: targetH }, downOpts);
    if (res && res.ok && res.cx !== undefined) {
      return {
        ...res,
        cx: res.cx / sc,
        cy: res.cy / sc,
        scale: res.scale / sc
      };
    }
    return res;
  }

  // 1. Primary pass with standard luminance
  const gLum = toGrayscale(imageData, 'luminance');
  let res = _scanGrayscaleBuffer(gLum, w, h, options);
  if (res && res.ok) return res;

  // 2. High-chroma color contrast pass (for colorful themes like Cyber, Neon, Sunset)
  if (imageData.data && options.colorPass !== false) {
    const d = imageData.data;
    const step = Math.max(4, Math.floor(d.length / (128 * 4))) * 4;
    let hasColor = false;
    for (let i = 0; i < d.length; i += step) {
      if (Math.abs(d[i] - d[i + 1]) > 25 || Math.abs(d[i] - d[i + 2]) > 25) {
        hasColor = true;
        break;
      }
    }
    if (hasColor) {
      // Red channel provides maximum contrast for purple/pink/red/magenta themes
      const gRed = toGrayscale(imageData, 'red');
      res = _scanGrayscaleBuffer(gRed, w, h, options);
      if (res && res.ok) return res;

      // Blue channel provides maximum contrast for yellow/orange/green themes
      const gBlue = toGrayscale(imageData, 'blue');
      res = _scanGrayscaleBuffer(gBlue, w, h, options);
      if (res && res.ok) return res;
    }
  }

  return res || { ok: false, reason: 'No valid circular code detected' };
}

function _scanGrayscaleBuffer(g, w, h, options = {}) {
  let cx = options.cx;
  let cy = options.cy;
  const aggr = options.aggressive !== undefined ? options.aggressive : true;

  // Auto center & scale detection from black center badge
  let scales = [];
  if (options.scale) {
    scales = [options.scale];
    if (cx === undefined) cx = w / 2;
    if (cy === undefined) cy = h / 2;
  } else {
    const autoDet = findCenterAndScale(g, w, h);
    if (autoDet) {
      if (cx === undefined) cx = autoDet.cx;
      if (cy === undefined) cy = autoDet.cy;
      // Prioritize 1.0 exact scale first!
      scales = [1.0, 0.98, 1.02, 0.95, 1.05, 0.91, 1.09, 0.85, 1.15].map(f => autoDet.scale * f);
    } else {
      if (cx === undefined) cx = w / 2;
      if (cy === undefined) cy = h / 2;
      const est = estimateDisc(g, w, h, cx, cy);
      const base = Math.min(w, h) / 400;
      scales = est
        ? [1.0, 0.98, 1.02, 0.94, 1.06, 0.88, 1.12].map(f => est * f)
        : [1.0, 0.94, 1.06, 0.86, 1.14, 0.76, 1.24].map(f => base * f);
    }
  }

  // Build prioritized search order:
  // 1. Standard density 0.35 across all supported ring counts (5 to 14, and 4)
  // 2. Density 0.37 across all supported ring counts
  // 3. Fallbacks
  const cfgs = [];
  if (options.rings && options.density) {
    for (const sc of scales) cfgs.push({ sc, k: options.rings, d: options.density });
  } else {
    const allRings = [5, 6, 7, 8, 9, 10, 11, 12, 4, 13, 14, 3];
    for (const sc of scales) {
      for (const k of allRings) cfgs.push({ sc, k, d: 0.35 });
    }
    for (const sc of scales) {
      for (const k of allRings) cfgs.push({ sc, k, d: 0.37 });
    }
    for (const sc of scales) {
      for (const d of [0.40, 0.45, 0.49, 0.33, 0.38, 0.52]) {
        for (const k of [5, 6, 7, 8, 9, 10, 4, 11, 12]) cfgs.push({ sc, k, d });
      }
    }
  }

  let bestClean = null, bestCorrected = null, bestFinder = null, bestFinderS = 1e9;

  for (const { sc, k, d } of cfgs) {
    // Fast candidate finder sweep with 1.8° step (200 steps per sweep)
    // Uses pre-allocated flat TypedArrays instead of creating 200 object instances!
    const numSteps = 200; // 360 / 1.8
    const stepRad = (Math.PI * 2) / numSteps;
    
    let bestLocalS = 1e9, bestLocalRot = 0;
    for (let step = 0; step < numSteps; step++) {
      const rot = step * stepRad;
      const s = finderScore(g, w, h, cx, cy, sc, k, d, rot);
      SCRATCH_CANDS_ROT[step] = rot;
      SCRATCH_CANDS_SCORE[step] = s;
      SCRATCH_CANDS_IDX[step] = step;
      if (s < bestLocalS) {
        bestLocalS = s;
        bestLocalRot = rot;
      }
    }
    
    if (bestLocalS < bestFinderS) {
      bestFinderS = bestLocalS;
      bestFinder = { sc, k, d, rot: bestLocalRot };
    }
    if (bestLocalS > 195) continue;

    // Fast top-4 selection via partial selection sort (no full 200-item array sort!)
    for (let top = 0; top < 4; top++) {
      let minPos = top;
      let minScore = SCRATCH_CANDS_SCORE[SCRATCH_CANDS_IDX[top]];
      for (let scan = top + 1; scan < numSteps; scan++) {
        const scVal = SCRATCH_CANDS_SCORE[SCRATCH_CANDS_IDX[scan]];
        if (scVal < minScore) {
          minScore = scVal;
          minPos = scan;
        }
      }
      if (minPos !== top) {
        const tmp = SCRATCH_CANDS_IDX[top];
        SCRATCH_CANDS_IDX[top] = SCRATCH_CANDS_IDX[minPos];
        SCRATCH_CANDS_IDX[minPos] = tmp;
      }
    }

    // Try top candidates with fine angular refinement
    for (let cIdx = 0; cIdx < 4; cIdx++) {
      const bestIdx = SCRATCH_CANDS_IDX[cIdx];
      const candRot = SCRATCH_CANDS_ROT[bestIdx];
      for (const off of [0, 0.6, -0.6, 1.2, -1.2]) {
        const r = tryConfig(g, w, h, cx, cy, sc, k, d, candRot + off * (Math.PI / 180), aggr);
        if (r.ok) {
          const score = r.sep - r.fMean;
          if (!r.fixed) {
            if (!bestClean || score > (bestClean.sep - bestClean.fMean)) {
              bestClean = { ...r, cx, cy, scale: sc };
            }
            break;
          } else {
            if (!bestCorrected || score > (bestCorrected.sep - bestCorrected.fMean)) {
              bestCorrected = { ...r, cx, cy, scale: sc };
            }
          }
        }
      }
      if (bestClean) break;
    }
    if (bestClean) break;
  }

  let best = bestClean || bestCorrected;

  // Mirrored fallback
  if (!best && options.mirrored !== false) {
    const ks = [5, 6, 7, 4], densities = [0.35, 0.37, 0.40];
    for (const sc of scales.slice(0, 3)) {
      for (const k of ks.slice(0, 3)) {
        for (const d of densities.slice(0, 3)) {
          const mcands = [];
          for (let deg = 0; deg < 360; deg += 2.5) {
            const rot = deg * Math.PI / 180;
            mcands.push({ rot, s: mirrorFinderScore(g, w, h, cx, cy, sc, k, d, rot) });
          }
          mcands.sort((a, b) => a.s - b.s);
          for (const c of mcands.slice(0, 4)) {
            for (const off of [0, 0.8, -0.8]) {
              const r = tryConfigMirrored(g, w, h, cx, cy, sc, k, d, c.rot + off * Math.PI / 180, aggr);
              if (r.ok) {
                return { ...r, cx, cy, scale: sc };
              }
            }
          }
        }
      }
    }
  }

  // Perspective tilt recovery (camera angled 15° to 30°)
  if (!best && options.perspective) {
    const pAspects = [0.91, 0.84];
    const pTilts = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4];
    for (const aspect of pAspects) {
      for (const tilt of pTilts) {
        for (const { sc, k, d } of cfgs.slice(0, 8)) {
          const cands = [];
          for (let deg = 0; deg < 360; deg += 3.6) {
            const rot = deg * Math.PI / 180;
            cands.push({ rot, s: finderScore(g, w, h, cx, cy, sc, k, d, rot, aspect, tilt) });
          }
          cands.sort((a, b) => a.s - b.s);
          if (cands[0].s > 185) continue;
          for (const c of cands.slice(0, 2)) {
            const r = tryConfig(g, w, h, cx, cy, sc, k, d, c.rot, aggr, aspect, tilt);
            if (r.ok) {
              return { ...r, cx, cy, scale: sc, aspect, tilt };
            }
          }
        }
      }
    }
  }

  return best || { ok: false, reason: 'No valid circular code detected' };
}

/**
 * Scan an HTMLCanvasElement or 2D Context
 */
export function scanCanvas(canvas, options = {}) {
  const ctx = canvas.getContext ? canvas.getContext('2d') : canvas;
  const cv = canvas.canvas || canvas;
  
  // Auto-downsample ultra high-res canvases (> 600px) for 10x faster decoding and seamless large image support
  const maxDim = options.maxScanDimension || 600;
  if ((cv.width > maxDim || cv.height > maxDim) && typeof document !== 'undefined' && document.createElement) {
    const sc = Math.min(maxDim / cv.width, maxDim / cv.height);
    const targetW = Math.round(cv.width * sc);
    const targetH = Math.round(cv.height * sc);
    const downCv = document.createElement('canvas');
    downCv.width = targetW;
    downCv.height = targetH;
    const downCtx = downCv.getContext('2d');
    downCtx.imageSmoothingEnabled = true;
    downCtx.imageSmoothingQuality = 'high';
    downCtx.drawImage(cv, 0, 0, targetW, targetH);
    const imgData = downCtx.getImageData(0, 0, targetW, targetH);
    const res = scanImageData(imgData, options);
    if (res && res.ok && res.cx !== undefined) {
      return {
        ...res,
        cx: res.cx / sc,
        cy: res.cy / sc,
        scale: res.scale / sc
      };
    }
    return res;
  }

  const imgData = ctx.getImageData(0, 0, cv.width, cv.height);
  return scanImageData(imgData, options);
}

/**
 * Scan an HTMLImageElement or Image URL
 */
export async function scanImage(source, options = {}) {
  if (typeof source === 'string') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(scanCanvas(c, options));
      };
      img.onerror = () => reject(new Error('Failed to load image: ' + source));
      img.src = source;
    });
  }
  const c = document.createElement('canvas');
  c.width = source.naturalWidth || source.width;
  c.height = source.naturalHeight || source.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(source, 0, 0);
  return scanCanvas(c, options);
}

// -------------------------------------------------------------
// Live Camera Scanner Controller
// -------------------------------------------------------------

export class CircleScanner {
  constructor(options = {}) {
    this.options = Object.assign({
      fps: 12,
      facingMode: 'environment',
      aggressive: true,
      perspective: true,
      confirmCount: 2,
      useWorker: false,
      workerUrl: 'scanner-worker.js',
      onScan: null,
      onError: null
    }, options);

    this.stream = null;
    this.video = null;
    this.timer = null;
    this.isScanning = false;
    this.workCanvas = null;
    this.workCtx = null;
    this.worker = null;
    this.workerBusy = false;
    this.pendingText = null;
    this.pendingCount = 0;
    this.lastDecodedText = null;
    this.torchOn = false;
  }

  async start(videoElement, onScan, onError) {
    if (onScan) this.options.onScan = onScan;
    if (onError) this.options.onError = onError;
    this.video = videoElement;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.options.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      this.video.srcObject = this.stream;
      await this.video.play();

      this.workCanvas = document.createElement('canvas');
      this.workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true });
      this.isScanning = true;

      if (this.options.useWorker && typeof Worker !== 'undefined') {
        try {
          this.worker = new Worker(this.options.workerUrl, { type: 'module' });
          this.worker.onmessage = (e) => this._onWorkerMessage(e);
          this.workerBusy = false;
        } catch (wErr) {
          console.warn('CircleScanner: Could not initialize Web Worker, falling back to main thread.', wErr);
          this.worker = null;
        }
      }

      const interval = Math.max(80, Math.floor(1000 / this.options.fps));
      this.timer = setInterval(() => this._tick(), interval);
      return true;
    } catch (err) {
      if (this.options.onError) this.options.onError(err);
      throw err;
    }
  }

  hasTorch() {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    const caps = (typeof track.getCapabilities === 'function') ? track.getCapabilities() : {};
    return !!caps.torch;
  }

  async setTorch(on) {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ torch: !!on }] });
      this.torchOn = !!on;
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggleTorch() {
    return this.setTorch(!this.torchOn);
  }

  setWasmEngine(wasmEngine) {
    this.options.wasmEngine = wasmEngine;
  }

  _tick() {
    if (!this.isScanning || !this.video || !this.video.videoWidth || this.isProcessing) return;

    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const side = Math.min(vw, vh);
    const S = 480; // High resolution 480x480 for sharp dash separation
    this.workCanvas.width = S;
    this.workCanvas.height = S;

    const sx = (vw - side) / 2, sy = (vh - side) / 2;
    this.workCtx.drawImage(this.video, sx, sy, side, side, 0, 0, S, S);
    const imgData = this.workCtx.getImageData(0, 0, S, S);

    if (this.worker) {
      if (this.workerBusy) return; // Drop frame to maintain 60 FPS UI responsiveness
      this.workerBusy = true;
      this.worker.postMessage({
        type: 'scan',
        imageData: imgData,
        options: {
          aggressive: this.options.aggressive,
          perspective: this.options.perspective
        }
      });
      return;
    }

    this.isProcessing = true;
    const t0 = performance.now();
    let res;
    if (this.options.wasmEngine && typeof this.options.wasmEngine.scan_frame_wasm === 'function') {
      res = this.options.wasmEngine.scan_frame_wasm(imgData.data, S, S, this.options.aggressive !== false);
    } else {
      res = scanImageData(imgData, {
        aggressive: this.options.aggressive,
        perspective: this.options.perspective
      });
    }
    const t1 = performance.now();
    this.isProcessing = false;

    if (this.options.onFrame) {
      this.options.onFrame({ ms: t1 - t0, fps: Math.round(1000 / Math.max(t1 - t0, 1)), result: res });
    }

    this._handleScanResult(res);
  }

  _onWorkerMessage(e) {
    this.workerBusy = false;
    const { ok, result } = e.data || {};
    if (ok && result) {
      this._handleScanResult(result);
    }
  }

  _handleScanResult(res) {
    if (!this.isScanning) return;
    if (res.ok) {
      if (res.text === this.pendingText) {
        this.pendingCount++;
      } else {
        this.pendingText = res.text;
        this.pendingCount = 1;
      }

      // Clean uncorrected decode with good separation confirms in 1 frame (instant decode!)
      const reqConfirm = (res.fixed === 0 && res.sep > 20) ? 1 : this.options.confirmCount;
      if (this.pendingCount >= reqConfirm) {
        if (this.lastDecodedText !== res.text) {
          this.lastDecodedText = res.text;
          if (this.options.onScan) this.options.onScan(res);
        }
      }
    }
  }

  stop() {
    this.isScanning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerBusy = false;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.pendingText = null;
    this.pendingCount = 0;
    this.lastDecodedText = null;
    this.torchOn = false;
  }
}

// Global exposure for non-module usage
if (typeof window !== 'undefined') {
  window.CircleScanner = {
    scanImageData,
    scanCanvas,
    scanImage,
    CircleScanner,
    VERSION
  };
}
