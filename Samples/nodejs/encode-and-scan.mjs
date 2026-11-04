/**
 * CircleCode Node.js ESM Sample App
 * Run: node Samples/nodejs/encode-and-scan.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, renderToSVG, getRuns, scanImageData } from '../../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Encode a payload into a 5-ring model
const payload = 'https://circlecode.js.org';
const model = buildModel(payload, { rings: 7, density: 0.35 });
console.log(`Encoded "${payload}" (${model.bytes} bytes, ${model.used}/${model.cap} bits across ${model.rings.length} rings)`);

// 2. Render SVG in LonCle mode (connected sweeping arcs)
const svgLonCle = renderToSVG(model, {
  style: 'loncle',
  dark: '#0071e3',
  light: '#e5e5ea',
  center: 'Pay',
  centerBg: '#000000'
});

const outSvgPath = path.join(__dirname, 'sample-loncle.svg');
fs.writeFileSync(outSvgPath, svgLonCle, 'utf8');
console.log(`Saved LonCle SVG barcode to: ${outSvgPath}`);

// 3. Render a synthetic 400x400 RGBA image buffer and scan it back
function renderRgbaBuffer(m, w = 400, h = 400, rot = 0.35) {
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  const cx = w / 2, cy = h / 2, scale = w / 400;
  const setPx = (x, y, v) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; rgba[i + 3] = 255;
  };
  const badgeR = 42 * scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= badgeR ** 2) setPx(x, y, 20);
    }
  }
  m.rings.forEach(rg => {
    const r = rg.r * scale, n = rg.slots.length, slot = (Math.PI * 2) / n;
    const bits = rg.slots.map(sl => (sl.finder || sl.bit === 1) ? 1 : 0);
    getRuns(bits).forEach(({ start, len, full }) => {
      const a0 = full ? rot : (rot + (start / n) * Math.PI * 2 + slot * 0.15);
      const a1 = full ? (rot + Math.PI * 2) : (a0 + (len - 1) * slot + slot * 0.70);
      for (let th = a0; th <= a1; th += 0.003) {
        for (let dr = -3.2 * scale; dr <= 3.2 * scale; dr += 0.7 * scale) {
          setPx(Math.round(cx + (r + dr) * Math.cos(th)), Math.round(cy + (r + dr) * Math.sin(th)), 20);
        }
      }
    });
  });
  return { data: rgba, width: w, height: h };
}

const imageData = renderRgbaBuffer(model, 400, 400, 0.35);
const scanResult = scanImageData(imageData);
console.log('Scan Result:', scanResult);

