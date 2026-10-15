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

// 4. Test SVG Rendering (Discrete and Apple Style)
const svg = renderToSVG(mStd, { dark: '#000', light: '#8e8e93', center: 'Test Table' });
assert.ok(svg.startsWith('<svg'));
assert.ok(svg.includes('Test Table'));
console.log('✓ renderToSVG() discrete works');

const svgApple = renderToSVG(mStd, { appleStyle: true, dark: '#000', center: 'Pay' });
assert.ok(svgApple.startsWith('<svg'));
assert.ok(svgApple.includes('stroke-linecap="round"'));
console.log('✓ renderToSVG({ appleStyle: true }) works');

// 4. Test Synthetic Image Scan Roundtrip
function renderSyntheticCode(model, w = 400, h = 400, rot = 0.4) {
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
  return { data: rgba, width: w, height: h };
}

console.log('Testing full scanImageData roundtrips...');

// Test roundtrip: standard
const imgStd = renderSyntheticCode(mStd, 400, 400, 0.5);
const resStd = scanImageData(imgStd);
assert.strictEqual(resStd.ok, true);
assert.strictEqual(resStd.text, standardText);
console.log('✓ Decoded standard payload ("' + resStd.text + '")');

// Test roundtrip: long payload (9 rings, 800px)
const imgLong = renderSyntheticCode(mLong, 800, 800, 1.2);
const resLong = scanImageData(imgLong);
assert.strictEqual(resLong.ok, true);
assert.strictEqual(resLong.text, longText);
console.log('✓ Decoded long payload ("' + resLong.text + '")');

console.log('🎉 All 7 test cases passed cleanly!');
