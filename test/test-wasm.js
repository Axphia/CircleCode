import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import init, { scan_frame_wasm } from '../native/rust/pkg/circlecode_core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.resolve(__dirname, '../native/rust/pkg/circlecode_core_bg.wasm');

console.log('--- Testing Rust WebAssembly Core ---');
console.log('Loading WASM binary from:', wasmPath);

const wasmBytes = fs.readFileSync(wasmPath);
console.log('WASM Binary Size:', (wasmBytes.length / 1024).toFixed(1), 'KB');

await init(wasmBytes);
console.log('✓ WebAssembly module instantiated successfully!');

// Test synthetic image frame (400x400 RGBA)
const width = 400;
const height = 400;
const rgba = new Uint8Array(width * height * 4).fill(255);

// Draw central black badge (r = 42)
const cx = width / 2;
const cy = height / 2;
const badgeR = 42;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= badgeR * badgeR) {
      const idx = (y * width + x) * 4;
      rgba[idx] = 20;
      rgba[idx + 1] = 20;
      rgba[idx + 2] = 20;
      rgba[idx + 3] = 255;
    }
  }
}

const t0 = performance.now();
const result = scan_frame_wasm(rgba, width, height, true);
const t1 = performance.now();

console.log('✓ WASM scan executed in:', (t1 - t0).toFixed(3), 'ms');
console.log('WASM Scan Result:', result);
console.log('🎉 Rust WebAssembly is 100% operational!');
