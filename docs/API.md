# CircleCode API Reference (v1.1.6)

`circlecode` provides a unified suite of tools for generating and scanning circular barcodes in dual modes (Circle discrete dashes & LonCle sweeping connected arcs) across Browser, Node.js, and WebAssembly runtimes.

---

## Table of Contents

- [Installation](#installation)
- [Module Exports](#module-exports)
- [Encoder API](#encoder-api)
  - [`buildModel(payload, options)`](#buildmodelpayload-options)
  - [`renderToSVG(model, options)`](#rendertosvgmodel-options)
  - [`renderToCanvas(model, ctx, size, options)`](#rendertocanvasmodel-ctx-size-options)
  - [`radii(k)`](#radiik)
  - [`slotCount(r, density)`](#slotcountr-density)
- [Decoder API (JavaScript)](#decoder-api-javascript)
  - [`scanImageData(imageData, options)`](#scanimagedataimagedata-options)
  - [`scanCanvas(canvas, options)`](#scancanvascanvas-options)
  - [`scanImage(source, options)`](#scanimagesource-options)
  - [`CircleScanner` (Live Camera Controller)](#circlescanner)
- [Native WebAssembly API (`circlecode/wasm`)](#native-webassembly-api-circlecodewasm)
  - [`ensureWasm(wasmBinaryOrUrl)`](#ensurewasmwasmbinaryorurl)
  - [`scanFrameWasm(rgba, width, height, aggressive)`](#scanframewasmrgba-width-height-aggressive)
- [Web Worker API (`circlecode/worker`)](#web-worker-api-circlecodeworker)

---

## Installation

```bash
# npm
npm install circlecode

# yarn
yarn add circlecode

# pnpm
pnpm add circlecode

# bun
bun add circlecode
```

---

## Module Exports

| Import Path | Content | Target Environments |
| :--- | :--- | :--- |
| `circlecode` | Full library (Encoder + Scanner) | Browser, Node.js (ESM & CJS) |
| `circlecode/encoder` | Pure Encoder (SVG & Canvas generator) | Browser, Node.js |
| `circlecode/scanner` | Pure JS Scanner (Image, Canvas, Camera) | Browser, Node.js |
| `circlecode/worker` | Web Worker background scanning script | Modern Browsers |
| `circlecode/wasm` | High-performance Rust WebAssembly engine | Browsers, Node.js (WASM enabled) |

---

## Encoder API

### `buildModel(payload, options)`

Builds the binary data model and slot allocation for a circular barcode.

#### Parameters:
- `payload` (`string`): UTF-8 text or URL to encode.
- `options` (`object`, optional):
  - `rings` (`number`, default: `5`): Number of concentric rings (scanner supports `4` to `14`). The library does not select the ring count automatically; pass a larger value when needed. At density `0.35`, five rings hold at most 19 UTF-8 payload bytes. Oversized payloads throw an error.
  - `density` (`number`, default: `0.35`): Dash frequency per unit radius (default: `0.35`).
  - `mode` (`string`, default: `'data'`): `'data'` or `'art'`.

#### Returns:
```typescript
interface CircleCodeModel {
  rings: Ring[];      // Array of ring geometry and slot data
  cap: number;        // Total usable bit capacity
  used: number;       // Number of data bits consumed
  bytes: number;      // Total payload byte length
  checksum: number;   // Modulo-256 checksum byte
  payload: string;    // Input payload string
}
```

#### Example:
```javascript
import { buildModel } from 'circlecode';

const model = buildModel('Table-24', { rings: 5, density: 0.35 });
console.log(`Capacity: ${model.used} / ${model.cap} bits`);
```

---

### `renderToSVG(model, options)`

Renders a `CircleCodeModel` to a clean, scalable SVG string.

#### Parameters:
- `model` (`CircleCodeModel`): Object returned by `buildModel`.
  - `style` (`'circle' | 'loncle'`, default: `'circle'`):
    - `'circle'`: Classic discrete mode with individual dashed pills for each bit.
    - `'loncle'`: LonCle mode with continuous sweeping variable-length arcs merging contiguous 1-bits.
  - `loncle` (`boolean`, optional): Convenience shortcut for `style: 'loncle'`.
  - `dark` (`string`, default: `'#000000'`): Hex or CSS color for active bits (1) and center badge.
  - `light` (`string`, default: `'#8e8e93'`): Hex or CSS color for inactive bits (0).
  - `lineWidth` (`number`, default: `7.5`): Stroke width in 400x400 normalized space.
  - `bg` (`string`, default: `'transparent'`): Canvas background color.
  - `center` (`string | object`, default: `'Pay'`): Plain text or an image to render inside the center circular badge.
  - `centerBg` (`string`, default: `'#000000'`): Center circular badge background color (`'#000000'`, `'#ffffff'`, or `'transparent'`).

#### Returns:
- `string`: Valid SVG markup.

Text and attribute values are XML-escaped; characters forbidden in XML 1.0 are replaced with U+FFFD. Center image URLs support relative paths, HTTP(S), blob URLs, and image data URLs (PNG, JPEG, GIF, WebP, AVIF, BMP, ICO, or SVG). Other URL schemes throw an error. SVG accepts `{ dataUrl }`, `{ img }`, or an image element (using `currentSrc` or `src`). Canvas requires a loaded image element or `{ img }`. String values and `{ text }` render literal text. No built-in brand logos are included.

---

### `renderToCanvas(model, ctx, size, options)`

Renders a `CircleCodeModel` directly onto an HTML5 2D canvas context.

#### Parameters:
- `model` (`CircleCodeModel`): Model from `buildModel`.
- `ctx` (`CanvasRenderingContext2D`): Target 2D rendering context.
- `size` (`number`, default: `400`): Width and height of output in pixels.
- `options` (`RenderOptions`, optional): Styling options.

---

## Decoder API (JavaScript)

### `scanImageData(imageData, options)`

Decodes a circular barcode from raw pixel data (`ImageData` or `{ data, width, height }`).

#### Parameters:
- `imageData` (`ImageData | { data: Uint8ClampedArray | Uint8Array, width: number, height: number }`)
- `options` (`ScanOptions`, optional):
  - `aggressive` (`boolean`, default: `true`): Enables 1-bit and 2-bit mathematical error correction.
  - `perspective` (`boolean`, default: `true`): Tests elliptical perspective transforms (15°–30° camera tilt).
  - `mirrored` (`boolean`, default: `true`): Enables mirrored front-camera / selfie photo decoding.
  - `cx`, `cy` (`number`, optional): Known center coordinates (overrides auto-detection).
  - `scale` (`number`, optional): Known scale factor.

#### Returns:
```typescript
interface ScanResult {
  ok: boolean;
  text?: string;        // Decoded UTF-8 string
  bytes?: number[];     // Decoded raw byte array
  len?: number;         // Payload byte length
  chk?: number;         // Checksum byte
  rings?: number;       // Number of rings detected
  density?: number;     // Dash density detected
  rot?: number;         // Angle of rotation (in radians)
  sep?: number;         // Otsu / K-means luminance separation contrast
  fixed?: number;       // Bits repaired (0 = clean, 1 = 1-bit fix, 2 = 2-bit fix)
  reason?: string;      // Error explanation if ok === false
}
```

---

### `CircleScanner`

High-level camera scanner controller that manages `getUserMedia`, torch toggle, and frame processing.

#### Constructor:
```javascript
const scanner = new CircleScanner(options);
```

#### Options:
- `fps` (`number`, default: `12`): Target scanning rate.
- `facingMode` (`'environment' | 'user'`, default: `'environment'`): Back or front camera.
- `useWorker` (`boolean`, default: `false`): Run frame decoding in background Web Worker thread.
- `workerUrl` (`string`, default: `'scanner-worker.js'`): Path or URL to worker script.
- `perspective` (`boolean`, default: `true`): Compensate for camera angle.
- `confirmCount` (`number`, default: `2`): Consecutive frames required to confirm (clean 0-fix decodes confirm in 1 frame).
- `onScan` (`(result: ScanResult) => void`): Callback triggered upon successful decode.
- `onError` (`(error: Error) => void`): Error callback.

#### Methods:
- `await scanner.start(videoElement)`: Requests camera permissions and begins playback and decoding.
- `scanner.stop()`: Stops camera stream, releases video tracks, and terminates active worker.
- `scanner.hasTorch()`: Returns `boolean` whether current camera has a flashlight.
- `await scanner.setTorch(boolean)`: Turns flashlight on or off.
- `await scanner.toggleTorch()`: Toggles flashlight state.

---

## Native WebAssembly API (`circlecode/wasm`)

Compiled from Rust using wasm-bindgen. Decode latency depends on hardware, image content, resolution, and the number of search attempts. Run `npm run test:wasm` for local synthetic-image timings; these are smoke tests, not a representative camera benchmark.

```javascript
import { ensureWasm, scanFrameWasm } from 'circlecode/wasm';

// 1. Initialize WASM module once
await ensureWasm();

// 2. Decode raw RGBA frame buffer
const result = scanFrameWasm(rgbaBuffer, width, height, true);

if (result.ok) {
  console.log('Decoded text:', result.text);
}
```

### `ensureWasm(wasmBinaryOrUrl)`
Initializes the WebAssembly runtime. Accepts an optional ArrayBuffer, Response, or URL.

### `scanFrameWasm(rgba, width, height, aggressive)`
- `rgba` (`Uint8Array | Uint8ClampedArray`): Raw pixel array of size `width * height * 4`.
- `width` (`number`): Pixel width.
- `height` (`number`): Pixel height.
- `aggressive` (`boolean`, default: `true`): Enables error correction.
- **Returns**: `WasmScanResult`.
