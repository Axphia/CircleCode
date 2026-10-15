# CircleCode Technical Specification

This document defines the physical geometry, slot distribution, binary framing, checksum verification, and error-correction strategy for the CircleCode format.

---

## 1. Physical Geometry & Radii

A CircleCode barcode is normalized to an outer boundary disc of radius **`R = 190`** (units relative to origin `(0, 0)`).

```
                      +-----------------------------+
                      |       Disc Border (R=190)   |
                      |   +---------------------+   |
                      |   |    Outer Ring (157) |   |
                      |   |  +---------------+  |   |
                      |   |  | Ring ...      |  |   |
                      |   |  | +-----------+ |  |   |
                      |   |  | | Ring 0(55)| |  |   |
                      |   |  | | (Badge 42)| |  |   |
                      |   |  | +-----------+ |  |   |
                      |   |  +---------------+  |   |
                      |   +---------------------+   |
                      +-----------------------------+
```

### Key Dimensions:
| Feature | Radius (normalized) | Description |
| :--- | :--- | :--- |
| **Center Badge** | `r = 42` | Solid circular zone reserved for brand logo/icon. Acts as the primary subpixel centroid & scale reference. |
| **Ring 0 (Inner Start)** | `r = 55` | Innermost data ring. |
| **Ring k-1 (Outer End)** | `r = 157` | Outermost data ring. |
| **Disc Perimeter** | `r = 190` | Exterior boundary border. |

### Radii Distribution:
For `k` concentric rings:
- If `k == 1`: `r = 110`
- If `k > 1`: For ring index `i ∈ [0, k - 1]`:
  ```text
  radius(i) = 55 + (157 - 55) × (i / (k - 1))
  ```

---

## 2. Slot Allocation & Dash Geometry

Each ring `i` is divided into `n_i` angular slots:
```text
n_i = max(12, ⌊r_i × density⌋)
```
where standard **`density = 0.35`**.

### Standard 5-Ring Slot Distribution:
| Ring Index | Radius ($r_i$) | Slot Count ($n_i$) | Data Capacity ($n_i - 1$) |
| :---: | :---: | :---: | :---: |
| 0 | 55.0 | 19 | 18 bits |
| 1 | 80.5 | 28 | 27 bits |
| 2 | 106.0 | 37 | 36 bits |
| 3 | 131.5 | 46 | 45 bits |
| 4 | 157.0 | 54 | 53 bits |
| **Total** | — | **184 slots** | **179 data bits** (22.3 bytes) |

### Dash Dimensions within a Slot:
Each slot subtends an angle `Δθ = 2π / n_i`.
- **Dash Body:** spans from `0.28 × Δθ` to `0.72 × Δθ` (width: `0.44 × Δθ`).
- **Dash Stroke Thickness:** `w = 5.2` units (`dr = ±2.6`).
- **Sampling Median Taps:** sampled at slot center with offset `±0.14 × Δθ`.

---

## 3. Finder Pattern (360° Alignment)

Slot `0` on **every ring** is reserved as an alignment **Finder Dash**:
- Finder slot `0` is **always active (solid black)** across all rings.
- When aligned, the finder dashes form a straight radial spoke pointing from the center badge outward.
- **360° Orientation Invariance:** The decoder sweeps 360° in `1.8°` steps to find the rotation angle `θ_0` that minimizes the aggregate luminance across all ring finders.

---

## 4. Binary Framing & Header Structure

All data bits are streamed from Ring 0 to Ring `k - 1`, and within each ring from Slot 1 to Slot `n_i - 1`:

```
+-------------------+-----------------------------+-------------------+
| 16-Bit Header     | Variable Payload            | 8-Bit Checksum    |
| Length L (bytes)  | L * 8 Data Bits (UTF-8)     | Sum of L Bytes    |
+-------------------+-----------------------------+-------------------+
  Bits [0 .. 15]        Bits [16 .. 16 + 8L - 1]      Bits [16+8L .. end]
```

### 16-Bit Length Header:
- Stored in big-endian bit order: `Bits[0]` (MSB) to `Bits[15]` (LSB).
- Value represents the byte count `L` of the payload string.

### Payload Data:
- Encoded as raw UTF-8 octets, MSB first.

### Checksum Byte:
- 8-bit checksum evaluated as the modulo-256 sum of all payload octets:
  ```text
  chk = (Σ byte_q) mod 256  [for q = 0 to L - 1]
  ```

---

## 5. Mathematical Error Correction Strategy

When surface scratches, camera noise, or glare cause bit flips:

1. **Syndrome Delta Evaluation:**
   ```text
   Δ = (chk - sum) mod 256
   ```
2. **Confidence-Sorted Bit Pool:**
   For every bit `i`, its distance from the Otsu threshold defines its confidence:
   ```text
   conf_i = |v_i - threshold_ri|
   ```
   Bits with lowest confidence (nearest to the decision boundary) are prioritized.
3. **1-Bit Repair:**
   A bit flip at position `b` causes a change of `±2^b`. If an ambiguous bit satisfies:
   ```text
   bit_i == 0  ⟹  Δ = 2^b
   bit_i == 1  ⟹  Δ = -2^b (mod 256)
   ```
   the bit is repaired.
4. **2-Bit Repair (Aggressive Mode):**
   Evaluates pairs of weak bits `(i_a, i_b)` whose combined weights satisfy:
   ```text
   (±2^(b_a) ± 2^(b_b)) ≡ Δ (mod 256)
   ```
