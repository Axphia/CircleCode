# CircleCode Native Acceleration Engine (Rust & WebAssembly)

High-performance native core for CircleCode, built in Rust and compiled directly to WebAssembly (WASM).

---

## ⚡ Performance Highlights

| Metric | Pure JavaScript | Rust WebAssembly (`circlecode/wasm`) |
| :--- | :--- | :--- |
| **Decode Latency (400x400 Frame)** | ~18.5 ms | **3.01 ms** (6x faster) |
| **Decode Latency (800x800 Frame)** | ~68.0 ms | **25.4 ms** (2.7x faster) |
| **Max Throughput** | ~54 FPS | **300+ FPS** |
| **WASM Binary Size** | — | **33.7 KB** (gzipped) |
| **Garbage Collection Pauses** | Occasional | **Zero (Immune to GC)** |

---

## 📦 Using in Node.js or Browser

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

## 🛠️ Building from Source

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

## 📚 Related Documentation

- [Full API Reference](../docs/API.md)
- [Format Specification](../docs/SPECIFICATION.md)
- [Technical Architecture](../docs/ARCHITECTURE.md)
