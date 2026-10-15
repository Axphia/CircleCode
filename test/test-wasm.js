import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import { buildModel } from '../index.js';
import init, { scan_frame_wasm } from '../native/rust/pkg/circlecode_core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.resolve(__dirname, '../native/rust/pkg/circlecode_core_bg.wasm');

console.log('--- Testing Full Rust WebAssembly Decoder ---');
console.log('Loading WASM binary from:', wasmPath);

const wasmBytes = fs.readFileSync(wasmPath);
console.log('WASM Binary Size:', (wasmBytes.length / 1024).toFixed(1), 'KB');

await init(wasmBytes);
console.log('✓ WebAssembly module instantiated successfully!');

function renderSyntheticCode(model, w = 400, h = 400, rot = 0.5) {
  const rgba = new Uint8Array(w * h * 4).fill(255);
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

// 1. Test standard payload
const expectedText = 'Table-24';
const model = buildModel(expectedText, { rings: 5, density: 0.35 });
const img = renderSyntheticCode(model, 400, 400, 0.4);

console.log('Running WASM scan on synthetic code ("' + expectedText + '")...');
const t0 = performance.now();
const res = scan_frame_wasm(img.data, img.width, img.height, true);
const t1 = performance.now();

console.log('WASM Execution time:', (t1 - t0).toFixed(2), 'ms');
console.log('WASM Decoded Result:', res);

assert.strictEqual(res.ok, true, 'WASM scanner should succeed');
assert.strictEqual(res.text, expectedText, 'WASM decoded text should match exactly');
console.log('✓ Successfully decoded text: "' + res.text + '"');

// 2. Test long payload
const longText = 'user-12345vvsvssdvdsvsvsdvvsvsvssdvsd';
const mLong = buildModel(longText, { rings: 9, density: 0.35 });
const imgLong = renderSyntheticCode(mLong, 800, 800, 1.1);

console.log('Running WASM scan on long payload ("' + longText + '")...');
const t2 = performance.now();
const resLong = scan_frame_wasm(imgLong.data, imgLong.width, imgLong.height, true);
const t3 = performance.now();

console.log('WASM Execution time (800x800):', (t3 - t2).toFixed(2), 'ms');
console.log('WASM Decoded Long Result:', resLong);

assert.strictEqual(resLong.ok, true, 'WASM scanner should succeed on long payload');
assert.strictEqual(resLong.text, longText, 'WASM decoded text should match long payload');
console.log('✓ Successfully decoded long text: "' + resLong.text + '"');

console.log('🎉 Full Rust WebAssembly Scanner is 100% verified and operational!');
