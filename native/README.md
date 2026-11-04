# CircleCode Native Engine (WebAssembly, Flutter, Swift, C/C++, Android JNI)

High-performance native core for CircleCode (`v1.1.8`), built in Rust and compiled to:
- **WebAssembly (`.wasm`)** for Web & Node.js
- **Native Shared & Static Libraries (`.so`, `.dylib`, `.a`, `.dll`)** with a standard **C ABI (`circlecode.h`)** for **Flutter (`dart:ffi`)**, **Swift (iOS/macOS)**, **C / C++**, and **Java / Kotlin (Android JNI)**.

---

## Directory Layout

```text
native/
├── rust/                                    # Rust crate (cdylib, staticlib, rlib)
│   ├── Cargo.toml
│   └── src/lib.rs                           # Core scanner + WASM + C FFI exports
├── include/
│   └── circlecode.h                         # C99 & C++17 Header (extern "C" + namespace circlecode)
└── bindings/
    ├── flutter/circlecode_ffi.dart          # Flutter / Dart FFI wrapper
    ├── swift/CircleCode.swift               # iOS / macOS Swift wrapper
    └── java/
        ├── circlecode_jni.c                 # Android NDK JNI bridge
        └── org/axphia/circlecode/CircleCode.java
```

---

## 1. Compiling Native Binaries for Mobile & Desktop

### Android (`.so` for Arm64 / Armv7 / x86_64)
```bash
cargo install cargo-ndk
cd native/rust
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 -o ./jniLibs build --release
```

### iOS & macOS (`.a` / `.dylib`)
```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
cd native/rust
cargo build --release --target aarch64-apple-ios
cargo build --release --target aarch64-apple-ios-sim
```

### Host Desktop (Windows `.dll` / Linux `.so` / macOS `.dylib`)
```bash
npm run build:native
```

---

## 2. Importing into Mobile & Native Languages

### A) Flutter (`dart:ffi`)
Copy [`native/bindings/flutter/circlecode_ffi.dart`](bindings/flutter/circlecode_ffi.dart) into your Flutter app and bundle `libcirclecode_core.so` (Android `jniLibs/`) or `libcirclecode_core.a` (iOS Xcode target):

```dart
import 'circlecode_ffi.dart';

final scanner = CircleCodeNative();
final result = scanner.scanRgba(rgbaBytes, 480, 480, aggressive: true);
if (result.ok) {
  print('Decoded CircleCode: ${result.text} (${result.rings} rings)');
}
```

### B) Swift (iOS / macOS)
Add [`native/include/circlecode.h`](include/circlecode.h) to your Bridging Header (or Clang modulemap), link `libcirclecode_core.a`, and include [`native/bindings/swift/CircleCode.swift`](bindings/swift/CircleCode.swift):

```swift
let result = CircleCodeScanner.scanRGBA(rgbaData, width: 480, height: 480, aggressive: true)
if result.ok, let payload = result.text {
    print("Decoded: \(payload)")
}
```

### C) C and C++17
Include [`native/include/circlecode.h`](include/circlecode.h) and link against `circlecode_core`:

```cpp
#include "circlecode.h"

auto res = circlecode::scan_rgba(rgba_buffer, 480, 480, true);
if (res.ok) {
    printf("Decoded: %s (rings=%d)\n", res.text.c_str(), res.rings);
}
```

### D) Java / Kotlin (Android JNI)
Add [`CircleCode.java`](bindings/java/org/axphia/circlecode/CircleCode.java) and compile [`circlecode_jni.c`](bindings/java/circlecode_jni.c) in your Android `CMakeLists.txt` linked with `libcirclecode_core.so`:

```kotlin
val json = CircleCode.scanRgbaJson(rgbaBytes, 480, 480, true)
```

---

## 3. WebAssembly Usage (Browser & Node.js)

```javascript
import { ensureWasm, scanFrameWasm } from '@axphia/circlecode/wasm';

await ensureWasm();
const result = scanFrameWasm(imageData.data, 480, 480, true);
if (result.ok) {
  console.log('Decoded:', result.text);
}
```

---

## Measuring Performance

Run `npm run test:wasm` to time decoding of the included 400x400 and 800x800 synthetic images. Compare engines on the same device and inputs after warm-up.
