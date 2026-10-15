# CircleCode

<p align="center">
  <img src="images/logo.png" alt="CircleCode Logo" width="160" style="border-radius: 28px; box-shadow: 0 10px 30px rgba(0, 113, 227, 0.25);" />
</p>
<h2 align="center">High-performance, dependency-free circular barcode codec for Browser and Node.js</h2>
  <p align="center">
    Generate elegant circular barcodes in dual modes (<b>Circle</b> discrete dashes &amp; <b>LonCle</b> connected sweeping arcs) with custom center branding, and scan them across full 360° rotations at native speeds.
  </p>
  <p align="center">
    <a href="https://github.com/Axphia/CircleCode/actions/workflows/build-and-publish.yml"><img src="https://github.com/Axphia/CircleCode/actions/workflows/build-and-publish.yml/badge.svg" alt="CI & Publish" /></a>
    <a href="https://www.npmjs.com/package/@axphia/circlecode"><img src="https://img.shields.io/npm/v/@axphia/circlecode?color=0071e3&style=flat-square" alt="NPM Version" /></a>
    <a href="https://www.jsdelivr.com/package/npm/@axphia/circlecode"><img src="https://data.jsdelivr.com/v1/package/npm/@axphia/circlecode/badge" alt="jsDelivr CDN" /></a>
    <a href="https://circlecode.js.org"><img src="https://img.shields.io/badge/website-circlecode.js.org-0071e3?style=flat-square" alt="Website" /></a>
    <a href="https://github.com/Axphia/CircleCode"><img src="https://img.shields.io/badge/github-Axphia%2FCircleCode-black?style=flat-square&logo=github" alt="GitHub" /></a>
    <img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square" alt="Zero Dependencies" />
    <img src="https://img.shields.io/badge/WASM-Rust_Accelerated-orange?style=flat-square" alt="Rust WASM" />
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
  </p>
</p>

---

## Dual Rendering Modes

CircleCode officially supports two distinct visual styles while maintaining 100% optical scanning compatibility:

| Mode | Option | Visual Representation | Use Case |
| :--- | :--- | :--- | :--- |
| **Circle** | `style: 'circle'` | **Classic discrete dashed pills** for each individual bit slot. | High-contrast industrial labels, technical tags, and classic circular codes. |
| **LonCle** | `style: 'loncle'` *(or `loncle: true`)* | **Continuous sweeping variable-length arcs** merging contiguous 1-bits. | Modern apps, payment cards, luxury merchandise, badges, and posters. |

Both modes preserve exact angular slot center alignment, allowing the same scanner engine to decode both modes with zero configuration.

---

## Documentation

- **[API Reference](docs/API.md)** — Complete function signatures, options, and TypeScript definitions.
- **[Technical Specification](docs/SPECIFICATION.md)** — Format geometry, dash angles, header encoding, and error correction.
- **[System Architecture](docs/ARCHITECTURE.md)** — Dual-engine design, subpixel image pipeline, and threading models.
- **[Native Rust Core](native/README.md)** — Compiling and benchmarking the WebAssembly module.

---

## Engine Selection: Pure JS vs Native Rust WASM

| Engine | Recommended Use Case | Frame Latency | Why use it? |
| :--- | :--- | :--- | :--- |
| **Pure JavaScript** (`circlecode`) | **Web Image Uploads & File Decoding** | ~25–50 ms | **Zero dependencies**, instant loading without fetching `.wasm` binaries. Ideal for `<input type="file">`, drag-and-drop uploads, form attachments, and Node.js server scripts. |
| **Native Rust WASM** (`circlecode/wasm`) | **Real-Time 60 FPS Camera Scanning** | **~2–4 ms** | **Sub-3ms native speed** with SIMD vectorization and zero Garbage Collection pauses. Designed for continuous phone camera feeds without draining battery or causing device overheating. |

---

## Features

