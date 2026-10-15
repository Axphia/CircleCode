import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { encode, decode } from './reed-solomon.js';
import { crc32, encodeFrame, decodeFrame, buildEccModel, frameFromModel, modelWithFrame, PARITY_BYTES } from './codec.js';
import { buildModel, modelToBits, renderToSVG, mulberry32 } from './legacy/circle-code.js';
import { correctBits } from './legacy/circle-scanner.js';

await import('./run-packing-tests.js');

assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
// ISO 18004 Annex I vector, also published in ZXing's ReedSolomonTestCase.testQRCode.
const referenceData = Uint8Array.of(0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11);
const referenceParity = Uint8Array.of(0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55);
assert.deepEqual(encode(referenceData, 10).slice(-10), referenceParity);
const referenceBlock = Uint8Array.from([...referenceData, ...referenceParity]);
const referenceDamaged = referenceBlock.slice();
for (const position of [0, 5, 10, 18, 25]) referenceDamaged[position] ^= 0x9b;
assert.deepEqual(decode(referenceDamaged, 10).codeword, referenceBlock);
console.log('PASS: independent RS reference vector and CRC32 check value');

for (const text of ['', 'AB', 'Table-24', 'กขค😀']) {
  assert.equal(decodeFrame(encodeFrame(text)).text, text);
}
const clean = encodeFrame('AB', 31, 'utf8');
for (let bit = 0; bit < clean.length * 8; bit++) {
  const damaged = clean.slice();
  damaged[bit >>> 3] ^= 1 << (bit & 7);
  const result = decodeFrame(damaged);
  assert.equal(result.ok, true, `Single-bit repair failed at bit ${bit}: ${result.reason}`);
  assert.equal(result.text, 'AB');
  assert.equal(result.correctedBytes, 1);
  assert.deepEqual(result.codeword, clean);
}
for (let delta = 1; delta < 256; delta++) {
  const damaged = clean.slice();
  damaged[5] ^= delta;
  assert.deepEqual(decodeFrame(damaged).codeword, clean);
}
assert.equal(decodeFrame(encodeFrame('', 17)).text, '');
assert.equal(decodeFrame(encodeFrame('A'.repeat(238), 255)).text, 'A'.repeat(238));
assert.equal(decodeFrame(clean).correctedBytes, 0);
assert.throws(() => encodeFrame('A'.repeat(15), 31, 'utf8'), /capacity/);
assert.throws(() => encodeFrame('ก'.repeat(5)), /capacity/);
assert.throws(() => encodeFrame(123), /text/);
for (const length of [16, 256, 31.5, NaN]) assert.throws(() => encodeFrame('AB', length), /Frame length/);
for (const rings of [0, 15, 5.5, Infinity]) assert.throws(() => buildEccModel('AB', rings), /Rings/);
for (const input of [null, [], new Uint8Array(0), new Uint8Array(256)]) assert.equal(decodeFrame(input).ok, false);
console.log(`PASS: all ${clean.length * 8} single-bit positions, all 255 byte XOR masks, UTF-8, capacity and input checks`);

const random = mulberry32(0x434302);
function damageBytes(frame, count) {
  const damaged = frame.slice();
  const positions = new Set();
  while (positions.size < count) positions.add(Math.floor(random() * frame.length));
  for (const position of positions) damaged[position] ^= 1 + Math.floor(random() * 255);
  return damaged;
}
const stressCases = 2000;
for (let i = 0; i < stressCases; i++) {
  const length = 17 + Math.floor(random() * 239);
  const data = Uint8Array.from({ length: length - PARITY_BYTES }, () => Math.floor(random() * 256));
  const original = encode(data);
  const count = 1 + (i % 4);
  const damaged = damageBytes(original, count);
  const before = damaged.slice();
  const result = decode(damaged);
  assert.deepEqual(result.codeword, original, `RS stress case ${i} failed`);
  assert.deepEqual(damaged, before, 'Decoder must not mutate its input');
  assert.equal(result.correctedBytes, count);
}
console.log(`PASS: ${stressCases} seeded cases with 1–4 corrupted bytes, including header/parity positions and 255-byte blocks`);

