# CircleCode Sample Applications (`v1.1.8`)

This folder contains ready-to-use sample applications demonstrating how to generate (**Circle** & **LonCle** modes) and scan **CircleCode** barcodes across platforms:

| Folder | Platform / Language | Description |
| :--- | :--- | :--- |
| **[`nodejs/`](nodejs/)** | **Node.js (ESM & CommonJS)** | Generates SVG barcodes and decodes RGBA image buffers using `@axphia/circlecode`. |
| **[`flutter/`](flutter/)** | **Flutter (`dart:ffi`)** | Full Flutter app (`lib/main.dart`) with SVG barcode generator and camera stream scanner. |
| **[`swift-ios/`](swift-ios/)** | **SwiftUI (iOS / macOS)** | SwiftUI app (`CircleCodeDemoApp.swift`) for generating and scanning CircleCodes natively. |
| **[`android-java/`](android-java/)** | **Android (Java / JNI)** | Android `MainActivity.java` integrating CameraX `ImageAnalysis` and SVG WebView rendering. |
| **[`cpp/`](cpp/)** | **C++17 & CMake** | Standalone C++17 CLI (`main.cpp` + `CMakeLists.txt`) using `native/include/circlecode.h`. |

---

## Quick Test (Node.js Sample)

Run the Node.js sample directly from the repository root:

```bash
node Samples/nodejs/encode-and-scan.mjs
node Samples/nodejs/cjs-example.cjs
```

