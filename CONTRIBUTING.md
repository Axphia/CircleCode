# Contributing to CircleCode

Thank you for your interest in contributing to **CircleCode**! We welcome community contributions to improve performance, enhance barcode scanning accuracy, refine documentation, and build new integrations.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with empathy, kindness, and respect.

---

## Core Project Philosophy

Before submitting code, please keep our core architectural tenets in mind:

1. **Zero External Runtime Dependencies**: The core JavaScript library (`circlecode`, `circlecode/encoder`, `circlecode/scanner`) must remain **100% dependency-free**. Do not introduce external npm dependencies into runtime packages.
2. **Dual Visual Mode Parity**: Any changes to slot geometry or sampling must maintain **100% optical scanning parity** between **Circle** (discrete dashes) and **LonCle** (sweeping connected ribbons).
3. **Decoupled Performance**: Computer vision decoding must never block the main browser UI thread. Real-time scanning should always be compatible with the Web Worker architecture.
4. **WASM Efficiency**: The native Rust core in `native/rust` should prioritize small binary footprint (<70 KB gzipped) and minimal memory allocations.

---

## Development Setup

### Prerequisites
- **Node.js**: Version 18.0.0 or higher.
- **npm**: Version 9.0.0 or higher.
- **Rust & wasm-pack** *(Optional, only required if modifying the native core in `native/rust`)*:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  cargo install wasm-pack
  ```

### Getting Started

1. **Fork and Clone** the repository:
   ```bash
   git clone https://github.com/Axphia/CircleCode.git
   cd CircleCode
   ```

2. **Install development dependencies**:
   ```bash
   npm install
   ```

3. **Run the local test suite**:
   ```bash
   npm test
   ```

4. **Run the WebAssembly test suite**:
   ```bash
   npm run test:wasm
   ```

5. **Start the local interactive dev showcase**:
   ```bash
   npm run dev
   # or
   npx serve .
   ```
   Open `http://localhost:3000` (or `http://localhost:5173`) in your browser.

---

## Project Directory Structure

```
circle-code-site/
├── circle-code.js         # Core Barcode Generator (SVG & Canvas renderers)
├── circle-scanner.js      # Computer Vision Scanner Engine (Pure JavaScript)
├── scanner-worker.js      # Web Worker background scanning script
├── index.js               # Library entry point (ESM)
├── index.cjs              # CommonJS entry point
├── index.d.ts             # Complete TypeScript type definitions
├── index.html             # Interactive showcase & camera scanner demo
├── native/
│   └── rust/              # Rust core implementation (wasm-bindgen)
├── docs/                  # Technical documentation hub, API, Architecture & Specs
├── images/                # Logo assets, icons, and performance benchmark plots
├── scripts/               # Benchmark runners and plot generators
└── test/                  # Test suites (unit tests, synthetic roundtrips, WASM)
```

---

## Coding Guidelines

### 1. JavaScript Standards
- Write clean, modern ES6+ vanilla JavaScript.
- Avoid heavy runtime object allocations inside inner loops (such as the 360° angular sweep or radial sampling).
- Preserve existing comments and docstrings.

### 2. Security & Sanitization
- Never interpolate unescaped user strings directly into SVG markup or HTML.
- Always use the internal XML escaping utilities when formatting payload text or center labels.
- Validate center image URLs to ensure they use safe protocols (`http:`, `https:`, or `data:image/...`), rejecting dangerous schemes like `javascript:`.

### 3. TypeScript Definitions
- When adding or modifying public functions, options, or return objects, you **must update [index.d.ts](index.d.ts)** to reflect the changes.
- Ensure TypeScript projects can compile cleanly against the updated declarations.

---

## Pull Request (PR) Workflow

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/my-new-feature
   ```

2. **Commit Changes with Conventional Commits**:
   We recommend clear, standardized commit messages:
   - `feat:` A new feature or capability.
   - `fix:` A bug fix.
   - `perf:` A code change that improves performance or latency.
   - `docs:` Documentation updates or additions.
   - `test:` Adding or updating tests.
   - `refactor:` Code restructuring without behavioral changes.

   *Example:*
   ```bash
   git commit -m "perf: optimize angular sweep luminance sampling in circle-scanner.js"
   ```

3. **Verify Tests**:
   Before pushing, ensure all tests pass cleanly:
   ```bash
   npm test
   npm run test:wasm
   ```

4. **Push and Open a Pull Request**:
   Push your branch to your fork and submit a PR against `main` on GitHub. Include:
   - A clear explanation of what changed and why.
   - Test results or benchmark measurements if modifying scanner performance.
   - Any relevant issue numbers (e.g., `Closes #42`).

---

## Reporting Bugs & Suggesting Features

- **Bug Reports**: Please open an issue on [GitHub Issues](https://github.com/Axphia/CircleCode/issues) with detailed reproduction steps, browser/runtime version, and sample images if scanning fails.
- **Feature Requests**: Feel free to open a Discussion or Issue describing your proposed feature or use case.
