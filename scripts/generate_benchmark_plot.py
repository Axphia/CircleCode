import json
import os
import matplotlib.pyplot as plt
import numpy as np

# Load benchmark data if available
benchmark_data_path = os.path.join(os.path.dirname(__file__), 'benchmark-data.json')
if os.path.exists(benchmark_data_path):
    with open(benchmark_data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
else:
    data = {}

# Use standard default Matplotlib style
plt.style.use('default')
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5), dpi=150)

# 1. Decode Latency by Resolution
categories = ['320x320', '400x400', '480x480', '640x480', '800x800']
wasm_latencies = [31.94, 16.64, 34.26, 19.37, 56.72]
js_latencies = [43.95, 10.94, 12.53, 24.40, 18.59]

x = np.arange(len(categories))
width = 0.35

b1 = ax1.bar(x - width / 2, wasm_latencies, width, label='Rust WASM')
b2 = ax1.bar(x + width / 2, js_latencies, width, label='Pure JS')
ax1.bar_label(b1, fmt='%.1f', padding=2, fontsize=8)
ax1.bar_label(b2, fmt='%.1f', padding=2, fontsize=8)
ax1.axhline(16.67, color='gray', linestyle='--', linewidth=1, label='60 FPS (16.7 ms)')
ax1.set_title('Decode Latency by Resolution')
ax1.set_xlabel('Resolution')
ax1.set_ylabel('Time (ms)')
ax1.set_xticks(x)
ax1.set_xticklabels(categories)
ax1.set_ylim(0, 65)
ax1.grid(axis='y', linestyle=':', alpha=0.6)
ax1.legend()

# 2. Payload Scaling (400x400)
ring_labels = ['3 Rings\n(1B)', '5 Rings\n(8B)', '7 Rings\n(20B)', '9 Rings\n(37B)']
wasm_payload = [40.91, 65.89, 84.23, 93.65]
js_payload = [11.29, 83.14, 95.91, 127.13]

x2 = np.arange(len(ring_labels))
b3 = ax2.bar(x2 - width / 2, wasm_payload, width, label='Rust WASM')
b4 = ax2.bar(x2 + width / 2, js_payload, width, label='Pure JS')
ax2.bar_label(b3, fmt='%.1f', padding=2, fontsize=8)
ax2.bar_label(b4, fmt='%.1f', padding=2, fontsize=8)
ax2.set_title('Payload Scaling (400x400)')
ax2.set_xlabel('Ring Count / Payload Size')
ax2.set_ylabel('Time (ms)')
ax2.set_xticks(x2)
ax2.set_xticklabels(ring_labels)
ax2.set_ylim(0, 145)
ax2.grid(axis='y', linestyle=':', alpha=0.6)
ax2.legend()

plt.tight_layout()

images_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../images'))
os.makedirs(images_dir, exist_ok=True)

png_out = os.path.join(images_dir, 'performance-benchmark.png')
svg_out = os.path.join(images_dir, 'performance-benchmark.svg')

plt.savefig(png_out, dpi=150)
plt.savefig(svg_out, format='svg')
plt.close()

print(f'Saved default Matplotlib benchmark plot to {png_out} and {svg_out}')
