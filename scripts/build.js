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
  .replace(/^export\s+/gm, '')
  .replace(/export\s+default\s+[^;]+;/g, '');

const scannerCode = fs.readFileSync(path.resolve(root, 'circle-scanner.js'), 'utf8')
  .replace(/^export\s+/gm, '')
  .replace(/export\s+default\s+[^;]+;/g, '');

const umdBundle = `/**
 * CircleCode v1.0.0 — Universal Module Definition (UMD)
 * https://circlecode.js.org
 * (c) 2026 Axphia Project. MIT License.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    root.CircleCode = exports;
    root.CircleScanner = exports.CircleScanner;
  }
}(typeof self !== 'undefined' ? self : this, function () {
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
    radii: radii,
    slotCount: slotCount,
    buildModel: buildModel,
    renderToCanvas: renderToCanvas,
    renderToSVG: renderToSVG,
    parsePayloadBits: parsePayloadBits,
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

// Simple minifier (remove comments, excessive whitespace)
const minified = umdBundle
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\n\s*\n/g, '\n');

fs.writeFileSync(path.resolve(distDir, 'circlecode.min.js'), minified, 'utf8');
console.log('✓ Created dist/circlecode.min.js (' + (Buffer.byteLength(minified) / 1024).toFixed(1) + ' KB)');
console.log('Build completed successfully!');