const beyondCapacityCases = 200;
for (let i = 0; i < beyondCapacityCases; i++) {
  const damaged = damageBytes(encodeFrame('Table-24'), 5 + (i % 6));
  assert.equal(decodeFrame(damaged).ok, false, `Unexpected acceptance in selected over-limit case ${i}`);
}
const staleCrcData = clean.slice(0, -PARITY_BYTES);
staleCrcData[5] ^= 1;
const validRsInvalidCrc = encode(staleCrcData);
assert.equal(decode(validRsInvalidCrc).correctedBytes, 0);
assert.match(decodeFrame(validRsInvalidCrc).reason, /CRC32 mismatch/);
for (const [index, value, expected] of [[2, 3, /Unsupported/], [4, 255, /Invalid payload length/], [5, 255, /encoded data was not valid|UTF-8/i]]) {
  const data = clean.slice(0, -PARITY_BYTES);
  data[index] = value;
  new DataView(data.buffer).setUint32(data.length - 4, crc32(data.subarray(0, -4)));
  assert.match(decodeFrame(encode(data)).reason, expected);
}
console.log(`PASS: ${beyondCapacityCases} selected over-limit patterns rejected; CRC32 rejects a valid RS block with altered payload`);

const legacyBits = modelToBits(buildModel('AB'));
legacyBits[23] ^= 1;
const legacyResult = correctBits(legacyBits, new Array(legacyBits.length).fill(100), 2, false, { fMean: 20, minSep: 100 });
assert.equal(legacyResult.text, '@B');
const repairedSample = clean.slice();
repairedSample[5] ^= 1;
assert.equal(decodeFrame(repairedSample).text, 'AB');
console.log('PASS: legacy one-bit AB → @B failure reproduced; experimental codec recovers AB');

const model = buildEccModel('Table-24');
const frame = frameFromModel(model);
const damagedFrame = frame.slice();
for (const position of [0, 5, 10, frame.length - 1]) damagedFrame[position] ^= 0xff;
const recovered = decodeFrame(damagedFrame);
assert.equal(recovered.ok, true);
assert.equal(recovered.text, 'Table-24');
assert.equal(recovered.correctedBytes, 4);
assert.deepEqual(recovered.codeword, frame);
assert.equal(decodeFrame(frameFromModel(buildEccModel('สวัสดีไทย 😀', 14))).text, 'สวัสดีไทย 😀');
const states = { clean: model, damaged: modelWithFrame(model, damagedFrame), recovered: modelWithFrame(model, recovered.codeword) };
assert.deepEqual(frameFromModel(states.damaged), damagedFrame);
assert.deepEqual(frameFromModel(model), frame, 'Replacing a frame must preserve the source model');
assert.throws(() => modelWithFrame(model, frame.slice(1)), /Frame length/);
assert.throws(() => modelWithFrame(model, Array.from(frame)), /Frame length/);
const output = new URL('./outputs/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const style of ['circle', 'loncle']) {
  for (const [name, sample] of Object.entries(states)) {
    writeFileSync(new URL(`${style}-${name}.svg`, output), renderToSVG(sample, { style, center: 'Code', bg: '#ffffff' }));
  }
}
const summary = {
  experimental: true,
  format: 'CC version 2.1, mode packing, CRC32/ISO-HDLC, shortened RS GF(256), 8 parity bytes',
  payload: recovered.text,
  ringCount: model.rings.length,
  frameBytes: frame.length,
  maxPayloadBytes: frame.length - 17,
  sampleCorruptedBytes: recovered.correctedBytes,
  sampleFlippedBits: 32,
  singleBitCases: clean.length * 8,
  rsStressCases: stressCases,
  selectedOverLimitCasesRejected: beyondCapacityCases,
  crc32GuardVerified: true,
  opticalScannerTested: false
};
writeFileSync(new URL('results.json', output), JSON.stringify(summary, null, 2) + '\n');
console.log('PASS: circular model round trips and six SVG examples written to test/ecc-prototype/outputs/');
console.log(JSON.stringify(summary, null, 2));
