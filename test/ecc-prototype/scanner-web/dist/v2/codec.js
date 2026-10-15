import { buildModel, modelToBits } from '../legacy/circle-code.js';
import { encode, decode } from './reed-solomon.js';
import { MODES, packPayload, unpackPayload } from './packing.js';

export const PARITY_BYTES = 8;
const HEADER_BYTES = 5;
const CRC_BYTES = 4;

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function encodeFrame(payload, byteLength = 31, mode = 'auto') {
  if (!Number.isInteger(byteLength) || byteLength < 17 || byteLength > 255) throw new RangeError('Frame length must be 17 to 255 bytes');
  const data = new Uint8Array(byteLength - PARITY_BYTES);
  const maximum = data.length - HEADER_BYTES - CRC_BYTES;
  const packed = packPayload(payload, mode, maximum);
  // 0x02 remains the original V2 UTF-8 frame; 0x20–0x23 identify the V2.1 modes.
  data.set([0x43, 0x43, 0x20 + MODES.indexOf(packed.mode), packed.length >>> 8, packed.length & 255]);
  data.set(packed.packed, HEADER_BYTES);
  new DataView(data.buffer).setUint32(data.length - CRC_BYTES, crc32(data.subarray(0, -CRC_BYTES)));
  return encode(data, PARITY_BYTES);
}

export function decodeFrame(frame) {
  try {
    if (!(frame instanceof Uint8Array) || frame.length < 17 || frame.length > 255) throw new Error('Invalid frame length or type');
    const { codeword, correctedBytes } = decode(frame, PARITY_BYTES);
    const data = codeword.subarray(0, -PARITY_BYTES);
    const expected = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(data.length - CRC_BYTES);
    if (crc32(data.subarray(0, -CRC_BYTES)) !== expected) throw new Error('CRC32 mismatch');
    const mode = data[2] === 2 ? 'utf8' : MODES[data[2] - 0x20];
    if (data[0] !== 0x43 || data[1] !== 0x43 || !mode) throw new Error('Unsupported experimental format');
    const length = (data[3] << 8) | data[4];
    const payload = unpackPayload(mode, length, data.subarray(HEADER_BYTES, -CRC_BYTES));
    return { ok: true, ...payload, format: data[2] === 2 ? '2' : '2.1', correctedBytes, codeword };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

export function buildEccModel(payload, rings = 7, mode = 'auto') {
  if (!Number.isInteger(rings) || rings < 4 || rings > 14) throw new RangeError('Rings must be an integer from 4 to 14');
  const model = buildModel('', { mode: 'art', rings, density: 0.35 });
  const frame = encodeFrame(payload, Math.floor(model.cap / 8), mode);
  const decoded = decodeFrame(frame);
  if (!decoded.ok) throw new Error(decoded.reason);
  return { ...modelWithFrame(model, frame), payload: typeof payload === 'string' ? payload : payload.slice(),
    bytes: decoded.bytes.length, packedBytes: decoded.packedBytes, packedBits: decoded.packedBits,
    payloadLength: decoded.payloadLength, mode: decoded.mode, used: frame.length * 8, version: '2.1' };
}

export function frameFromModel(model) {
  const bits = modelToBits(model);
  if (bits.some(bit => bit !== 0 && bit !== 1)) throw new TypeError('Model bits must be 0 or 1');
  const frame = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < frame.length * 8; i++) frame[i >>> 3] |= bits[i] << (7 - (i & 7));
  return frame;
}

export function modelWithFrame(model, frame) {
  if (!(frame instanceof Uint8Array) || frame.length !== Math.floor(model.cap / 8)) throw new RangeError('Frame length must match the model');
  const copy = structuredClone(model);
  let index = 0;
  for (const ring of copy.rings) for (const slot of ring.slots) {
    if (slot.finder) continue;
    slot.bit = index < frame.length * 8 ? (frame[index >>> 3] >>> (7 - (index & 7))) & 1 : 0;
    index++;
  }
  return copy;
}
