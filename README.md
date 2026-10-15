# CircleCode

<p align="center">
  <img src="https://circlecode.js.org/CNAME" alt="CircleCode Logo" style="display:none;" />
  <h2 align="center">High-performance, dependency-free circular barcode codec for Browser and Node.js</h2>
  <p align="center">
    Inspired by Apple Pay & Apple App Clips codes. Generate elegant circular barcodes with center branding and scan them across full 360° rotations at native speeds.
  </p>
  <p align="center">
    <a href="https://github.com/Axphia/CircleCode/actions/workflows/build-and-publish.yml"><img src="https://github.com/Axphia/CircleCode/actions/workflows/build-and-publish.yml/badge.svg" alt="CI & Publish" /></a>
    <a href="https://www.npmjs.com/package/circlecode"><img src="https://img.shields.io/npm/v/circlecode?color=0071e3&style=flat-square" alt="NPM Version" /></a>
    <a href="https://circlecode.js.org"><img src="https://img.shields.io/badge/website-circlecode.js.org-0071e3?style=flat-square" alt="Website" /></a>
    <a href="https://github.com/Axphia/CircleCode"><img src="https://img.shields.io/badge/github-Axphia%2FCircleCode-black?style=flat-square&logo=github" alt="GitHub" /></a>
    <img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square" alt="Zero Dependencies" />
    <img src="https://img.shields.io/badge/WASM-Rust_Accelerated-orange?style=flat-square" alt="Rust WASM" />
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
  </p>
</p>

---

## 📑 Documentation

- 📖 **[API Reference](docs/API.md)** — Complete function signatures, options, and TypeScript definitions.
- 📐 **[Technical Specification](docs/SPECIFICATION.md)** — Format geometry, dash angles, header encoding, and error correction.
- 🏗️ **[System Architecture](docs/ARCHITECTURE.md)** — Dual-engine design, subpixel image pipeline, and threading models.
- 🦀 **[Native Rust Core](native/README.md)** — Compiling and benchmarking the WebAssembly module.

---

## 🎯 Engine Selection: Pure JS vs Native Rust WASM

| Engine | Recommended Use Case | Frame Latency | Why use it? |
| :--- | :--- | :--- | :--- |
| **🐢 Pure JavaScript** (`circlecode`) | **Web Image Uploads & File Decoding** | ~25–50 ms | **Zero dependencies**, instant loading without fetching `.wasm` binaries. Ideal for `<input type="file">`, drag-and-drop uploads, form attachments, and Node.js server scripts. |
| **⚡ Native Rust WASM** (`circlecode/wasm`) | **Real-Time 60 FPS Camera Scanning** | **~2–4 ms** | **Sub-3ms native speed** with SIMD vectorization and zero Garbage Collection pauses. Designed for continuous phone camera feeds without draining battery or causing device overheating. |

---

## ✨ Features

- 🎨 **Apple Pay & App Clips Aesthetic:** Minimalist circular dash design that feels natural on round packaging, coasters, cards, and luxury brand merchandise.
- ⚡ **Zero Dependencies:** Pure vanilla JavaScript default. Runs out-of-the-box in Node.js, modern browsers, PWAs, or embedded webviews.
- 🦀 **Native WebAssembly Acceleration (`circlecode/wasm`):** Compiled from Rust for sub-3ms frame processing and 300+ FPS decoding.
- 🧵 **Non-Blocking Web Worker:** Dedicated background worker (`scanner-worker.js`) decouples CPU-heavy decoding from the UI thread, ensuring silky smooth 60 FPS camera previews.
- 📐 **Perspective & Tilt Recovery:** Automatically corrects for camera angles (15°–30° tilt) and elliptical distortion.
- 🔍 **Subpixel 360° Scanning Engine:** Dual-centroid edge detection, scale-aware radial search (`dr = 2.2 * scale`), and hybrid Otsu/K-means thresholding for extreme reliability under shadows and glare.
- 📱 **Live Camera & Mobile Features:** Integrated torch (flashlight) toggle, digital zoom crop, and 1-frame instant lock when checksum matches.
- 📐 **Vector SVG & Canvas Support:** Export crisp, high-resolution SVG markup or render directly to 2D canvas contexts.
- 🏷️ **Center Logo Slot:** Dedicated center circular badge (42px standard) for custom logos (Apple Pay, brand icons, avatars, or text) with zero data occlusion.
- 📦 **Dual Module Format:** Full support for ECMAScript Modules (`import`), CommonJS (`require`), TypeScript types (`index.d.ts`), and standalone UMD browser bundle.