- **Dual Visual Modes (Circle & LonCle):** Choose between classic discrete pill dashes or fluid, variable-length sweeping connected ribbons.
- **Zero Dependencies:** Pure vanilla JavaScript default. Runs out-of-the-box in Node.js, modern browsers, PWAs, or embedded webviews.
- **Native WebAssembly Acceleration (`circlecode/wasm`):** Compiled from Rust for sub-3ms frame processing and 300+ FPS decoding.
- **Non-Blocking Web Worker:** Dedicated background worker (`scanner-worker.js`) decouples CPU-heavy decoding from the UI thread, ensuring silky smooth 60 FPS camera previews.
- **Perspective & Tilt Recovery:** Automatically corrects for camera angles (15°–30° tilt) and elliptical distortion.
- **Subpixel 360° Scanning Engine:** Dual-centroid edge detection, scale-aware radial search (`dr = 2.2 * scale`), and hybrid Otsu/K-means thresholding for extreme reliability under shadows and glare.
- **Live Camera & Mobile Features:** Integrated torch (flashlight) toggle, digital zoom crop, and 1-frame instant lock when checksum matches.
- **Vector SVG & Canvas Support:** Export crisp, high-resolution SVG markup or render directly to 2D canvas contexts.
- **Center Branding Badge:** Dedicated center circular slot ($R=42$) for brand icons, text, or avatars with zero data occlusion.
- **Dual Module Format:** Full support for ECMAScript Modules (`import`), CommonJS (`require`), TypeScript types (`index.d.ts`), and standalone UMD browser bundle.

---

## Live Demos

