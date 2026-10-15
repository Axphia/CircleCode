import assert from 'node:assert/strict';
import { Camera } from './scanner-web/src/camera.js';
import { ScannerClient, confirmFrame } from './scanner-web/src/scanner-client.js';

const fakeVideo = () => ({ srcObject: null, play: async () => {}, pause() {} });
let released = 0;
const stream = () => ({ getTracks: () => [{ stop() { released++; } }] });
let allow;
const camera = new Camera({ getUserMedia: () => new Promise(resolve => { allow = resolve; }) });
const pending = camera.start(fakeVideo());
camera.stop();
allow(stream());
assert.equal(await pending, false);
assert.equal(released, 1, 'A late permission result must release its camera track');
const video = fakeVideo();
const ready = camera.start(video);
allow(stream());
assert.equal(await ready, true);
camera.stop();
assert.equal(video.srcObject, null);
assert.equal(released, 2);
const failed = new Camera({ getUserMedia: async () => stream() });
await assert.rejects(failed.start({ ...fakeVideo(), play: async () => { throw new Error('play rejected'); } }), /play rejected/);
assert.equal(released, 3, 'Failed playback must release the stream');
await assert.rejects(new Camera({ getUserMedia: async () => { throw new Error('permission denied'); } }).start(fakeVideo()), /permission denied/);

let worker;
class FakeWorker {
  constructor() { worker = this; this.terminated = false; }
  postMessage(message) { this.sent = message; }
  terminate() { this.terminated = true; }
}
const client = new ScannerClient(FakeWorker);
const image = () => ({ width: 32, height: 32, data: new Uint8ClampedArray(4096) });
const cancelled = client.scan(image(), 7, 'auto');
await assert.rejects(client.scan(image(), 7, 'auto'), /ก่อนหน้า/);
client.stop();
await assert.rejects(cancelled, /ยกเลิก/);
assert.equal(worker.terminated, true);
const good = client.scan(image(), 7, 'js');
worker.onmessage({ data: { id: worker.sent.id - 1, result: { ok: true } } });
assert.notEqual(client.pending, null, 'Ignore stale results');
worker.onmessage({ data: { id: worker.sent.id, result: { ok: true, text: 'AB' } } });
assert.equal((await good).result.text, 'AB');
const error = client.scan(image(), 7, 'rust');
worker.onerror();
await assert.rejects(error, /JavaScript/);
client.stop();
const staleWorker = worker;
const next = client.scan(image(), 7, 'js');
staleWorker.onerror();
assert.equal(worker.terminated, false, 'An old worker error must not stop its replacement');
worker.onmessage({ data: { id: worker.sent.id, result: { ok: true } } });
await next;
client.stop();
const decoded = { ok: true, format: '2.1', mode: 'binary', bytes: Uint8Array.of(0,255) };
const first = confirmFrame({ key: '', count: 0 }, decoded);
assert.equal(first.confirmed, false);
assert.equal(confirmFrame(first, decoded).confirmed, true);
assert.equal(confirmFrame(first, { ...decoded, bytes: Uint8Array.of(0,254) }).confirmed, false);
assert.equal(confirmFrame(confirmFrame(first, { ok: false }), decoded).confirmed, false);
console.log('PASS: camera cancellation, late permissions, playback failure, track cleanup, single-flight worker and stale reply protection');
