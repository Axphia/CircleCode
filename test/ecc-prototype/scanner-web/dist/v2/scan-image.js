import { radii, slotCount } from '../legacy/circle-code.js';
import { toGrayscale, findCenterAndScale, finderScore, mirrorFinderScore, median3, kmeans2 } from '../legacy/circle-scanner.js';
import { decodeFrame } from './codec.js';

// shortcut: density remains 0.35; automatic ring search covers the supported V2 encoder geometry.
export function scanExperimentalImage(image, rings = 7) {
  const { width, height, data } = image || {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 32 || height < 32 ||
      width > 2048 || height > 2048 || !(data instanceof Uint8Array || data instanceof Uint8ClampedArray) || data.length !== width * height * 4 ||
      !Number.isInteger(rings) || (rings !== 0 && (rings < 4 || rings > 14))) {
    return { ok: false, reason: 'Invalid image or ring count' };
  }
  const grayscale = toGrayscale(image);
  const ringCounts = rings === 0 ? [7, 5, 6, 8, 9, 10, 4, 11, 12, 13, 14] : [rings];
  for (const inverted of [false, true]) {
    const pixels = inverted ? grayscale.map(value => 255 - value) : grayscale;
    const center = findCenterAndScale(pixels, width, height);
    if (!center) continue;
    for (const count of ringCounts) {
      const ringRadii = radii(count);
      for (const factor of [1, 0.99, 1.01, 0.98, 1.02]) {
        const scale = center.scale * factor;
        for (const mirrored of [false, true]) {
          const scoreFinder = mirrored ? mirrorFinderScore : finderScore;
          const angles = Array.from({ length: 200 }, (_, i) => {
            const rotation = i * Math.PI / 100;
            return { rotation, score: scoreFinder(pixels, width, height, center.cx, center.cy, scale, count, 0.35, rotation) };
          }).sort((a, b) => a.score - b.score);
          for (const angle of angles.slice(0, 6)) for (const offset of [0, 0.45, -0.45, 0.9, -0.9]) {
            const rotation = angle.rotation + offset * Math.PI / 180;
            const values = [], finders = [];
            for (const radius of ringRadii) {
              const count = slotCount(radius, 0.35);
              const slotAngle = 2 * Math.PI / count;
              for (let j = 0; j < count; j++) {
                const theta = rotation + (mirrored ? -1 : 1) * (j + 0.5) * slotAngle;
                const value = median3(pixels, width, height, center.cx, center.cy, radius * scale, theta, slotAngle, scale);
                (j ? values : finders).push(value);
              }
            }
            const threshold = kmeans2([...values, ...finders]);
            if (threshold.sep < 20 || finders.filter(value => value < threshold.thr).length < count - 1) continue;
            const frame = new Uint8Array(Math.floor(values.length / 8));
            for (let i = 0; i < frame.length * 8; i++) if (values[i] < threshold.thr) frame[i >>> 3] |= 1 << (7 - (i & 7));
            const result = decodeFrame(frame);
            if (result.ok) return { ...result, rings: count, inverted, mirrored, rotation, scale, cx: center.cx, cy: center.cy };
          }
        }
      }
    }
  }
  return { ok: false, reason: 'No experimental ECC frame recovered' };
}
