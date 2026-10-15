/**
 * CircleCode Web Worker Scanner
 * https://circlecode.js.org
 * (c) 2026 Axphia Project. MIT License.
 *
 * Runs circular code decoding in a dedicated background worker thread,
 * ensuring camera preview and UI animations remain smooth at 60 FPS.
 */

import { scanImageData, VERSION } from './circle-scanner.js';

self.onmessage = function (e) {
  const { id, type, imageData, options } = e.data || {};

  if (type === 'ping') {
    self.postMessage({ id, type: 'pong', version: VERSION });
    return;
  }

  if (imageData) {
    try {
      const res = scanImageData(imageData, options || {});
      self.postMessage({ id, ok: true, result: res });
    } catch (err) {
      self.postMessage({ id, ok: false, error: err.message || String(err) });
    }
  }
};
