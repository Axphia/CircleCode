# CircleCode Native Acceleration Engine (Rust & WebAssembly)

High-performance native core for CircleCode, built in Rust and compiled directly to WebAssembly (WASM).

---

## Measuring Performance

Run `npm run test:wasm` to time decoding of the included 400x400 and 800x800 synthetic images. The command prints the binary size and elapsed time on the current machine. These are correctness smoke tests with single-run timings, not a representative benchmark or an FPS guarantee.

Compare engines on the same device and inputs, after warm-up, with repeated samples and real camera images (including failed scans). Report median and tail latency separately from camera/UI frame rate. CPU use, battery impact, and thermal behavior require device measurements.

The wasm-bindgen bridge copies the input into WASM memory; Rust allocates frame-processing buffers and the bridge allocates JavaScript result objects. This path is not zero-copy or free of JavaScript garbage collection. No explicit SIMD implementation is configured in this repository.

---

## Using in Node.js or Browser

The compiled WebAssembly binary is packaged into the official npm release (`circlecode` v1.1.0+):

```javascript
import { ensureWasm, scanFrameWasm } from 'circlecode/wasm';

// 1. Initialize WASM module
await ensureWasm();

// 2. Scan RGBA pixel array
const result = scanFrameWasm(imageData.data, 480, 480, true);

if (result.ok) {
  console.log('Decoded:', result.text);
}
```

---

## Building from Source

To compile the Rust source into `.wasm` yourself:

```bash
# 1. Install wasm-pack
cargo install wasm-pack

# 2. Compile release package
cd native/rust
wasm-pack build --target web --release
```

Outputs in `native/rust/pkg/`:
- `circlecode_core_bg.wasm`: Optimized WebAssembly binary.
- `circlecode_core.js`: JavaScript glue bindings.
- `circlecode_core.d.ts`: TypeScript definitions.

---

## Related Documentation

- [Full API Reference](../docs/API.md)
- [Format Specification](../docs/SPECIFICATION.md)
- [Technical Architecture](../docs/ARCHITECTURE.md)
