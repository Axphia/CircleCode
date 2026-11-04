package org.axphia.circlecode;

/**
 * CircleCode Android / Java Native Binding (v1.1.7)
 * Supports both SVG barcode generation and RGBA camera frame decoding via JNI.
 */
public final class CircleCode {

    static {
        System.loadLibrary("circlecode_core");
    }

    private CircleCode() {}

    /**
     * Generates a scalable CircleCode SVG string in LonCle or Circle mode.
     */
    public static native String encodeSvgNative(String payload, int rings, float density, boolean loncle, String centerText);

    /**
     * Low-level JNI call returning a JSON string with full scan result:
     * {"ok":true,"text":"Table-24","len":8,"rings":5,"rot":0.4,"sep":130.0,"fixed":0}
     */
    public static native String scanRgbaJsonNative(byte[] rgba, int width, int height, boolean aggressive);

    /**
     * Generates a CircleCode SVG string.
     */
    public static String encodeSvg(String payload, int rings, float density, boolean loncle, String centerText) {
        if (payload == null) return null;
        return encodeSvgNative(payload, rings <= 0 ? 5 : rings, density <= 0f ? 0.35f : density, loncle, centerText == null ? "Pay" : centerText);
    }

    /**
     * Scans an RGBA8888 frame buffer (width * height * 4 bytes) and returns the JSON result.
     */
    public static String scanRgbaJson(byte[] rgba, int width, int height, boolean aggressive) {
        if (rgba == null || width <= 0 || height <= 0 || rgba.length < width * height * 4) {
            return "{\"ok\":false,\"reason\":\"Invalid buffer size\"}";
        }
        return scanRgbaJsonNative(rgba, width, height, aggressive);
    }
}
