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
The black circular center badge ($r = 42$) provides an anchor that is invariant to orientation.

Annular contrast operator:

$$\text{Score} = \text{Mean}_{\text{out}}(1.10 \times r) - \text{Mean}_{\text{in}}(0.82 \times r)$$

First-order spatial moments for subpixel center refinement:

$$c_x = \frac{\sum_{i=1}^N x_i}{N}, \qquad c_y = \frac{\sum_{i=1}^N y_i}{N}, \qquad r_{\text{refined}} = \sqrt{\frac{N}{\pi}}$$

### Stage 3: Perspective & Tilt Compensation
When captured at an oblique angle, circular codes distort into ellipses.
The sampling engine applies an inverse coordinate transformation:

$$\begin{bmatrix} u \\ v \end{bmatrix} = \begin{bmatrix} \cos\phi & \sin\phi \\ -\sin\phi & \cos\phi \end{bmatrix} \begin{bmatrix} x_r \\ y_r \end{bmatrix}$$

$$v' = v \times \text{aspect}$$

$$\begin{bmatrix} x_r' \\ y_r' \end{bmatrix} = \begin{bmatrix} \cos\phi & -\sin\phi \\ \sin\phi & \cos\phi \end{bmatrix} \begin{bmatrix} u \\ v' \end{bmatrix}$$

where $\text{aspect} \in [0.84, 0.91]$ and $\phi \in [0, \pi]$.

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
