import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureWasm, scanV2Wasm, decodeV2FrameWasm } from './wasm/index.js';
import { encodeFrame, decodeFrame, buildEccModel, frameFromModel, modelWithFrame, scanImageV2 } from './v2/index.js';
import { renderToSVG, mulberry32 } from './legacy/circle-code.js';

await ensureWasm({ module_or_path: readFileSync(new URL('./wasm/circlecode_core_bg.wasm', import.meta.url)) });
const random = mulberry32(0x52555354);
const samples = ['000' + '1234567890'.repeat(3), 'TABLE-24/ABC:12$%*+-', 'กขค😀', Uint8Array.of(0,255,128,1,0,13,10,254,65,0,255,128,32,127)];
let frames = 0;
for (const payload of samples) for (let trial = 0; trial < 500; trial++) {
  const frame = encodeFrame(payload);
  const positions = new Set();
  while (positions.size < trial % 5) positions.add(Math.floor(random() * frame.length));
  for (const index of positions) frame[index] ^= 1 + Math.floor(random() * 255);
  const js = decodeFrame(frame), rust = decodeV2FrameWasm(frame);
  assert.equal(rust.ok, js.ok);
  assert.equal(rust.text ?? undefined, js.text);
  assert.equal(rust.mode, js.mode);
  assert.equal(rust.correctedBytes, js.correctedBytes);
  assert.deepEqual(new Uint8Array(rust.bytes), js.bytes);
  frames++;
}
for (let i = 0; i < 200; i++) {
  const frame = Uint8Array.from({ length: 31 }, () => Math.floor(random() * 256));
  assert.equal(decodeV2FrameWasm(frame).ok, false);
}
for (const frame of [new Uint8Array(), new Uint8Array(16), new Uint8Array(256)]) assert.equal(decodeV2FrameWasm(frame).ok, false);
assert.equal(scanV2Wasm(new Uint8Array(), 0xffffffff, 480, 7).ok, false);

const cases = JSON.parse(readFileSync(new URL('./outputs/optical/cases.json', import.meta.url)));
const results = [];
for (const test of cases) {
  const file = new URL(`./outputs/optical/${test.file.split(/[/\\]/).at(-1)}`, import.meta.url);
  const pixels = execFileSync('magick', [fileURLToPath(file), '-depth', '8', 'rgba:-'], { maxBuffer: 4 * 2048 * 2048 });
  const start = performance.now();
  const result = scanV2Wasm(pixels, test.width, test.height, 7);
  if (test.expected !== null) assert.equal(result.ok, test.expected, `${test.name}: ${result.reason}`);
  if (result.ok) assert.equal(result.text, 'Table-24', test.name);
  results.push({ name: test.name, ok: result.ok, ms: Math.round(performance.now() - start) });
  console.log(`RUST ${result.ok ? 'READ' : 'REJECT'} ${test.name}`);
}
let modeImages = 0;
for (const payload of samples) for (const style of ['circle', 'loncle']) {
  const model = buildEccModel(payload);
  const frame = frameFromModel(model);
  for (const index of [0,5,10,30]) frame[index] ^= 255;
  const svg = renderToSVG(modelWithFrame(model, frame), { style, center: 'Code', bg: '#fff' });
  const pixels = execFileSync('magick', ['-font','Arial','svg:-','-resize','480x480','-depth','8','rgba:-'], { input: svg, maxBuffer: 4 * 1024 * 1024 });
  const result = scanV2Wasm(pixels, 480, 480, 0);
  assert.equal(result.ok, true, `${model.mode}/${style}: ${result.reason}`);
  assert.equal(result.mode, model.mode);
  assert.equal(result.correctedBytes, 4);
  assert.deepEqual(new Uint8Array(result.bytes), typeof payload === 'string' ? new TextEncoder().encode(payload) : payload);
  modeImages++;
}
let automaticRings = 0;
for (let rings = 4; rings <= 14; rings++) {
  const model = buildEccModel(rings === 4 ? '' : 'AB', rings);
  const svg = renderToSVG(model, { center: 'Code', bg: '#fff' });
  const data = execFileSync('magick', ['-font','Arial','svg:-','-resize','480x480','-depth','8','rgba:-'], { input: svg, maxBuffer: 4 * 1024 * 1024 });
  const rust = scanV2Wasm(data, 480, 480, 0);
  const js = scanImageV2({ data, width: 480, height: 480 }, 0);
  assert.equal(rust.ok, true, `Rust auto rings=${rings}`);
  assert.equal(js.ok, true, `JS auto rings=${rings}`);
  assert.equal(rust.rings, rings);
  assert.equal(js.rings, rings);
  assert.equal(rust.text, rings === 4 ? '' : 'AB');
  assert.equal(js.text, rust.text);
  automaticRings++;
}
writeFileSync(new URL('./outputs/rust-results.json', import.meta.url), JSON.stringify({ frames, rejectedRandom: 200, optical: results, modeImages, automaticRings }, null, 2) + '\n');
console.log(`PASS: Rust/WASM and JS agree on ${frames} damaged frames; ${cases.length} optical fixtures and ${modeImages} mode images`);
