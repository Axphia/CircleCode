import { scanImageV2 } from './v2/index.js';
import { ensureWasm, scanV2Wasm } from './wasm/index.js';

let wasmReady = false;
let wasmUnavailable = false;
self.onmessage = async ({ data }) => {
  const { id, image, rings, engine } = data;
  try {
    if (!['auto', 'rust', 'js'].includes(engine) || !Number.isInteger(rings) || (rings !== 0 && (rings < 4 || rings > 14)) ||
      !image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 32 || image.height < 32 ||
      image.width > 960 || image.height > 960 || !(image.data instanceof Uint8ClampedArray || image.data instanceof Uint8Array) || image.data.length !== image.width * image.height * 4) {
      throw new Error('ภาพหรือการตั้งค่าตัวอ่านไม่ถูกต้อง');
    }
    let actualEngine = engine === 'js' ? 'js' : 'rust';
    let fallback = '';
    if (engine === 'auto' && wasmUnavailable) { actualEngine = 'js'; fallback = 'ใช้ JavaScript สำรอง เนื่องจาก WASM ไม่พร้อม'; }
    if (actualEngine === 'rust' && !wasmReady) {
      try { await ensureWasm(); wasmReady = true; }
      catch (error) {
        if (engine === 'rust') throw new Error('โหลด Rust/WASM ไม่สำเร็จ ลองเลือก JavaScript');
        wasmUnavailable = true;
        actualEngine = 'js';
        fallback = 'โหลด WASM ไม่สำเร็จ ใช้ JavaScript สำรอง';
      }
    }
    const start = performance.now();
    const decoded = actualEngine === 'rust' ? scanV2Wasm(image.data, image.width, image.height, rings) : scanImageV2(image, rings);
    const { codeword, ...result } = decoded;
    if (result.ok) result.bytes = new Uint8Array(result.bytes);
    self.postMessage({ id, result, engine: actualEngine, fallback, ms: performance.now() - start });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'อ่านภาพไม่สำเร็จ' });
  }
};
