/**
 * CircleCode Native C / C++17 Header (v1.1.8)
 * High-performance circular barcode encoder & decoder ABI for C, C++, Swift, Flutter, and JNI.
 * https://circlecode.js.org
 */

#ifndef CIRCLECODE_H
#define CIRCLECODE_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct CircleCodeResultC {
    int32_t ok;
    int32_t len;
    uint8_t chk;
    int32_t rings;
    float   density;
    float   rot;
    float   sep;
    int32_t fixed;
} CircleCodeResultC;

/**
 * Encodes a UTF-8 payload string into a scalable CircleCode SVG string.
 * Caller MUST free the returned pointer using `circlecode_free_string()`.
 *
 * @param payload_ptr      Null-terminated UTF-8 text payload
 * @param rings            Number of concentric rings (e.g. 5 to 14)
 * @param density          Slot density (default 0.35f)
 * @param loncle           1 for LonCle connected arcs mode, 0 for classic Circle dashed mode
 * @param center_text_ptr  Null-terminated center badge label (or NULL for "Pay")
 * @return                 Heap-allocated null-terminated SVG string, or NULL if payload exceeds capacity
 */
char* circlecode_encode_svg(
    const char* payload_ptr,
    size_t rings,
    float density,
    int32_t loncle,
    const char* center_text_ptr
);

/**
 * Scans an RGBA pixel buffer (width * height * 4 bytes) and writes the decoded
 * null-terminated UTF-8 string into `out_text_buf`.
 *
 * @param rgba_ptr      Pointer to RGBA pixel bytes
 * @param rgba_len      Total byte length of rgba_ptr (must be >= width * height * 4)
 * @param width         Frame width in pixels
 * @param height        Frame height in pixels
 * @param aggressive    1 to enable 1-bit & 2-bit checksum error recovery, 0 for strict
 * @param out_text_buf  Output buffer for UTF-8 decoded payload (may be NULL)
 * @param out_text_cap  Capacity of `out_text_buf` in bytes (e.g. 256)
 * @param out_meta      Optional pointer to CircleCodeResultC metadata struct (may be NULL)
 * @return              > 0: number of UTF-8 bytes decoded; 0: no code detected; < 0: invalid buffer
 */
int32_t circlecode_scan_rgba(
    const uint8_t* rgba_ptr,
    size_t rgba_len,
    size_t width,
    size_t height,
    int32_t aggressive,
    uint8_t* out_text_buf,
    size_t out_text_cap,
    CircleCodeResultC* out_meta
);

/**
 * Scans an RGBA pixel buffer and returns a heap-allocated JSON string with full scan telemetry.
 * Caller MUST free the returned string using `circlecode_free_string()`.
 */
char* circlecode_scan_rgba_json(
    const uint8_t* rgba_ptr,
    size_t rgba_len,
    size_t width,
    size_t height,
    int32_t aggressive
);

/**
 * Frees a heap-allocated string returned by `circlecode_scan_rgba_json()` or `circlecode_encode_svg()`.
 */
void circlecode_free_string(char* ptr);

#ifdef __cplusplus
} // extern "C"

#include <string>

namespace circlecode {

struct ScanOutcome {
    bool ok = false;
    std::string text;
    int rings = 0;
    float density = 0.0f;
    float rot = 0.0f;
    float sep = 0.0f;
    int fixed = 0;
};

inline std::string encode_svg(
    const std::string& payload,
    size_t rings = 5,
    float density = 0.35f,
    bool loncle = true,
    const std::string& center_text = "Pay"
) {
    char* ptr = circlecode_encode_svg(
        payload.c_str(),
        rings,
        density,
        loncle ? 1 : 0,
        center_text.c_str()
    );
    if (!ptr) return {};
    std::string svg(ptr);
    circlecode_free_string(ptr);
    return svg;
}

inline ScanOutcome scan_rgba(
    const uint8_t* rgba,
    size_t width,
    size_t height,
    bool aggressive = true
) {
    ScanOutcome out;
    CircleCodeResultC meta{};
    char buf[256] = {0};
    int32_t n = circlecode_scan_rgba(
        rgba,
        width * height * 4,
        width,
        height,
        aggressive ? 1 : 0,
        reinterpret_cast<uint8_t*>(buf),
        sizeof(buf),
        &meta
    );
    if (n > 0 && meta.ok) {
        out.ok = true;
        out.text.assign(buf, static_cast<size_t>(n));
        out.rings = meta.rings;
        out.density = meta.density;
        out.rot = meta.rot;
        out.sep = meta.sep;
        out.fixed = meta.fixed;
    }
    return out;
}

} // namespace circlecode
#endif

#endif // CIRCLECODE_H
