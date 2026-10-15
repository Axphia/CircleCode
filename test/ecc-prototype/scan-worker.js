import { scanExperimentalImage } from './scan-image.js';

self.onmessage = ({ data }) => {
  const { id, image, rings } = data;
  const start = performance.now();
  try {
    self.postMessage({ id, result: scanExperimentalImage(image, rings), ms: performance.now() - start });
  } catch (error) {
    self.postMessage({ id, result: { ok: false, reason: error.message }, ms: performance.now() - start });
  }
};
