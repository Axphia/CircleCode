# CircleCode Architecture

This document outlines the software design, subpixel image processing pipeline, threading models, and WebAssembly runtime architecture of CircleCode.

---

## 1. System Overview

CircleCode is built with a **dual-engine architecture**:

```
+--------------------------------------------------------------------------+
|                            Application Layer                             |
|          (React / Vue / Svelte / Next.js / Vanilla JS / Node.js)         |
+------------------------------------+-------------------------------------+
                                     |
             +-----------------------+-----------------------+
             |                                               |
             v                                               v
+-------------------------+                     +--------------------------+
|  Pure JS Engine         |                     |  Rust WebAssembly Core   |
|  - Zero dependencies    |                     |  - Sub-3ms latency       |
|  - Web Worker decoupled |                     |  - SIMD vectorization    |
|  - ESM + CJS + UMD      |                     |  - Zero GC pauses        |
+-------------------------+                     +--------------------------+
             |                                               |
             +-----------------------+-----------------------+
                                     |
                                     v
+--------------------------------------------------------------------------+
|                          Video & Canvas Pipeline                         |
|             (navigator.mediaDevices / HTMLCanvasElement / Node Buffer)   |
+--------------------------------------------------------------------------+
```

---

## 2. Image Processing Pipeline

Every camera video frame or static image follows an optimized 5-stage pipeline:

```
[Camera / Video Frame]
         │
         ▼
[1. Grayscale Conversion] ──► Averaging (R + G + B) / 3 via Float32Array
         │
         ▼
[2. Center Badge & Centroid] ──► Scans for R=42 black circular badge
                                 Refines center with subpixel moment centroid
         │
         ▼
[3. 360° Finder Angle Sweep] ──► 1.8° angular step evaluations
                                 Identifies dark finder spoke alignment
         │
         ▼
[4. Hybrid Adaptive Threshold] ──► Global 2-Cluster K-Means
                                   Per-Ring Otsu Variance Maximization
         │
         ▼
[5. Framing & Error Recovery] ──► 16-bit header decode
                                  Modulo-256 Checksum delta resolution
                                  UTF-8 payload string output
```

### Stage 1: Grayscale Conversion
Raw RGBA buffers are converted into a flattened `Float32Array` of luminance values `[0.0, 255.0]`.

### Stage 2: Subpixel Center & Scale Localization
The black circular center badge (`r = 42`) provides an anchor that is invariant to orientation.

- **Annular contrast operator:**
  ```text
  Score = Mean_out(1.10 × r) - Mean_in(0.82 × r)
  ```
- **First-order spatial moments for subpixel center refinement:**
  ```text
  c_x = (Σ x_i) / N
  c_y = (Σ y_i) / N
  r_refined = √(N / π)
  ```

### Stage 3: Perspective & Tilt Compensation
When captured at an oblique angle, circular codes distort into ellipses.
The sampling engine applies an inverse coordinate transformation:

1. **Rotate to ellipse axis:**
   ```text
   u =  cos(φ) · x_r + sin(φ) · y_r
   v = -sin(φ) · x_r + cos(φ) · y_r
   ```
2. **Scale along the minor axis:**
   ```text
   v' = v × aspect
   ```
3. **Rotate back to code coordinates:**
   ```text
   x_r' = cos(φ) · u - sin(φ) · v'
   y_r' = sin(φ) · u + cos(φ) · v'
   ```
   *where `aspect ∈ [0.84, 0.91]` and `φ ∈ [0, π]`.*

---

## 3. Threading Model: Web Worker Decoupling

Live camera feeds stream at 60 frames per second (16.6 ms per frame). Executing heavy computer vision algorithms on the UI thread causes dropped frames and stuttering.

CircleCode decouples processing using a dedicated Web Worker:

```
[Main UI Thread (60 FPS)]                   [Web Worker Thread (Background)]
      │                                                     │
      ├── Capture camera frame (480x480)                    │
      │                                                     │
      ├── Worker busy? ─── Yes ──► Drop frame (Smooth UI)   │
      │       │                                             │
      │       No                                            │
      │       ▼                                             │
      ├── postMessage(ImageData) ──────────────────────────►│
      │                                                     ├── toGrayscale()
      │                                                     ├── findCenter()
      │                                                     ├── finderSweep()
      │                                                     └── tryConfig()
      │                                                             │
      │◄── postMessage(Result) ─────────────────────────────────────┘
      │
      └── Trigger onScan(result) (Instant Lock!)
```

---

## 4. WebAssembly (WASM) Engine Architecture

The native WebAssembly core is compiled from Rust (`circlecode-core`) using `wasm-bindgen` and `wasm-opt`:

- **Binary Size:** 33.7 KB (gzipped / minified).
- **Zero-Copy Memory:** TypedArrays are read directly from WebAssembly linear memory (`WebAssembly.Memory`).
- **SIMD Operations:** Utilizes 128-bit vector instructions on supported CPUs for pixel luminosity averaging.
- **Garbage Collection Immunity:** Zero heap allocations during frame evaluation loop prevents JavaScript garbage collector pauses.
