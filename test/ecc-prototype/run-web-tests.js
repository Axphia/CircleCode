import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { buildEccModel, frameFromModel, modelWithFrame } from './codec.js';
import { renderToSVG } from './legacy/circle-code.js';
import { legacyFrame } from './run-packing-tests.js';

// Exercise the browser worker's message protocol with the same clamped pixels as ImageData.
const replies = [];
globalThis.self = { postMessage: reply => replies.push(reply) };
try {
  await import('./scan-worker.js');
  const imageFile = fileURLToPath(new URL('./outputs/optical/circle-damaged.png', import.meta.url));
  const pixels = execFileSync('magick', [imageFile, '-depth', '8', 'rgba:-'], { maxBuffer: 4 * 1024 * 1024 });
  self.onmessage({ data: { id: 7, rings: 7, image: { width: 480, height: 480, data: new Uint8ClampedArray(pixels) } } });
  assert.equal(replies[0].id, 7);
  assert.equal(replies[0].result.ok, true);
  assert.equal(replies[0].result.text, 'Table-24');
  assert.equal(replies[0].result.correctedBytes, 4);
  assert.ok(Number.isFinite(replies[0].ms));
  self.onmessage({ data: { id: 8, rings: 7, image: null } });
  assert.equal(replies[1].id, 8);
  assert.equal(replies[1].result.ok, false);
  self.onmessage({ data: { id: 9, rings: 7, image: { get width() { throw new Error('bad image'); } } } });
  assert.equal(replies[2].id, 9);
  assert.equal(replies[2].result.reason, 'bad image');
  const results = [];
  const samples = [['numeric', '000' + '1234567890'.repeat(3)], ['alphanumeric', 'TABLE-24/ABC:12$%*+-'],
    ['utf8', 'กขค😀'], ['binary', Uint8Array.of(0, 255, 128, 1, 0, 13, 10, 254, 65, 0, 255, 128, 32, 127)]];
  for (const [mode, payload] of samples) for (const style of ['circle', 'loncle']) for (const damaged of [false, true]) {
    const model = buildEccModel(payload, 7, mode);
    const frame = frameFromModel(model);
    if (damaged) for (const index of [0, 5, 10, 30]) frame[index] ^= 255;
    const svg = renderToSVG(modelWithFrame(model, frame), { style, center: 'Code', bg: '#ffffff' });
    const data = execFileSync('magick', ['-background', 'white', '-font', 'Arial', 'svg:-', '-resize', '480x480', '-depth', '8', 'rgba:-'],
      { input: svg, maxBuffer: 4 * 1024 * 1024 });
    const id = 10 + results.length;
    self.onmessage({ data: { id, rings: 7, image: { width: 480, height: 480, data: new Uint8ClampedArray(data) } } });
    const reply = replies.at(-1);
    assert.equal(reply.id, id);
    assert.equal(reply.result.ok, true, `${mode}/${style}/damaged=${damaged}: ${reply.result.reason}`);
    assert.equal(reply.result.mode, mode);
    assert.equal(reply.result.correctedBytes, damaged ? 4 : 0);
    if (mode === 'binary') assert.deepEqual(reply.result.bytes, payload);
    else assert.equal(reply.result.text, payload);
    results.push({ mode, style, damaged, correctedBytes: reply.result.correctedBytes });
  }
  const legacySvg = renderToSVG(modelWithFrame(buildEccModel('Table-24'), legacyFrame), { center: 'Code', bg: '#ffffff' });
  const legacyPixels = execFileSync('magick', ['-background', 'white', '-font', 'Arial', 'svg:-', '-resize', '480x480', '-depth', '8', 'rgba:-'],
    { input: legacySvg, maxBuffer: 4 * 1024 * 1024 });
  self.onmessage({ data: { id: 100, rings: 7, image: { width: 480, height: 480, data: new Uint8ClampedArray(legacyPixels) } } });
  assert.equal(replies.at(-1).result.text, 'Table-24');
  assert.equal(replies.at(-1).result.format, '2');
  writeFileSync(new URL('./outputs/web-results.json', import.meta.url), JSON.stringify({ workerProtocol: true, legacyV2Optical: true, results }, null, 2) + '\n');
} finally {
  delete globalThis.self;
}
console.log('PASS: worker protocol, 16 optical cases across four modes, legacy V2 image, invalid input and exception replies');
