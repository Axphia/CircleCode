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
For $k$ concentric rings:
- If $k = 1$: $r = 110$
- If $k > 1$: For ring index $i \in [0, k - 1]$:
  $$\text{radius}(i) = 55 + (157 - 55) \times \frac{i}{k - 1}$$

---

## 2. Slot Allocation & Dash Geometry

Each ring $i$ is divided into $n_i$ angular slots:
$$n_i = \max\left(12, \; \lfloor r_i \times \text{density} \rfloor\right)$$
where standard **$\text{density} = 0.35$**.

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
Each slot subtends an angle $\Delta \theta = \frac{2\pi}{n_i}$.
- **Dash Body:** spans from $0.28 \times \Delta \theta$ to $0.72 \times \Delta \theta$ (width: $0.44 \times \Delta \theta$).
- **Dash Stroke Thickness:** $w = 5.2$ units ($dr = \pm 2.6$).
- **Sampling Median Taps:** sampled at slot center with offset $\pm 0.14 \times \Delta \theta$.

---

## 3. Finder Pattern (360° Alignment)

Slot $0$ on **every ring** is reserved as an alignment **Finder Dash**:
- Finder slot $0$ is **always active (solid black)** across all rings.
- When aligned, the finder dashes form a straight radial spoke pointing from the center badge outward.
- **360° Orientation Invariance:** The decoder sweeps 360° in $1.8^\circ$ steps to find the rotation angle $\theta_0$ that minimizes the aggregate luminance across all ring finders:
  $$\theta_0 = \arg\min_{\theta \in [0, 2\pi)} \frac{1}{k} \sum_{i=0}^{k-1} \text{Luminance}(r_i, \theta)$$

---

## 4. Binary Framing & Header Structure

All data bits are streamed from Ring 0 to Ring $k - 1$, and within each ring from Slot 1 to Slot $n_i - 1$:

```
+-------------------+-----------------------------+-------------------+
| 16-Bit Header     | Variable Payload            | 8-Bit Checksum    |
| Length L (bytes)  | L * 8 Data Bits (UTF-8)     | Sum of L Bytes    |
+-------------------+-----------------------------+-------------------+
  Bits [0 .. 15]        Bits [16 .. 16 + 8L - 1]      Bits [16+8L .. end]
```

### 16-Bit Length Header:
- Stored in big-endian bit order: $\text{Bits}[0]$ (MSB) to $\text{Bits}[15]$ (LSB).
- Value represents the byte count $L$ of the payload string:
  $$L = \sum_{j=0}^{15} \text{Bits}[j] \cdot 2^{15 - j}$$

### Payload Data:
- Encoded as raw UTF-8 octets, MSB first.

### Checksum Byte:
- 8-bit checksum evaluated as the modulo-256 sum of all payload octets:
  $$\text{chk} = \left(\sum_{q=0}^{L-1} \text{byte}_q\right) \pmod{256}$$

---

## 5. Mathematical Error Correction Strategy

When surface scratches, camera noise, or glare cause bit flips:

1. **Syndrome Delta Evaluation:**
   $$\Delta = (\text{chk} - \text{sum}) \pmod{256}$$

2. **Confidence-Sorted Bit Pool:**
   For every bit $i$, its distance from the Otsu decision threshold defines its confidence:
   $$\text{conf}_i = |v_i - \text{threshold}_{r_i}|$$
   Bits with lowest confidence (nearest to the decision boundary) are prioritized for error recovery.

3. **1-Bit Repair:**
   A bit flip at position $b \in [0, 7]$ within a byte causes a weight shift of $\pm 2^b$:
   $$\text{bit}_i = 0 \implies \Delta \equiv 2^b \pmod{256} \quad \text{or} \quad \text{bit}_i = 1 \implies \Delta \equiv -2^b \pmod{256}$$
   When this condition holds, the bit is flipped to restore checksum parity.

4. **2-Bit Repair (Aggressive Mode):**
   Evaluates pairs of weak bits $(i_a, i_b)$ whose combined binary weights satisfy:
   $$(\pm 2^{b_a} \pm 2^{b_b}) \equiv \Delta \pmod{256}$$