- **Generator:** [https://circlecode.js.org/web-use-demo/generator.html](https://circlecode.js.org/web-use-demo/generator.html)
- **Live Camera Scanner (JS):** [https://circlecode.js.org/web-use-demo/scanner.html](https://circlecode.js.org/web-use-demo/scanner.html)
- **Live Camera Scanner (WASM):** [https://circlecode.js.org/web-use-demo/scanner-wasm.html](https://circlecode.js.org/web-use-demo/scanner-wasm.html)
- **WASM Benchmark:** [https://circlecode.js.org/web-use-demo/wasm-demo.html](https://circlecode.js.org/web-use-demo/wasm-demo.html)
- **Comparison Showcase:** [https://circlecode.js.org/web-use-demo/example.html](https://circlecode.js.org/web-use-demo/example.html)
- **Studio Home:** [https://circlecode.js.org](https://circlecode.js.org)

---

## Quick Installation

```bash
# Install from NPM Registry
npm install @axphia/circlecode

# Or install from GitHub Packages (Axphia scope)
npm install @axphia/circlecode --registry=https://npm.pkg.github.com

# yarn
yarn add @axphia/circlecode

# pnpm
pnpm add @axphia/circlecode

# bun
bun add @axphia/circlecode
```

### Standalone Browser CDN

Include directly via script tag in vanilla HTML:

```html
<!-- Standalone UMD Bundle -->
<script src="https://cdn.jsdelivr.net/npm/@axphia/circlecode@1.1.6/dist/circlecode.min.js"></script>
<script>
  const { buildModel, renderToCanvas, renderToSVG, scanCanvas, CircleScanner } = window.CircleCode;
</script>
```

---

## Quick Start

### 1. Generating Codes (Encoder)

#### Render Scalable SVG (LonCle Mode)
```javascript
import { buildModel, renderToSVG } from '@axphia/circlecode';

// 1. Build circular code data model (supports 4 to 14 rings)
const model = buildModel('Table-24', { rings: 5, density: 0.35 });

// 2. Generate pure vector SVG in LonCle mode (connected sweeping arcs)
const svg = renderToSVG(model, {
  style: 'loncle',
  dark: '#0071e3',
  light: '#ffffff',
  center: 'Pay',
  centerBg: '#000000'
});

console.log(svg);
```

#### Render to HTML Canvas (Circle Mode)
```javascript
import { buildModel, renderToCanvas } from '@axphia/circlecode';

const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

const model = buildModel('user-12345', { rings: 5, density: 0.35 });

// Render in Circle mode (classic discrete dashes)
renderToCanvas(model, ctx, 400, {
  style: 'circle',
  dark: '#1d1d1f',
  light: '#8e8e93',
  center: 'MyBrand',
  centerBg: '#000000'
});
```

---

### 2. Pure JavaScript Scanner (Web Image Uploads & File Decoding)

Use the zero-dependency pure JavaScript scanner for user photo uploads, drag-and-drop file inputs, and canvas decoding:

#### Scan Static Image or Canvas Element
```javascript
import { scanCanvas, scanImageData, scanImage } from 'circlecode';

// A) Scan directly from an HTMLCanvasElement
const result = scanCanvas(canvas, { aggressive: false, perspective: true });

if (result.ok) {
  console.log('Decoded payload:', result.text);
  console.log('Rings detected:', result.rings);
  console.log('Rotation angle:', Math.round(result.rot * 180 / Math.PI) + '°');
} else {
  console.error('Scan failed:', result.reason);
}

// B) Scan from an uploaded <img> element or File object
const img = document.querySelector('img#uploadedCode');
const imgResult = await scanImage(img, { aggressive: true });
if (imgResult.ok) {
  console.log('Uploaded image payload:', imgResult.text);
}
```

#### Live Pure JS Camera Scanner (with Web Worker)
```javascript
import { CircleScanner } from 'circlecode';

const videoElement = document.getElementById('cameraVideo');

const scanner = new CircleScanner({
  fps: 12,
  useWorker: true, // Run frame decoding in background worker (60 FPS UI)
  workerUrl: 'scanner-worker.js',
  perspective: true,
  facingMode: 'environment',
  onScan: (result) => {
    console.log('Scanned successfully:', result.text);
    scanner.stop();
  }
});

// Start camera stream
await scanner.start(videoElement);

// Control camera torch
if (scanner.hasTorch()) {
  await scanner.toggleTorch();
}
```

---

### 3. Native Rust WebAssembly (WASM) Scanner (Real-Time 60 FPS Mobile Camera)

For maximum performance on continuous mobile video streams, use the compiled Rust WebAssembly core:

```javascript
import { initWasm, scanFrameWasm } from 'circlecode/wasm';

// 1. Initialize WebAssembly runtime (sub-35 KB binary)
await initWasm();

// 2. Scan continuous camera video frames at native speed (~2-4 ms per frame)
// Pass: grayscale Uint8Array or RGBA pixel buffer, width, height, aggressiveFlag
const result = scanFrameWasm(grayscalePixelBuffer, 480, 480, true);

if (result.ok) {
  console.log('WASM instant lock:', result.text);
  console.log('Payload length:', result.len, 'bytes');
  console.log('Rings detected:', result.rings);
  console.log('Latency:', result.ms, 'ms');
}
```

---

### 4. CommonJS Usage (Node.js)

```javascript
const { buildModel, renderToSVG, scanCanvas } = require('circlecode');

const model = buildModel('Hello World');
const svg = renderToSVG(model, { dark: '#0071e3', light: '#ffffff' });
```

---

## Technical Specifications

| Parameter | Standard Value | Description |
| :--- | :--- | :--- |
| **Rendering Modes** | `Circle`, `LonCle` | Discrete dashes (`style: 'circle'`) vs contiguous sweeping arcs (`style: 'loncle'`) |
| **Center Radius** | `42` (normalized) | Protected circular branding slot for logos / icons |
| **Inner Ring Start** | `55` | Ring 0 start radius |
| **Outer Ring End** | `157` | Outermost ring radius |
| **Disc Edge Radius** | `190` | Outer boundary border |
| **Standard Density** | `0.35` | Dash density parameter ($d = 0.35$) |
| **Ring Counts** | `4` to `14` | Dynamically expandable for payloads up to 50+ bytes |
| **Checksum** | `Modulo-256 Sum` | 8-bit checksum with 1–2 bit mathematical error recovery |
| **Camera Latency** | `~2–4 ms` | Sub-3ms frame processing cycle via compiled Rust WASM |

---

## Development & Testing

```bash
# Clone the repository
git clone https://github.com/Axphia/CircleCode.git
cd CircleCode

# Run JavaScript test suite
npm test

# Run Rust WebAssembly test suite
npm run test:wasm

# Rebuild standalone UMD bundle
npm run build

# Recompile Rust WebAssembly core
npm run build:wasm
```

---

<img src="images/circle-code-1024.png" alt="CircleCode Diagram" width="500">

## License

This project is open-source and available under the [MIT License](LICENSE).

Developed and maintained by [Axphia Project](https://github.com/Axphia).
