// CircleCode Flutter / Dart FFI Binding (v1.1.7)
// Supports both Encoding (SVG generation) and Decoding (RGBA frame scanning)
// on Android (libcirclecode_core.so), iOS/macOS (DynamicLibrary.process()), Windows, and Linux.

import 'dart:convert';
import 'dart:ffi' as ffi;
import 'dart:io' show Platform;
import 'dart:typed_data';
import 'package:ffi/ffi.dart';

final class CircleCodeResultC extends ffi.Struct {
  @ffi.Int32()
  external int ok;

  @ffi.Int32()
  external int len;

  @ffi.Uint8()
  external int chk;

  @ffi.Int32()
  external int rings;

  @ffi.Float()
  external double density;

  @ffi.Float()
  external double rot;

  @ffi.Float()
  external double sep;

  @ffi.Int32()
  external int fixed;
}

typedef _EncodeSvgNative = ffi.Pointer<Utf8> Function(
  ffi.Pointer<Utf8> payloadPtr,
  ffi.Size rings,
  ffi.Float density,
  ffi.Int32 loncle,
  ffi.Pointer<Utf8> centerTextPtr,
);

typedef _EncodeSvgDart = ffi.Pointer<Utf8> Function(
  ffi.Pointer<Utf8> payloadPtr,
  int rings,
  double density,
  int loncle,
  ffi.Pointer<Utf8> centerTextPtr,
);

typedef _FreeStringNative = ffi.Void Function(ffi.Pointer<Utf8> ptr);
typedef _FreeStringDart = void Function(ffi.Pointer<Utf8> ptr);

typedef _ScanRgbaNative = ffi.Int32 Function(
  ffi.Pointer<ffi.Uint8> rgbaPtr,
  ffi.Size rgbaLen,
  ffi.Size width,
  ffi.Size height,
  ffi.Int32 aggressive,
  ffi.Pointer<ffi.Uint8> outTextBuf,
  ffi.Size outTextCap,
  ffi.Pointer<CircleCodeResultC> outMeta,
);

typedef _ScanRgbaDart = int Function(
  ffi.Pointer<ffi.Uint8> rgbaPtr,
  int rgbaLen,
  int width,
  int height,
  int aggressive,
  ffi.Pointer<ffi.Uint8> outTextBuf,
  int outTextCap,
  ffi.Pointer<CircleCodeResultC> outMeta,
);

class CircleCodeScanResult {
  final bool ok;
  final String? text;
  final int rings;
  final double rot;
  final double sep;
  final int fixed;

  const CircleCodeScanResult({
    required this.ok,
    this.text,
    this.rings = 0,
    this.rot = 0.0,
    this.sep = 0.0,
    this.fixed = 0,
  });
}

class CircleCodeNative {
  late final ffi.DynamicLibrary _lib;
  late final _EncodeSvgDart _encodeSvg;
  late final _FreeStringDart _freeString;
  late final _ScanRgbaDart _scanRgba;

  CircleCodeNative([ffi.DynamicLibrary? customLib]) {
    _lib = customLib ?? _openDefaultLibrary();
    _encodeSvg = _lib
        .lookup<ffi.NativeFunction<_EncodeSvgNative>>('circlecode_encode_svg')
        .asFunction<_EncodeSvgDart>();
    _freeString = _lib
        .lookup<ffi.NativeFunction<_FreeStringNative>>('circlecode_free_string')
        .asFunction<_FreeStringDart>();
    _scanRgba = _lib
        .lookup<ffi.NativeFunction<_ScanRgbaNative>>('circlecode_scan_rgba')
        .asFunction<_ScanRgbaDart>();
  }

  static ffi.DynamicLibrary _openDefaultLibrary() {
    if (Platform.isAndroid || Platform.isLinux) {
      return ffi.DynamicLibrary.open('libcirclecode_core.so');
    } else if (Platform.isIOS || Platform.isMacOS) {
      return ffi.DynamicLibrary.process();
    } else if (Platform.isWindows) {
      return ffi.DynamicLibrary.open('circlecode_core.dll');
    }
    throw UnsupportedError('Unsupported platform: ${Platform.operatingSystem}');
  }

  /// Generates a CircleCode SVG string (in LonCle or Circle mode).
  String? encodeSvg(
    String payload, {
    int rings = 5,
    double density = 0.35,
    bool loncle = true,
    String centerText = 'Pay',
  }) {
    final payloadPtr = payload.toNativeUtf8();
    final centerPtr = centerText.toNativeUtf8();
    try {
      final resPtr = _encodeSvg(
        payloadPtr,
        rings,
        density,
        loncle ? 1 : 0,
        centerPtr,
      );
      if (resPtr == ffi.nullptr) return null;
      try {
        return resPtr.toDartString();
      } finally {
        _freeString(resPtr);
      }
    } finally {
      calloc.free(payloadPtr);
      calloc.free(centerPtr);
    }
  }

  /// Decodes an RGBA8888 camera or image buffer.
  CircleCodeScanResult scanRgba(
    Uint8List rgbaBytes,
    int width,
    int height, {
    bool aggressive = true,
  }) {
    final framePtr = calloc<ffi.Uint8>(rgbaBytes.length);
    final textBuf = calloc<ffi.Uint8>(256);
    final metaPtr = calloc<CircleCodeResultC>();

    try {
      framePtr.asTypedList(rgbaBytes.length).setAll(0, rgbaBytes);
      final decodedLen = _scanRgba(
        framePtr,
        rgbaBytes.length,
        width,
        height,
        aggressive ? 1 : 0,
        textBuf,
        256,
        metaPtr,
      );

      if (decodedLen > 0 && metaPtr.ref.ok == 1) {
        final payload = utf8.decode(textBuf.asTypedList(decodedLen));
        return CircleCodeScanResult(
          ok: true,
          text: payload,
          rings: metaPtr.ref.rings,
          rot: metaPtr.ref.rot,
          sep: metaPtr.ref.sep,
          fixed: metaPtr.ref.fixed,
        );
      }
      return const CircleCodeScanResult(ok: false);
    } finally {
      calloc.free(framePtr);
      calloc.free(textBuf);
      calloc.free(metaPtr);
    }
  }
}
