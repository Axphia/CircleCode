/**
 * CircleCode C++17 Sample Application
 * Demonstrates encoding a CircleCode SVG and scanning an RGBA buffer via circlecode.h.
 */

#include <iostream>
#include <vector>
#include "../../native/include/circlecode.h"

int main() {
    // 1. Encode a payload into a LonCle SVG barcode
    std::string payload = "Table-24";
    std::string svg = circlecode::encode_svg(payload, 5, 0.35f, true, "Pay");

    if (!svg.empty()) {
        std::cout << "[CircleCode C++] Generated SVG for \"" << payload
                  << "\" (" << svg.size() << " bytes)\n";
    } else {
        std::cerr << "[CircleCode C++] Failed to encode payload\n";
        return 1;
    }

    // 2. Scan an example 400x400 RGBA buffer
    const size_t width = 400;
    const size_t height = 400;
    std::vector<uint8_t> rgba(width * height * 4, 255);

    circlecode::ScanOutcome res = circlecode::scan_rgba(rgba.data(), width, height, true);
    std::cout << "[CircleCode C++] Scan outcome on blank buffer: ok="
              << (res.ok ? "true" : "false") << "\n";

    return 0;
}

