import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodeFrame, decodeFrame } from './codec.js';
import { scanExperimentalImage } from './scan-image.js';
import { mulberry32 } from './legacy/circle-code.js';

await import('./run-tests.js');
const frame = encodeFrame('AB');
let twoBitCases = 0, singleByteCases = 0;
for (let first = 0; first < frame.length * 8; first++) {
  for (let second = first + 1; second < frame.length * 8; second++) {
    const damaged = frame.slice();
    damaged[first >>> 3] ^= 1 << (first & 7);
    damaged[second >>> 3] ^= 1 << (second & 7);
    assert.deepEqual(decodeFrame(damaged).codeword, frame, `Two-bit recovery failed: ${first}, ${second}`);
    twoBitCases++;
  }
}
console.log(`PASS: all ${twoBitCases} distinct pairs of flipped bits`);
for (let position = 0; position < frame.length; position++) {
  for (let mask = 1; mask < 256; mask++) {
    const damaged = frame.slice();
    damaged[position] ^= mask;
    assert.deepEqual(decodeFrame(damaged).codeword, frame);
    singleByteCases++;
  }
}
const random = mulberry32(0x52414e44);
const randomFrameCases = 2000;
for (let i = 0; i < randomFrameCases; i++) {
  const candidate = Uint8Array.from({ length: frame.length }, () => Math.floor(random() * 256));
  assert.equal(decodeFrame(candidate).ok, false, `Random frame ${i} was accepted`);
}
console.log(`PASS: ${singleByteCases} single-byte patterns; ${randomFrameCases} random frames rejected`);
for (const image of [null, { width: 0, height: 0, data: new Uint8Array() }, { width: 480, height: 480, data: new Uint8Array(4) }]) {
  assert.equal(scanExperimentalImage(image).reason, 'Invalid image or ring count');
}

execFileSync(process.env.ECC_PYTHON || 'python', [fileURLToPath(new URL('./make-optical-fixtures.py', import.meta.url))], { stdio: 'inherit' });
const cases = JSON.parse(readFileSync(new URL('./outputs/optical/cases.json', import.meta.url), 'utf8'));
const results = [], failures = [];
for (const test of cases) {
  const pixels = execFileSync('magick', [test.file, '-depth', '8', 'rgba:-'], { maxBuffer: test.width * test.height * 4 + 4096 });
  const start = performance.now();
  const result = scanExperimentalImage({ data: pixels, width: test.width, height: test.height });
  if (test.name === 'circle-clean') {
    assert.equal(scanExperimentalImage({ data: new Uint8ClampedArray(pixels), width: test.width, height: test.height }).text, 'Table-24');
  }
  const row = {
    name: test.name, group: test.group, expected: test.expected, ok: result.ok,
    text: result.text, correctedBytes: result.correctedBytes, inverted: result.inverted,
    mirrored: result.mirrored, rotationDegrees: result.rotation * 180 / Math.PI,
    decodeMs: Math.round(performance.now() - start), reason: result.reason
  };
  results.push(row);
  if (result.ok && result.text !== 'Table-24') failures.push(`${test.name}: WRONG TEXT ${JSON.stringify(result.text)}`);
  if (test.expected !== null && result.ok !== test.expected) failures.push(`${test.name}: expected ok=${test.expected}, actual=${result.ok}`);
  console.log(`${result.ok ? 'READ' : 'REJECT'} ${test.name}: ${result.text ?? result.reason} (${row.decodeMs} ms)`);
}
const summary = {
  experimental: true,
  twoBitCases, singleByteCases, randomFramesRejected: randomFrameCases,
  opticalCases: results.length,
  opticalScannerTested: true,
  requiredReadable: cases.filter(test => test.expected === true).length,
  requiredReadablePassed: results.filter(test => test.expected === true && test.ok).length,
  negativesRejected: results.filter(test => test.expected === false && !test.ok).length,
  wrongTextsAccepted: results.filter(test => test.ok && test.text !== 'Table-24').length,
  exploratoryScratchCases: results.filter(test => test.expected === null),
  failures,
  scope: 'Rasterized SVG fixtures; automatic center/scale/rotation/polarity/mirror search; ring count fixed at 7; no camera test',
  results
};
writeFileSync(new URL('./outputs/more-results.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
assert.equal(failures.length, 0, failures.join('\n'));
console.log('PASS: extended bit tests and optical fixture tests; see outputs/more-results.json');
