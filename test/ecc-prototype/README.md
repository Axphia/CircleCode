# CircleCode ECC prototype

Experimental prototype V2.1: Packed Numeric / Alphanumeric / UTF-8 / Binary modes with Reed–Solomon + CRC32 error correction isolated from the main library, implemented in vanilla JavaScript without extra dependencies.

The actual codec, packing, RS, and scanner implementations live in `v2/` within this experimental directory. Legacy-named files re-export this shared code so ECC Lab and the web scanner use the exact same implementation. All V2 components, including the web scanner and Rust/WASM, reside solely in `test/ecc-prototype/` without modifying root exports, scripts, or the primary library. The `legacy/` directory contains an isolated snapshot of the V1 renderer and utilities.

The mobile camera and Rust/WASM web scanner is located in [scanner-web](scanner-web/README.md). Both JS and Rust experimental scanners support automatic ring count detection across 4–14 rings when rings = 0; ECC Lab continues to require manual ring selection. No web publishing or Google Sites integration exists in this directory.

From the repository root, run the entire test suite via `npm --prefix test/ecc-prototype test`. Build the scanner web app using `npm --prefix test/ecc-prototype run build:scanner` and open it with `npm --prefix test/ecc-prototype run preview` at `http://127.0.0.1:4180/`. The package `build:wasm` script exclusively compiles `native/rust/` and syncs artifacts to `wasm/` inside this directory.

## Running ECC Lab

From the repository root:

```sh
node test/ecc-prototype/serve.mjs
```

