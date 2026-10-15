# CircleCode Native Core (Rust & C++)

High-performance native scanning cores for CircleCode.

## Architecture

- **JavaScript (Default / Zero Dependencies):**
  - Located at the root (`circle-code.js`, `circle-scanner.js`, `scanner-worker.js`).
  - Runs in every browser, Node.js, and mobile webview with zero build steps or native toolchain requirements.
  - Optimized with mathematical shortcuts, subpixel median sampling, and Web Worker thread decoupling.

- **Rust / WebAssembly (`native/rust/`):**
  - High-throughput subpixel rasterization and centroid edge detection compiled directly to `.wasm`.
  - Enables SIMD instructions for intense 60 FPS mobile scanning and headless server batch decoding.

---

## 🛠️ How to Build Rust WASM

Ensure you have Rust and `wasm-pack` installed:

```bash
# 1. Install wasm-pack
cargo install wasm-pack

# 2. Build WebAssembly package
cd native/rust
wasm-pack build --target web --release
```

The output in `native/rust/pkg` contains:
- `circlecode_core_bg.wasm`
- `circlecode_core.js` (JavaScript bindings)
- `circlecode_core.d.ts` (TypeScript definitions)
