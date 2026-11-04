// CircleCode iOS / macOS SwiftUI Sample App (CircleCodeDemoApp.swift)
// Uses native/bindings/swift/CircleCode.swift and native/include/circlecode.h

import SwiftUI
import CoreGraphics

@main
struct CircleCodeDemoApp: App {
    var body: some Scene {
        WindowGroup {
            CircleCodeContentView()
        }
    }
}

struct CircleCodeContentView: View {
    @State private var payload: String = "Table-24"
    @State private var loncleMode: Bool = true
    @State private var rings: Int = 5
    @State private var svgMarkup: String = ""
    @State private var scanStatus: String = "Ready"

    var body: some View {
        NavigationView {
            VStack(spacing: 16) {
                TextField("Payload Text", text: $payload)
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: payload) { _ in updateSVG() }

                Picker("Rendering Mode", selection: $loncleMode) {
                    Text("LonCle (Connected)").tag(true)
                    Text("Circle (Classic)").tag(false)
                }
                .pickerStyle(.segmented)
                .onChange(of: loncleMode) { _ in updateSVG() }

                Stepper("Rings: \(rings)", value: $rings, in: 4...14) { _ in
                    updateSVG()
                }

                Text(scanStatus)
                    .font(.footnote)
                    .foregroundColor(.secondary)

                ScrollView {
                    Text(svgMarkup)
                        .font(.system(.caption2, design: .monospaced))
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.secondary.opacity(0.1))
                        .cornerRadius(10)
                }
            }
            .padding()
            .navigationTitle("CircleCode v1.1.8")
            .onAppear { updateSVG() }
        }
    }

    private func updateSVG() {
        if let svg = CircleCodeScanner.encodeSVG(
            payload: payload,
            rings: rings,
            density: 0.35,
            loncle: loncleMode,
            centerText: "Pay"
        ) {
            svgMarkup = svg
            scanStatus = "Generated \(loncleMode ? "LonCle" : "Circle") SVG (\(svg.count) bytes)"
        } else {
            svgMarkup = ""
            scanStatus = "Payload exceeds capacity for \(rings) rings"
        }
    }

    /// Pass RGBA8888 frame bytes from AVCaptureVideoDataOutput
    func scanCameraFrame(rgbaData: Data, width: Int, height: Int) {
        let result = CircleCodeScanner.scanRGBA(rgbaData, width: width, height: height, aggressive: true)
        if result.ok, let text = result.text {
            scanStatus = "Decoded: \(text) (\(result.rings) rings)"
        }
    }
}