Open [ECC Lab](http://127.0.0.1:4173/). An HTTP server is required to load ES modules and the Web Worker.

The web UI creates Circle / LonCle codes, allows random byte corruption or manual byte toggling, displays clean, damaged, and recovered results, and exports PNG or SVG images. Image scanning runs the actual experimental decoder inside a Web Worker, supporting the canvas above, bundled sample images, or uploaded PNG/JPEG/WebP files up to 10 MB (downscaled so the max dimension does not exceed 800 pixels before decoding).

Set the packing mode to Auto to select Numeric, Alphanumeric, or UTF-8 across the entire payload, or choose Binary and enter complete hex pairs such as `00 FF 80 41`. The UI reports the count of digits/characters/bytes and total packed bits. Scanned binary data is rendered as hexadecimal bytes to preserve `00`, `FF`, and non-UTF-8 bytes.

Images and text are processed entirely client-side in the browser. The local server uses standard Node.js APIs bound strictly to `127.0.0.1`. The ring count must be specified manually for uploaded images; bundled sample fixtures all use 7 rings. This test bench does not include camera access.

Verified in real browser testing: 4-byte recovery from canvas, rejection of 5-byte corrupted cases and random noise, handling rotated/mirrored/inverted images, Thai script and emoji in LonCle style, payload capacity overflow rejection, PNG/SVG downloading, and round-trip decoding of downloaded PNGs. Layout verified at 375 px and 1280 px viewport widths with zero horizontal overflow. UI screenshot available at `outputs/web-preview.jpg`.

Verified V2.1 features via live web testing: Auto Numeric 33 digits with leading zeros and 4 corrupted bytes, 20-character Alphanumeric in LonCle style, over-capacity UTF-8 rejection, odd/invalid hex rejection, and full 14-byte Binary payload with 4 corrupted bytes exported to PNG and scanned back with 100% byte fidelity. Responsive layout at 375/1280 px re-verified for the updated mode controls.

## Running Tests

From the repository root:

```sh
node test/ecc-prototype/run-tests.js
```

The test runner validates the implementation and writes sample files to `test/ecc-prototype/outputs/` on each run.

Extended test suite, including optical image decoding:

```sh
node test/ecc-prototype/run-more-tests.js
node test/ecc-prototype/run-web-tests.js
```

The extended tests utilize system-installed ImageMagick (`magick`) and Python with Pillow to generate and rasterize optical test fixtures without introducing npm dependencies. The test runner runs the core suite first, then writes optical images to `outputs/optical/` and structured test summaries to `outputs/more-results.json`.

## Files

- `legacy/circle-code.js`, `legacy/circle-scanner.js`, `legacy/LICENSE`: Snapshot copies of existing project files used for regression testing and original rendering. These files do not auto-update from the project root.
- `reed-solomon.js`: Shortened Reed–Solomon over GF(256), primitive polynomial `0x11D`, generator roots starting at α⁰. Uses Berlekamp–Massey for error locator polynomial and solves a linear system for error magnitudes.
- `codec.js`: Version 2 experimental framing, CRC32, and circular coordinate mapping.
- `packing.js`: Payload mode packing and unpacking, capacity calculations, and bit group / padding validation.
- `run-packing-tests.js`: Validates packing vectors, mode capacities, raw binary payloads, and backward compatibility with legacy V2 frames. Included in default test runs.
- `run-tests.js`: Core unit tests and sample artifact generator.
- `scan-image.js`: Experimental image scanner using legacy finder/sampling routines paired with RS + CRC32 decoding.
- `make-optical-fixtures.py`: Rasterizes SVG fixtures into deterministic test images with rotation, inversion, mirroring, blur, JPEG compression, and scratch degradation.
- `run-more-tests.js`: Exhaustive 2-bit flip tests, every single-byte corrupted position, and optical fixture decoding.
- `index.html`, `web.css`, `web.js`: Interactive ECC Lab web page reusing the codec and legacy renderer.
- `scan-worker.js`: Dedicated Web Worker for off-thread image decoding without UI blocking.
- `serve.mjs`: Lightweight HTTP server for local development.
- `run-web-tests.js`: Validates Worker message protocol, 16 optical fixtures across 4 modes × 2 styles × clean/4-byte damage, legacy V2 images, and input/exception edge cases.
- `outputs/packing-results.json`, `outputs/web-results.json`: Benchmark and validation results for packing modes and Worker protocols.
- `outputs/results.json`: Test execution summary generated on each run.
- `outputs/circle-{clean,damaged,recovered}.svg`: Rendered clean, corrupted, and recovered Circle codes.
- `outputs/loncle-{clean,damaged,recovered}.svg`: Corresponding sample set rendered in continuous LonCle style.

## Wire Format

```text
magic CC (2 bytes) | format/mode (1 byte) | length (2 bytes, big-endian)
packed payload | zero padding | CRC32 (4 bytes) | RS parity (8 bytes)
```

The frame length is determined directly by the slot capacity of the concentric rings, using only full bytes with zero padding on unused trailing bits. This prevents decoders from relying on unauthenticated length headers prior to error correction.

CRC32/ISO-HDLC is computed over the entire header, payload, and zero padding. Reed–Solomon parity protects the combined data and CRC32 payload. Following RS decoding, the data must pass CRC32 verification, magic bytes, valid encoding mode, valid payload length, legal bit groups, and all-zero padding before returning `ok: true`. UTF-8 payloads must also pass strict UTF-8 decoding.

Format/mode byte values: `0x20` = UTF-8, `0x21` = Numeric, `0x22` = Alphanumeric, `0x23` = Binary. This updated format is designated V2.1. The updated decoder maintains backward compatibility with legacy V2 frames (`0x02` UTF-8). Legacy V2 decoders reject V2.1 frames, requiring decoders to be updated prior to adopting the new packing modes. Neither format is compatible with the legacy V1 scanner.

Numeric mode encodes payload length as digit count `0–9`: every 3 digits use 10 bits; remainder 1 or 2 digits use 4 or 7 bits. Alphanumeric mode encodes character count from `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:`: every 2 characters use 11 bits; remainder 1 character uses 6 bits. UTF-8 and Binary modes encode length as byte count (8 bits per byte).

Numeric and Alphanumeric packing rules follow the specifications from [Project Nayuki's QR Code generator](https://github.com/nayuki/QR-Code-generator/blob/master/typescript-javascript/qrcodegen.ts#L743-L772). However, the framing, CRC32, and circular coordinate geometry are unique to CircleCode without external dependencies or multi-segment frames.

The default 7-ring configuration provides 31 total bytes (17 bytes overhead, leaving 112 bits for payload). This yields a maximum capacity of 33 Numeric digits, 20 Alphanumeric characters, or 14 UTF-8/Binary bytes while retaining 8 parity bytes. The system can correct up to 4 corrupted bytes at arbitrary positions within the frame, including header, CRC, or parity bytes. Correction counts refer to post-packing byte corruption, not individual characters or visual area percentage.

```js
import { encodeFrame, decodeFrame } from './codec.js';

const frame = encodeFrame('Table-24');
frame[5] ^= 1;
const result = decodeFrame(frame);
console.log(result.ok, result.text, result.correctedBytes);
// true Table-24 1

const numbers = encodeFrame('000123456789012345678901234567890');
console.log(decodeFrame(numbers).mode); // numeric; preserves leading zeros
const binary = encodeFrame(Uint8Array.of(0, 255, 128, 65));
const decoded = decodeFrame(binary);
console.log(decoded.bytes); // Uint8Array [0, 255, 128, 65]
// binary mode returns raw bytes with undefined text
```

The API functions `encodeFrame(payload, frameBytes = 31, mode = 'auto')` and `buildEccModel(payload, rings = 7, mode = 'auto')` accept `string` or `Uint8Array`. Explicit modes can be set to `numeric`, `alphanumeric`, `utf8`, or `binary`. Text modes preserve case sensitivity and leading zeros, and reject invalid characters for the selected mode. Text containing unpaired UTF-16 surrogates is rejected to prevent silent data corruption.

Decoded result objects include `mode`, `bytes` (Uint8Array), `payloadLength`, `packedBits`, `packedBytes`, and `format` (`'2'` or `'2.1'`). All text modes continue to return `text`. Mode packing optimizes payload density; it is neither cryptographic encryption nor general-purpose file compression.

## Verification & Test Coverage

- RS encoder matches the reference test vector from ISO 18004 Annex I as published in [ZXing ReedSolomonTestCase.testQRCode](https://github.com/zxing/zxing/blob/master/core/src/test/java/com/google/zxing/common/reedsolomon/ReedSolomonTestCase.java#L55-L65), and the decoder successfully recovers corrupted reference blocks.
- CRC32 of `123456789` strictly matches reference standard `CBF43926`.
- Single-bit flipping exhaustively tested across all 248 bit positions, along with all 255 non-zero XOR masks for single-byte corruption.
- 2,000 seeded pseudorandom trials: 1–4 corrupted bytes with frame lengths up to 255 bytes, verifying that input buffers are never mutated by the decoder.
- 200 adversarial over-limit patterns correctly rejected (not an absolute guarantee against every conceivable over-limit corruption).
- Frames with valid RS parity but mismatched CRC32 are rejected, along with corrupted version headers, invalid lengths, and malformed UTF-8 sequences.
- Legacy bug reproduction: legacy decoder accepted corrupted 1-bit `AB` as `@B`, whereas the prototype successfully recovers `AB`.
- Circular model recovery test flipping 32 bits across 4 bytes with clean recovery of `Table-24`.
- Validation of Thai script, emojis, empty payloads, capacity boundaries, and malformed inputs.
- Test vectors: Numeric `01234567` → `03 15 98 60` (27 bits + padding), Alphanumeric `AB` → `39 A0` (11 bits + padding), exhaustive testing across 1,000 Numeric 3-digit groups and 2,025 Alphanumeric pairs.
- 956 capacity boundary cases: 4 modes × payload capacities 0–238 bytes, validating exact fit, 1-byte overflow rejection, and arbitrary byte values 0–255.
- 400 additional 1–4 byte corrupted frames across all modes, forged headers/modes/bit groups with valid CRC/RS, BOM handling, newlines, and legacy V2 optical regression fixtures.

## Extended Test Results

- All 30,628 unique pairs of bit flips in a 31-byte frame cleanly recovered.
- All 7,905 single-byte corruption patterns (all positions × all non-zero XOR masks) cleanly recovered.
- 2,000 completely random frames successfully rejected.
- 37 rasterized SVG fixtures covering Circle and LonCle styles: sizes 240–800 px, rotations, mirror reflections, color inversions, multi-transform combinations, Gaussian blur, JPEG quality 35, and 4-byte payload damage.
- All 30 designated readable fixtures decoded `Table-24` with 100% accuracy, plus 2 exploratory scratch fixtures decoded successfully (fine scratches filtered out by sampling prior to RS decoding).
- 2 severely occluded fixtures, blank white/black images, and random noise (5 total negative cases) rejected without false positives.
- Automatic center, scale, rotation, polarity, and mirror reflection detection from raw pixels without hints from fixture metadata (fixed ring count 7, density 0.35).
- Per-image decode times recorded in JSON are diagnostic measurements from a single local run, not production benchmarks or performance guarantees.

## Limitations

- The extended suite tests rasterized SVG fixtures; real-world camera perspective distortion and uncontrolled lighting are not yet fully covered. Prototype fixtures cannot be scanned by the legacy V1 scanner.
- The ECC Lab web test bench operates with fixed ring counts and fixed 0.35 density without erasure decoding. The Rust/WASM V2.1 codec and scanner are available in `native/rust/src/v2.rs` and integrated with the mobile scanner app.
- Corruptions exceeding error correction limits may occasionally cause RS to decode to an incorrect payload. CRC32 minimizes false acceptance, but hash collisions remain mathematically possible. CRC32 does not provide cryptographic authenticity.
- V2.1 supports a single packing mode per frame (no Kanji mode, mixed segments, selectable ECC levels, or direct binary file upload via GUI buttons; binary payloads can be loaded via API or hex input).
- Deploying to production requires an update strategy for existing V2 decoders, as they cannot parse V2.1 frames.
- This codebase represents an experimental prototype validated against the test suites above, not a finalized production release.
