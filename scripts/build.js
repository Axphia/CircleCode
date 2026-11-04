import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.resolve(root, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log('Building CircleCode UMD bundle...');

const encoderCode = fs.readFileSync(path.resolve(root, 'circle-code.js'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/export\s+default\s+[^;]+;/g, '')
  .replace(/^export\s+/gm, '');

let scannerCode = fs.readFileSync(path.resolve(root, 'circle-scanner.js'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/export\s+default\s+[^;]+;/g, '')
  .replace(/^export\s+/gm, '');

// Strip duplicate constants and helper declarations already defined by encoderCode
scannerCode = scannerCode
  .replace(/const\s+VERSION\s*=[^;]+;/g, '')
  .replace(/const\s+DISC_R\s*=[^;]+;/g, '')
  .replace(/const\s+R_START\s*=[^;]+;/g, '')
  .replace(/const\s+R_END\s*=[^;]+;/g, '')
  .replace(/const\s+CENTER_R\s*=[^;]+;/g, '')
  .replace(/function\s+radii\s*\([\s\S]*?^}/m, '')
  .replace(/function\s+slotCount\s*\([\s\S]*?^}/m, '');

const pkg = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf8'));

const umdBundle = `/**
 * CircleCode v${pkg.version} — Universal Module Definition (UMD)
 * https://circlecode.js.org
 * (c) 2026 Axphia Project. MIT License.
 */
(function (root, factory) {
  var exports = factory();
  if (typeof define === 'function' && define.amd) {
    define([], function () { return exports; });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  }
  if (typeof root !== 'undefined' && root) {
    root.CircleCode = exports;
    root.CircleScanner = exports.CircleScanner;
  }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)), function () {
  'use strict';

  // --- Encoder ---
  ${encoderCode}

  // --- Scanner ---
  ${scannerCode}

  return {
    VERSION: VERSION,
    DISC_R: DISC_R,
    R_START: R_START,
    R_END: R_END,
    CENTER_R: CENTER_R,
    DASH_OFF: DASH_OFF,
    DASH_LEN: DASH_LEN,
    xmur3: xmur3,
    mulberry32: mulberry32,
    rngFrom: rngFrom,
    radii: radii,
    slotCount: slotCount,
    buildModel: buildModel,
    getRuns: getRuns,
    renderToCanvas: renderToCanvas,
    renderToSVG: renderToSVG,
    modelToBits: modelToBits,
    parsePayloadBits: parsePayloadBits,
    correctBitFlips: correctBitFlips,
    finishBits: finishBits,
    orderMirroredBits: orderMirroredBits,
    otsuThreshold: otsuThreshold,
    kmeansThreshold: kmeansThreshold,
    fastCos: fastCos,
    fastSin: fastSin,
    toGrayscale: toGrayscale,
    sample: sample,
    sampleRadialMin: sampleRadialMin,
    median3: median3,
    otsuThr: otsuThr,
    kmeans2: kmeans2,
    parseBitsAt: parseBitsAt,
    parseBits: parseBits,
    repairLens: repairLens,
    correctBits: correctBits,
    finderScore: finderScore,
    mirrorFinderScore: mirrorFinderScore,
    tryConfig: tryConfig,
    tryConfigMirrored: tryConfigMirrored,
    findCenterAndScale: findCenterAndScale,
    estimateDisc: estimateDisc,
    scanImageData: scanImageData,
    scanCanvas: scanCanvas,
    scanImage: scanImage,
    CircleScanner: CircleScanner
  };
}));
`;

fs.writeFileSync(path.resolve(distDir, 'circlecode.umd.js'), umdBundle, 'utf8');
console.log('✓ Created dist/circlecode.umd.js (' + (Buffer.byteLength(umdBundle) / 1024).toFixed(1) + ' KB)');

fs.writeFileSync(path.resolve(root, 'index.cjs'), umdBundle, 'utf8');
console.log('✓ Created index.cjs (' + (Buffer.byteLength(umdBundle) / 1024).toFixed(1) + ' KB)');

// Simple minifier (remove comments, excessive whitespace)
const minified = umdBundle
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\n\s*\n/g, '\n');

fs.writeFileSync(path.resolve(distDir, 'circlecode.min.js'), minified, 'utf8');
console.log('✓ Created dist/circlecode.min.js (' + (Buffer.byteLength(minified) / 1024).toFixed(1) + ' KB)');
console.log('Build completed successfully!');
