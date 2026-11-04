# CircleCode API Reference (v1.1.8)

`@axphia/circlecode` provides a unified suite of tools for generating and scanning circular barcodes in dual modes (**Circle** discrete dashes & **LonCle** sweeping connected arcs) across Browser, Node.js, WebAssembly, and Native Mobile / C FFI runtimes (Flutter, Swift, C/C++, Java/Kotlin).

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
- [Native WebAssembly API (`@axphia/circlecode/wasm`)](#native-webassembly-api-axphiacirclecodewasm)
  - [`ensureWasm(wasmBinaryOrUrl)`](#ensurewasmwasmbinaryorurl)
  - [`scanFrameWasm(rgba, width, height, aggressive)`](#scanframewasmrgba-width-height-aggressive)
- [Native Mobile & C FFI API (Flutter, Swift, C/C++, Java)](#native-mobile--c-ffi-api-flutter-swift-cc-java)

---

## Installation

```bash
# npm
npm install @axphia/circlecode

# yarn
yarn add @axphia/circlecode

# pnpm
pnpm add @axphia/circlecode

# bun
bun add @axphia/circlecode
```

---

## Module Exports

| Import Path | Content | Target Environments |
| :--- | :--- | :--- |
| `@axphia/circlecode` | Full library (Encoder + Scanner) | Browser, Node.js (ESM & CJS) |
| `@axphia/circlecode/encoder` | Pure Encoder (SVG & Canvas generator) | Browser, Node.js |
| `@axphia/circlecode/scanner` | Pure JS Scanner (Image, Canvas, Camera) | Browser, Node.js |
| `@axphia/circlecode/worker` | Web Worker background scanning script | Modern Browsers |
| `@axphia/circlecode/wasm` | High-performance Rust WebAssembly engine | Browsers, Node.js (WASM enabled) |

---

## Encoder API

### `buildModel(payload, options)`

Builds the binary data model and slot allocation for a circular barcode.

#### Parameters:
- `payload` (`string`): UTF-8 text or URL to encode.
- `options` (`object`, optional):
  - `rings` (`number`, default: `5`): Number of concentric rings (scanner supports `4` to `14`). At density `0.35`, five rings hold at most 19 UTF-8 payload bytes. Oversized payloads throw an error.
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
import { buildModel } from '@axphia/circlecode';

const model = buildModel('Table-24', { rings: 5, density: 0.35 });
console.log(`Capacity: ${model.used} / ${model.cap} bits`);
```

---

### `renderToSVG(model, options)`

Renders a `CircleCodeModel` to a clean, accessible, scalable SVG string.

#### Parameters:
- `model` (`CircleCodeModel`): Object returned by `buildModel`.
- `options` (`RenderOptions`, optional):
  - `style` (`'circle' | 'loncle'`, default: `'circle'`):
    - `'circle'`: Classic discrete mode with individual dashed pills for each bit.
    - `'loncle'`: LonCle mode with continuous sweeping variable-length arcs merging contiguous 1-bits.
  - `loncle` (`boolean`, optional): Convenience shortcut for `style: 'loncle'`.
  - `dark` (`string`, default: `'#000000'`): Hex or CSS color for active bits (1) and center badge.
  - `light` (`string`, default: `'#8e8e93'`): Hex or CSS color for inactive bits (0).
  - `lineWidth` (`number`, default: `7.5`): Stroke width in 400x400 normalized space.
  - `bg` (`string`, default: `'#ffffff'`): Disc background color (or `'transparent'`).
  - `center` (`string | object`, default: `'Pay'`): Plain text or an image to render inside the center circular badge.
  - `centerBg` (`string`, default: `'#000000'`): Center circular badge background color (`'#000000'`, `'#ffffff'`, or `'transparent'`).

#### Returns:
- `string`: Valid SVG markup with `role="img"`, `aria-label`, `<title>`, and `<desc>`.

---

### `renderToCanvas(model, ctx, size, options)`

Renders a `CircleCodeModel` directly onto an HTML5 2D canvas context.

---

## Decoder API (JavaScript)

### `scanImageData(imageData, options)`

Decodes a circular barcode from raw pixel data (`ImageData` or `{ data, width, height }`).

### `scanCanvas(canvas, options)`

Decodes a circular barcode from an `HTMLCanvasElement` or `CanvasRenderingContext2D` (automatically downsampling images larger than `maxScanDimension = 600` px).

### `scanImage(source, options)`

Asynchronously loads and decodes an `HTMLImageElement` or image URL (`Promise<ScanResult>`).

### `CircleScanner`

High-level camera scanner controller that manages `getUserMedia`, torch toggle, and frame processing.

```javascript
import { CircleScanner } from '@axphia/circlecode';

const scanner = new CircleScanner({ fps: 12, useWorker: true });
await scanner.start(videoElement, (result) => {
  console.log('Decoded:', result.text);
});
```

---

## Native WebAssembly API (`@axphia/circlecode/wasm`)

```javascript
import { ensureWasm, scanFrameWasm } from '@axphia/circlecode/wasm';

await ensureWasm();
const result = scanFrameWasm(rgbaBuffer, width, height, true);
if (result.ok) {
  console.log('Decoded text:', result.text);
}
```

---

## Native Mobile & C FFI API (Flutter, Swift, C/C++, Java)

See [`native/README.md`](../native/README.md) and [`native/include/circlecode.h`](../native/include/circlecode.h) for the native C ABI (`circlecode_encode_svg`, `circlecode_scan_rgba`, `circlecode_scan_rgba_json`, `circlecode_free_string`) and official bindings for **Flutter (`dart:ffi`)**, **Swift (iOS/macOS)**, **C/C++17**, and **Java/Kotlin (Android JNI)**.
