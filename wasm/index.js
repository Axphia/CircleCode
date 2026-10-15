/**
 * CircleCode WebAssembly Module
 * High-performance native Rust core for circular barcode scanning.
 */

import initWasm, { scan_frame_wasm } from './circlecode_core.js';

export { initWasm, scan_frame_wasm };

let initialized = false;

/**
 * Ensures the WebAssembly module is compiled and initialized.
 * In browser: loads the wasm file via fetch or relative path.
 * In Node.js: reads from the local wasm binary if needed.
 */
export async function ensureWasm(wasmBinaryOrUrl) {
  if (initialized) return true;
  await initWasm(wasmBinaryOrUrl);
  initialized = true;
  return true;
}

/**
 * Scan an ImageData or raw RGBA buffer using the compiled Rust WASM engine.
 * @param {Uint8Array|Uint8ClampedArray} rgba - Pixel buffer (width * height * 4)
 * @param {number} width - Frame width
 * @param {number} height - Frame height
 * @param {boolean} [aggressive=true] - Enable 1-bit and 2-bit error correction
 * @returns {Object} Result object with { ok, text, bytes, len, rings, ... }
 */
export function scanFrameWasm(rgba, width, height, aggressive = true) {
  return scan_frame_wasm(rgba, width, height, aggressive);
}

export default {
  initWasm,
  ensureWasm,
  scanFrameWasm
};
