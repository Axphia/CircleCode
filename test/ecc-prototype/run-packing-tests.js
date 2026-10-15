import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { MODES, modeCapacity } from './packing.js';
import { encodeFrame, decodeFrame, crc32, buildEccModel, frameFromModel } from './codec.js';
import { encode } from './reed-solomon.js';
import { mulberry32 } from './legacy/circle-code.js';

// Fixed vectors check packing independently of the matching unpacker.
assert.deepEqual(encodeFrame('01234567', 31, 'numeric').slice(0, 9), Uint8Array.of(0x43, 0x43, 0x21, 0, 8, 0x03, 0x15, 0x98, 0x60));
assert.deepEqual(encodeFrame('AB', 31, 'alphanumeric').slice(5, 7), Uint8Array.of(0x39, 0xa0));
assert.equal(encodeFrame('A', 31, 'alphanumeric')[5], 0x28);
assert.equal(decodeFrame(encodeFrame('0123')).mode, 'numeric');
assert.equal(decodeFrame(encodeFrame('TABLE-24')).mode, 'alphanumeric');
assert.equal(decodeFrame(encodeFrame('Table-24')).mode, 'utf8');
assert.equal(decodeFrame(encodeFrame('')).mode, 'utf8');
for (let value = 0; value < 1000; value++) {
  const text = String(value).padStart(3, '0');
  const frame = encodeFrame(text, 31, 'numeric');
  assert.equal((frame[5] << 2) | (frame[6] >>> 6), value);
  assert.equal(decodeFrame(frame).text, text);
}
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
for (let first = 0; first < 45; first++) for (let second = 0; second < 45; second++) {
  const text = alphabet[first] + alphabet[second];
  const frame = encodeFrame(text, 31, 'alphanumeric');
  assert.equal((frame[5] << 3) | (frame[6] >>> 5), first * 45 + second);
  assert.equal(decodeFrame(frame).text, text);
}

let capacityCases = 0;
for (const mode of MODES) for (let available = 0; available <= 238; available++) {
  const maximum = modeCapacity(mode, available);
  const payload = mode === 'binary' ? new Uint8Array(maximum).fill(255) : (mode === 'numeric' ? '0' : 'A').repeat(maximum);
  const decoded = decodeFrame(encodeFrame(payload, available + 17, mode));
  assert.equal(decoded.ok, true, `${mode} capacity=${available}`);
  if (mode === 'binary') assert.deepEqual(decoded.bytes, payload);
  else assert.equal(decoded.text, payload);
  const tooLong = mode === 'binary' ? new Uint8Array(maximum + 1) : payload + '1';
  assert.throws(() => encodeFrame(tooLong, available + 17, mode), /capacity/);
  capacityCases++;
}
for (const text of ['0', '00', '000', '0000', '01234567', 'A', 'AB', 'ABC', 'ABCD', 'กขค😀', '\ufeffABC', '123\n', 'AB\n']) {
  assert.equal(decodeFrame(encodeFrame(text)).text, text);
}
for (let offset = 0; offset < 256; offset += 238) {
  const bytes = Uint8Array.from({ length: Math.min(238, 256 - offset) }, (_, index) => index + offset);
  const before = bytes.slice();
  const decoded = decodeFrame(encodeFrame(bytes, 255));
  assert.equal(decoded.mode, 'binary');
  assert.equal(decoded.text, undefined);
  assert.deepEqual(decoded.bytes, bytes);
  assert.deepEqual(bytes, before);
}
for (const [payload, mode] of [['12a', 'numeric'], ['123\n', 'numeric'], ['abc', 'alphanumeric'], ['A', 'binary'], [new Uint8Array(1), 'utf8'], ['A', 'unknown'], ['\ud800', 'utf8']]) {
  assert.throws(() => encodeFrame(payload, 31, mode));
}

function modifiedFrame(mode, length, payloadBytes) {
  const data = new Uint8Array(23);
  data.set([0x43, 0x43, mode, length >>> 8, length & 255]);
  data.set(payloadBytes, 5);
  new DataView(data.buffer).setUint32(19, crc32(data.subarray(0, 19)));
  return encode(data);
}
for (const [mode, length, bytes, reason] of [
  [0x24, 1, [0], /Unsupported/],
  [0x21, 3, [255, 192], /numeric group/],
  [0x21, 1, [240], /numeric group/],
  [0x22, 2, [255, 224], /alphanumeric group/],
  [0x22, 1, [252], /alphanumeric group/],
  [0x21, 1, [1], /padding/],
  [0x23, 0, [1], /padding/],
  [0x20, 1, [255], /encoded data was not valid|UTF-8/i],
  [0x21, 65535, [], /payload length/]
]) assert.match(decodeFrame(modifiedFrame(mode, length, bytes)).reason, reason);

// A captured original V2 frame must remain readable without regenerating it with the new encoder.
export const legacyFrame = Uint8Array.of(67, 67, 2, 0, 8, 84, 97, 98, 108, 101, 45, 50, 52,
  0, 0, 0, 0, 0, 0, 211, 57, 156, 24, 46, 138, 204, 23, 190, 242, 121, 91);
assert.equal(decodeFrame(legacyFrame).text, 'Table-24');
assert.equal(decodeFrame(legacyFrame).format, '2');

const random = mulberry32(0x5041434b);
const samples = [['numeric', '000' + '1234567890'.repeat(3)], ['alphanumeric', 'TABLE-24/ABC:12$%*+-'],
  ['utf8', 'กขค😀'], ['binary', Uint8Array.of(0, 255, 128, 1, 0, 13, 10, 254, 65)]];
let recoveryCases = 0;
for (const [mode, payload] of samples) {
  const frame = encodeFrame(payload, 31, mode);
  for (let trial = 0; trial < 100; trial++) {
    const damaged = frame.slice();
    const positions = new Set();
    while (positions.size < 1 + trial % 4) positions.add(Math.floor(random() * frame.length));
    for (const position of positions) damaged[position] ^= 1 + Math.floor(random() * 255);
    const decoded = decodeFrame(damaged);
    assert.equal(decoded.ok, true, `${mode} recovery case ${trial}`);
    assert.equal(decoded.correctedBytes, positions.size);
    assert.deepEqual(decoded.codeword, frame);
    if (mode === 'binary') assert.deepEqual(decoded.bytes, payload);
    else assert.equal(decoded.text, payload);
    recoveryCases++;
  }
  const model = buildEccModel(payload, 7, mode);
  assert.deepEqual(frameFromModel(model), frame);
  if (mode === 'binary') {
    const first = model.payload[0];
    payload[0] ^= 1;
    assert.equal(model.payload[0], first, 'Model must own its binary input');
    payload[0] ^= 1;
  }
}
const summary = { format: '2.1', numericVectorChecked: true, alphanumericPairs: 2025, numericGroups: 1000,
  capacityCases, recoveryCases, arbitraryByteValues: 256, legacyV2Readable: true,
  sevenRingCapacity: Object.fromEntries(MODES.map(mode => [mode, modeCapacity(mode, 14)])) };
mkdirSync(new URL('./outputs/', import.meta.url), { recursive: true });
writeFileSync(new URL('./outputs/packing-results.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(`PASS: mode vectors, 1000 numeric groups, 2025 alphanumeric pairs, ${capacityCases} capacity boundaries, ${recoveryCases} damaged frames, raw bytes and legacy V2`);
