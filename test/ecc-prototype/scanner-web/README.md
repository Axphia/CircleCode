# Mobile Web Scanner V2.1 — Experimental Test Suite Only

Experimental mobile web app for camera and image scanning of CircleCode V2/V2.1. Uses JavaScript for UI/camera handling and Rust/WebAssembly or JavaScript inside a Web Worker for optical decoding. All code, including Rust, WASM, and shared libraries, is located entirely within `test/ecc-prototype` without modifying the core project library or root `package.json`, and without deploying to production sites.

## Running the Web Scanner

From the repository root:

```sh
npm --prefix test/ecc-prototype run build:scanner
npm --prefix test/ecc-prototype run preview
```

Open `http://127.0.0.1:4180/` on the same machine. The companion ECC Lab is launched with `npm --prefix test/ecc-prototype run lab` on port 4173.

Phones connecting via an HTTP LAN IP cannot access the camera. Mobile browsers require HTTPS or an origin considered a secure context. See [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). This tool is not published or certified for production phone deployment.

## Features & Capabilities

- Start / stop / switch camera with back camera requested by default (microphone is never accessed).
- Camera video frames are centered, cropped, and resized to at most 640 × 640 px; processed frame-by-frame with a 2-consecutive-frame agreement requirement before accepting and pausing the camera.
- Camera and Worker immediately shut down when switching tabs, leaving the page, tapping stop, or encountering an error. Stale permission grants release tracks immediately if the request was cancelled.
- Upload PNG/JPEG/WebP images with magic signature checks, limited to 10 MB and 32 megapixels, downscaled to a max dimension of 960 px before scanning.
- Selectable decoding engine: Rust/WASM, JavaScript, or Auto (which falls back to JS if WASM fails to load). Supports automatic ring count search (4–14 rings) or manual ring selection.
- Decodes Numeric, Alphanumeric, UTF-8, and Binary payloads. Binary payloads display as hexadecimal and can be downloaded as raw binary files.
- Client-side processing: no history stored, no images uploaded to servers, and links are not automatically opened.

This scanner supports V2/V2.1 formats only (does not scan legacy V1), with error correction up to 4 corrupted bytes following the experimental format specification.

## Internal Directory Structure

- `v2/`: Codec, packing, Reed–Solomon, and JS scanner shared between ECC Lab and the web scanner.
- `legacy/`: Isolated snapshot of the V1 renderer and utilities.
- `native/rust/`: Experimental Rust crate with source, Cargo.lock, and wasm-pack output separate from the primary rust crate.
- `wasm/`: V2 runtime artifacts for this test suite only.
- `scanner-web/src/`: Web app UI, camera management, Worker, and task cancellation handler.
- `scanner-web/dist/`: Static web output built from the sources above.

Rebuilding experimental WASM (requires `wasm32-unknown-unknown` Rust target and `wasm-pack`):

```sh
npm --prefix test/ecc-prototype run build:wasm
npm --prefix test/ecc-prototype run build:scanner
```

This compiles `native/rust/` into `native/rust/pkg` and synchronizes artifacts to `test/ecc-prototype/wasm` without modifying the root project's WASM bundle.

## Validation

```sh
npm --prefix test/ecc-prototype test
cargo test --locked --manifest-path test/ecc-prototype/native/rust/Cargo.toml
```

The test suite runs against local ImageMagick and Python/Pillow, validating data packing and recovery, 2,000 JS–Rust parity checks, 37 optical fixtures, 4-byte damaged images across all modes and styles (Circle/LonCle), and automatic ring count detection across 4–14 rings in both engines. Simulated camera tests verify cancellation, track cleanup, stale reply rejection, and 2-frame confirmation.

Validated in real desktop browsers across both JS and Rust/WASM engines, including binary PNG scanning and round-trip 14-byte downloads. Testing has not yet covered physical mobile devices, all lighting/tilt conditions, or thermal/battery impact; this remains prototype test code, not a production certification.
