// CircleCode Flutter Sample App (lib/main.dart)
// Demonstrates generating CircleCode SVGs and scanning RGBA camera frames via dart:ffi.

import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../native/bindings/flutter/circlecode_ffi.dart';

void main() {
  runApp(const CircleCodeSampleApp());
}

class CircleCodeSampleApp extends StatelessWidget {
  const CircleCodeSampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CircleCode Flutter Demo',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0071E3)),
        useMaterial3: true,
      ),
      home: const CircleCodeHomeScreen(),
    );
  }
}

class CircleCodeHomeScreen extends StatefulWidget {
  const CircleCodeHomeScreen({super.key});

  @override
  State<CircleCodeHomeScreen> createState() => _CircleCodeHomeScreenState();
}

class _CircleCodeHomeScreenState extends State<CircleCodeHomeScreen> {
  final TextEditingController _payloadController =
      TextEditingController(text: 'Table-24');
  late final CircleCodeNative _circleCode;

  bool _loncleMode = true;
  int _rings = 5;
  String? _generatedSvg;
  String _scanStatus = 'Ready to generate or scan CircleCode';

  @override
  void initState() {
    super.initState();
    _circleCode = CircleCodeNative();
    _generateBarcode();
  }

  void _generateBarcode() {
    final svg = _circleCode.encodeSvg(
      _payloadController.text,
      rings: _rings,
      density: 0.35,
      loncle: _loncleMode,
      centerText: 'Pay',
    );
    setState(() {
      _generatedSvg = svg;
      _scanStatus = svg != null
          ? 'Generated ${_loncleMode ? "LonCle" : "Circle"} SVG (${svg.length} bytes)'
          : 'Payload too long for $_rings rings';
    });
  }

  /// Call this method from a CameraController image stream (RGBA8888 format)
  void onCameraFrame(Uint8List rgbaBytes, int width, int height) {
    final res = _circleCode.scanRgba(rgbaBytes, width, height, aggressive: true);
    if (res.ok && res.text != null) {
      setState(() {
        _scanStatus =
            'Decoded: "${res.text}" (${res.rings} rings, fixed=${res.fixed})';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CircleCode v1.1.8 — Flutter FFI')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _payloadController,
              decoration: const InputDecoration(
                labelText: 'Payload Text / URL',
                border: OutlineInputBorder(),
              ),
              onChanged: (_) => _generateBarcode(),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Text('Mode: '),
                ChoiceChip(
                  label: const Text('LonCle (Connected)'),
                  selected: _loncleMode,
                  onSelected: (v) {
                    setState(() => _loncleMode = true);
                    _generateBarcode();
                  },
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Circle (Classic)'),
                  selected: !_loncleMode,
                  onSelected: (v) {
                    setState(() => _loncleMode = false);
                    _generateBarcode();
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(_scanStatus, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: SingleChildScrollView(
                  child: SelectableText(
                    _generatedSvg ?? 'No SVG output',
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 11),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

