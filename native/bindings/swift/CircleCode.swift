// CircleCode Swift Binding for iOS & macOS (v1.1.7)
// Links against libcirclecode_core.a / circlecode_core.xcframework and native/include/circlecode.h

import Foundation

public struct CircleCodeScanResult {
    public let ok: Bool
    public let text: String?
    public let rings: Int
    public let rotationRadians: Float
    public let separation: Float
    public let correctedBits: Int
}

public enum CircleCodeScanner {
    /// Generates a CircleCode SVG string (in LonCle or Circle mode).
    public static func encodeSVG(
        payload: String,
        rings: Int = 5,
        density: Float = 0.35,
        loncle: Bool = true,
        centerText: String = "Pay"
    ) -> String? {
        return payload.withCString { payloadCStr in
            return centerText.withCString { centerCStr in
                guard let svgPtr = circlecode_encode_svg(
                    payloadCStr,
                    rings,
                    density,
                    loncle ? 1 : 0,
                    centerCStr
                ) else {
                    return nil
                }
                defer { circlecode_free_string(svgPtr) }
                return String(cString: svgPtr)
            }
        }
    }

    /// Scans an RGBA8888 pixel buffer (`width * height * 4` bytes).
    public static func scanRGBA(
        _ rgba: Data,
        width: Int,
        height: Int,
        aggressive: Bool = true
    ) -> CircleCodeScanResult {
        guard rgba.count >= width * height * 4 else {
            return CircleCodeScanResult(ok: false, text: nil, rings: 0, rotationRadians: 0, separation: 0, correctedBits: 0)
        }

        var meta = CircleCodeResultC(ok: 0, len: 0, chk: 0, rings: 0, density: 0, rot: 0, sep: 0, fixed: 0)
        var textBuffer = [UInt8](repeating: 0, count: 256)

        let decodedLen: Int32 = rgba.withUnsafeBytes { rawBuffer in
            guard let baseAddress = rawBuffer.bindMemory(to: UInt8.self).baseAddress else {
                return -1
            }
            return circlecode_scan_rgba(
                baseAddress,
                rgba.count,
                width,
                height,
                aggressive ? 1 : 0,
                &textBuffer,
                textBuffer.count,
                &meta
            )
        }

        if decodedLen > 0 && meta.ok == 1 {
            let text = String(bytes: textBuffer.prefix(Int(decodedLen)), encoding: .utf8)
            return CircleCodeScanResult(
                ok: true,
                text: text,
                rings: Int(meta.rings),
                rotationRadians: meta.rot,
                separation: meta.sep,
                correctedBits: Int(meta.fixed)
            )
        }

        return CircleCodeScanResult(ok: false, text: nil, rings: 0, rotationRadians: 0, separation: 0, correctedBits: 0)
    }
}