---

## 🚀 Live Demos

- **Generator:** [https://circlecode.js.org/generator.html](https://circlecode.js.org/generator.html)
- **Live Camera Scanner (JS):** [https://circlecode.js.org/scanner.html](https://circlecode.js.org/scanner.html)
- **Live Camera Scanner (WASM):** [https://circlecode.js.org/scanner-wasm.html](https://circlecode.js.org/scanner-wasm.html)
- **WASM Benchmark:** [https://circlecode.js.org/wasm-demo.html](https://circlecode.js.org/wasm-demo.html)
- **Studio Home:** [https://circlecode.js.org](https://circlecode.js.org)

---

## 📦 Installation

```bash
# npm
npm install circlecode

# GitHub Packages (Axphia scope)
npm install @axphia/circlecode --registry=https://npm.pkg.github.com

# yarn
yarn add circlecode

# pnpm
pnpm add circlecode

# bun
bun add circlecode
```

### Standalone Browser CDN:

```html
<!-- All-in-One UMD Bundle -->
<script src="https://cdn.jsdelivr.net/npm/circlecode@latest/dist/circlecode.min.js"></script>
```

---

## 🛠️ Quick Start

### 1. Generating Codes (Encoder)

#### Render Scalable SVG
```javascript
import { buildModel, renderToSVG } from 'circlecode';

// 1. Build circular code data model (supports rings from 4 to 14)
const model = buildModel('user-12345vvsvssdvdsvsvsdvvsvsvssdvsd', {
  rings: 9,
  density: 0.35
});

// 2. Generate pure SVG markup
const svg = renderToSVG(model, {
  dark: '#000000',
  light: '#8e8e93',
  center: 'Pay',
  centerBg: '#000000'
});

console.log(svg);
```

#### Render to HTML Canvas
```javascript
import { buildModel, renderToCanvas } from 'circlecode';

const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

const model = buildModel('Table 24', { rings: 5, density: 0.35 });

renderToCanvas(model, ctx, 400, {
  dark: '#1d1d1f',
  light: '#d1d1d6',
  center: 'MyBrand',
  centerBg: '#000000'
});
```

---

### 2. Scanning & Decoding (Decoder)

#### Scan Static Image or Canvas
```javascript
import { scanImageData, scanCanvas, scanImage } from 'circlecode';

// From an Image element
const img = document.querySelector('img#uploadedCode');
const result = await scanImage(img, {
  aggressive: true,
  perspective: true // Compensates for camera tilt angle
});

if (result.ok) {
  console.log('Decoded:', result.text);
  console.log('Rings detected:', result.rings);
  console.log('Rotation angle:', Math.round(result.rot * 180 / Math.PI) + '°');
} else {
  console.error('Scan failed:', result.reason);
}
```

#### Real-Time Camera Scanner (with Web Worker)
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

### 3. Native Rust WebAssembly (WASM) Acceleration

For maximum scanning throughput, use the compiled Rust WebAssembly module directly:

```javascript
import { ensureWasm, scanFrameWasm } from 'circlecode/wasm';

// 1. Initialize WASM runtime (33.7 KB)
await ensureWasm();

// 2. Scan raw RGBA buffer with sub-3ms latency
const result = scanFrameWasm(imageData.data, 480, 480, true);

if (result.ok) {
  console.log('WASM Decoded text:', result.text);
}
```

---

### 4. CommonJS Usage (Node.js)

```javascript
const { buildModel, renderToSVG, scanImageData } = require('circlecode');

const model = buildModel('Hello World');
const svg = renderToSVG(model, { center: 'Pay' });
```

---

## 📊 Technical Specifications

| Parameter | Standard Value | Description |
| :--- | :--- | :--- |
| **Center Radius** | `42` (normalized) | Protected circular branding slot for logos / icons |
| **Inner Ring Start** | `55` | Ring 0 start radius |
| **Outer Ring End** | `157` | Outermost ring radius |
| **Disc Edge Radius** | `190` | Outer white boundary border |
| **Standard Density** | `0.35` | Dash density (Apple Pay specification) |
| **Ring Counts** | `4` to `14` | Dynamically expandable for payloads up to 50+ bytes |
| **Checksum** | `Modulo-256 Sum` | 8-bit checksum with 1–2 bit mathematical error recovery |
| **Framerate** | `12 FPS` | Camera processing cycle (~3ms decode time via WASM) |

---

## 🧪 Development & Testing

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

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

Developed and maintained with ❤️ by [Axphia Project](https://github.com/Axphia).
