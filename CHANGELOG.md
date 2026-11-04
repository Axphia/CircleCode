# Changelog

All notable changes to **`@axphia/circlecode`** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.8] - 2026-11-04

### Added
- **Cross-Platform Mobile & Native C FFI (`native/`):**
  - Added universal C ABI (`circlecode_encode_svg`, `circlecode_scan_rgba`, `circlecode_scan_rgba_json`, `circlecode_free_string`) and `CircleCodeResultC` struct in `native/rust/src/lib.rs` and `native/include/circlecode.h`.
  - Added native Rust SVG barcode encoder (`encode_svg`) supporting both **Circle** and **LonCle** modes with 100% bit-level parity with JavaScript.
  - Added official bindings and package manifests for **Flutter / Dart FFI** (`native/bindings/flutter/`), **Swift (iOS / macOS)** (`native/bindings/swift/` & `native/include/module.modulemap`), **C / C++17** (`native/include/circlecode.h` & `native/CMakeLists.txt`), and **Java / Kotlin (Android JNI)** (`native/bindings/java/`).
- **Dedicated Release Workflow (`.github/workflows/release.yml`):** Separated automated GitHub Release and Changelog generation into its own workflow and included native binary artifacts (`libcirclecode_core.so`, `libcirclecode_core.a`, `circlecode.h`).

### Changed
- **TypeScript Definitions (`index.d.ts`):** Synchronized `scanImage` (`Promise<ScanResult>`), `CircleScanner` constructor/methods, and exported all 45 public functions and constants.
- **Target-Gated WASM Dependencies (`native/rust/Cargo.toml`):** Scoped `wasm-bindgen` and `serde-wasm-bindgen` to `cfg(target_arch = "wasm32")` so native mobile and desktop builds compile cleanly without WebAssembly glue dependencies.
- **Package Footprint Optimization (`package.json`):** Removed duplicate `native/rust/pkg` WASM binaries from the published npm files list.

---

## [1.1.7] - 2026-11-04

### Added
- **Accessible SVG Output (`renderToSVG`):** Added WCAG 2.1 Level AA semantic SVG attributes (`role="img"`, `aria-label`) and child elements (`<title>`, `<desc>`) with strict XML escaping (`escapeXml`).
- **Dev Server Script:** Added `npm run dev` script (`npx serve .`) in `package.json`.

### Fixed
- **CommonJS (`require`) Compatibility:** Fixed `ERR_REQUIRE_ESM` and empty export issues when importing `@axphia/circlecode`, `@axphia/circlecode/encoder`, or `@axphia/circlecode/scanner` via CommonJS `require()` by building a complete CommonJS/UMD bundle into `index.cjs`.
- **WebAssembly Initialization Warning:** Updated `ensureWasm()` in `wasm/index.js` and `test/test-wasm.js` to pass `{ module_or_path }` object syntax to `wasm-bindgen`, eliminating the deprecated parameter warning.
- **README & Benchmark Plot:** Fixed broken image path (`images/circle-code.svg`), corrected scoped package imports (`@axphia/circlecode`), and updated the benchmark plot (`images/performance-benchmark.png`) to use standard default Matplotlib styling.

---

## [1.1.6] - 2026-10-16

### Added
- **Project Governance & Policies:** Added comprehensive `ACCESSIBILITY.md`, `SECURITY.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md` documentation.
- **Documentation Hub & Benchmarks:** Added `docs/README.md` with empirical latency evaluations across resolutions (`400x400`, `480x480`, `640x480`, `800x800`) and payload sizes.
- **Interactive 3D Homepage Stage:** Added 3D floating coin stage, depth layers, mouse parallax, and official CircleCode brand logo.
- **ECC Prototype Suite:** Added experimental Reed-Solomon error correction prototype modules under `test/ecc-prototype/`.

### Fixed
- **CI Duplicate Publish Protection:** Added pre-publish version check in `.github/workflows/build-and-publish.yml` to prevent `E403` errors when `package.json` version is already published on npm.

---

## [1.1.5] - 2026-10-10

### Added
- **Barcode Mode Selector in Showcase:** Added interactive toggle between **LonCle** (connected sweeping arcs) and **Circle** (classic discrete dashes) modes in `web-use-demo/example.html`.
- **Rust Crate Metadata:** Added `license` and `repository` fields to `native/rust/Cargo.toml`.

### Fixed
- **CDN Import URLs & Theme Decoding:** Updated CDN URLs in demos, fixed active WASM engine indicator, and improved decoding reliability on custom-colored barcode themes.

---

## [1.1.4] - 2026-10-05

### Added
- **Dual Rendering Modes (`Circle` & `LonCle`):** Introduced contiguous variable-length arc merging (`getRuns()`) for LonCle mode alongside classic discrete pill dashes, with 100% optical scanner compatibility.
- **Native Rust WebAssembly Core (`@axphia/circlecode/wasm`):** Added Rust `wasm-bindgen` decoder for high-speed frame scanning.
- **Web Worker Support (`scanner-worker.js`):** Added non-blocking background frame decoding for live camera streams.
