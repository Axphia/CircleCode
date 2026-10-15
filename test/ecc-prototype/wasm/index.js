/**
 * CircleCode WebAssembly Module
 * High-performance native Rust core for circular barcode scanning.
 */

import initWasm, { scan_frame_wasm, scan_v2_wasm, decode_v2_frame_wasm } from './circlecode_core.js';

export { initWasm, scan_frame_wasm, scan_v2_wasm, decode_v2_frame_wasm };

let initialization = null;

/**
 * Ensures the WebAssembly module is compiled and initialized.
 * In browser: loads the wasm file via fetch or relative path.
 * In Node.js: reads from the local wasm binary if needed.
 */
export async function ensureWasm(wasmBinaryOrUrl) {
  if (!initialization) initialization = initWasm(wasmBinaryOrUrl).then(() => true).catch(error => { initialization = null; throw error; });
  return initialization;
}

export function scanV2Wasm(rgba, width, height, rings = 0) {
  return scan_v2_wasm(rgba, width, height, rings);
}

export function decodeV2FrameWasm(frame) { return decode_v2_frame_wasm(frame); }

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
  scanV2Wasm,
  decodeV2FrameWasm,
  scanFrameWasm
};
