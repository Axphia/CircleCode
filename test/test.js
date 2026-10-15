import assert from 'assert';
import {
  VERSION,
  buildModel,
  getRuns,
  renderToSVG,
  radii,
  slotCount,
  findCenterAndScale,
  scanImageData
} from '../index.js';

console.log('--- Running CircleCode Package Test Suite ---');
console.log('Version:', VERSION);

// 1. Test radii and slotCount
const r5 = radii(5);
assert.strictEqual(r5.length, 5);
assert.strictEqual(r5[0], 55);
assert.strictEqual(r5[4], 157);
console.log('✓ radii() works');

// 2. Test getRuns (Apple-style contiguous arc grouping with circular wrap-around)
const runs1 = getRuns([1, 1, 0, 1, 1, 1, 1]);
assert.strictEqual(runs1.length, 1);
assert.strictEqual(runs1[0].start, 3);
assert.strictEqual(runs1[0].len, 6);
const runs2 = getRuns([1, 0, 1, 1, 0]);
assert.strictEqual(runs2.length, 2);
assert.strictEqual(runs2[0].start, 2);
assert.strictEqual(runs2[0].len, 2);
console.log('✓ getRuns() works with wrap-around');

// 3. Test Model Generation
const shortText = 'A';
const mShort = buildModel(shortText, { rings: 5, density: 0.35 });
assert.strictEqual(mShort.bytes, 1);
assert.strictEqual(mShort.payload, 'A');
console.log('✓ buildModel(shortText) works');

const standardText = 'Table-24';
const mStd = buildModel(standardText, { rings: 5, density: 0.35 });
assert.strictEqual(mStd.bytes, 8);
console.log('✓ buildModel(standardText) works');

const longText = 'user-12345vvsvssdvdsvsvsdvvsvsvssdvsd';
const mLong = buildModel(longText, { rings: 9, density: 0.35 });
assert.strictEqual(mLong.bytes, 37);
console.log('✓ buildModel(longText) works');

// 4. Test SVG Rendering (Circle and LonCle Modes)
const svgCircle = renderToSVG(mStd, { style: 'circle', dark: '#000', light: '#8e8e93', center: 'Test Table' });
assert.ok(svgCircle.startsWith('<svg'));
assert.ok(svgCircle.includes('Test Table'));
console.log('✓ renderToSVG({ style: "circle" }) works');

const svgLonCle = renderToSVG(mStd, { style: 'loncle', dark: '#000', center: 'Pay' });
assert.ok(svgLonCle.startsWith('<svg'));
assert.ok(svgLonCle.includes('stroke-linecap="round"'));
console.log('✓ renderToSVG({ style: "loncle" }) works');

// 5. Test Synthetic Image Scan Roundtrip (Circle & LonCle Modes)
function renderSyntheticCode(model, w = 400, h = 400, rot = 0.4, style = 'circle') {
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  function setPx(x, y, r, g, b) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = (y * w + x) * 4;
    rgba[idx] = r; rgba[idx + 1] = g; rgba[idx + 2] = b; rgba[idx + 3] = 255;
  }
  const cx = w / 2, cy = h / 2, scale = w / 400;
  const badgeR = 42 * scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= badgeR * badgeR) setPx(x, y, 20, 20, 20);
    }
  }
  if (style === 'loncle') {
    model.rings.forEach(rg => {
      const r = rg.r * scale, n = rg.slots.length, slot = (Math.PI * 2) / n;
      const bits = rg.slots.map(sl => (sl.finder || sl.bit === 1) ? 1 : 0);
      const runs = getRuns(bits);
      runs.forEach(({ start, len, full }) => {
        const a0 = full ? rot : (rot + (start / n) * Math.PI * 2 + slot * 0.15);
        const a1 = full ? (rot + Math.PI * 2) : (a0 + (len - 1) * slot + slot * 0.70);
        for (let th = a0; th <= a1; th += 0.003) {
          for (let dr = -3.2 * scale; dr <= 3.2 * scale; dr += 0.7 * scale) {
            setPx(Math.round(cx + (r + dr) * Math.cos(th)), Math.round(cy + (r + dr) * Math.sin(th)), 20, 20, 20);
          }
        }
      });
    });
  } else {
    model.rings.forEach(rg => {
      const r = rg.r * scale, n = rg.slots.length, slot = (Math.PI * 2) / n;
      rg.slots.forEach((d, j) => {
        const color = d.bit ? 20 : 150;
        const a0 = (j / n) * Math.PI * 2 + rot + slot * 0.28;
        const a1 = a0 + slot * 0.44;
        for (let th = a0; th <= a1; th += 0.003) {
          for (let dr = -3.2 * scale; dr <= 3.2 * scale; dr += 0.7 * scale) {
            setPx(Math.round(cx + (r + dr) * Math.cos(th)), Math.round(cy + (r + dr) * Math.sin(th)), color, color, color);
          }
        }
      });
    });
  }
  return { data: rgba, width: w, height: h };
}

console.log('Testing full scanImageData roundtrips for Circle & LonCle...');

// Test roundtrip: Circle mode
const imgCircle = renderSyntheticCode(mStd, 400, 400, 0.5, 'circle');
const resCircle = scanImageData(imgCircle);
assert.strictEqual(resCircle.ok, true);
assert.strictEqual(resCircle.text, standardText);
console.log('✓ Decoded Circle mode payload ("' + resCircle.text + '")');

// Test roundtrip: LonCle mode
const imgLonCle = renderSyntheticCode(mStd, 400, 400, 0.7, 'loncle');
const resLonCle = scanImageData(imgLonCle);
assert.strictEqual(resLonCle.ok, true);
assert.strictEqual(resLonCle.text, standardText);
console.log('✓ Decoded LonCle mode payload ("' + resLonCle.text + '")');

// Test roundtrip: long payload (9 rings, 800px)
const imgLong = renderSyntheticCode(mLong, 800, 800, 1.2, 'loncle');
const resLong = scanImageData(imgLong);
assert.strictEqual(resLong.ok, true);
assert.strictEqual(resLong.text, longText);
console.log('✓ Decoded long payload ("' + resLong.text + '")');

console.log('🎉 All Circle and LonCle test cases passed cleanly!');
