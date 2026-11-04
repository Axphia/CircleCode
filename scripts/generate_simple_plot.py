import os
import matplotlib.pyplot as plt
import numpy as np

# Use standard default Matplotlib style
plt.style.use('default')
fig, ax = plt.subplots(figsize=(8, 5), dpi=150)

# Data
resolutions = ['400x400', '480x480', '640x480', '800x800']
wasm_ms = [16.6, 34.3, 19.4, 56.7]
js_ms = [10.9, 12.5, 24.4, 18.6]

x = np.arange(len(resolutions))
width = 0.35

# Bars using default Matplotlib color cycle (C0 = tab:blue, C1 = tab:orange)
bars_wasm = ax.bar(x - width / 2, wasm_ms, width, label='Rust WebAssembly (wasm)')
bars_js = ax.bar(x + width / 2, js_ms, width, label='Pure JavaScript (js)')

# Value labels on top of bars
ax.bar_label(bars_wasm, fmt='%.1f', padding=3)
ax.bar_label(bars_js, fmt='%.1f', padding=3)

# 60 FPS reference line (16.67 ms)
ax.axhline(16.67, color='gray', linestyle='--', linewidth=1, label='60 FPS target (16.7 ms)')

# Standard labels, title, grid, and legend
ax.set_title('CircleCode Decode Time by Resolution')
ax.set_xlabel('Input Resolution (pixels)')
ax.set_ylabel('Decode Time (ms)')
ax.set_xticks(x)
ax.set_xticklabels(resolutions)
ax.set_ylim(0, 65)
ax.grid(axis='y', linestyle=':', alpha=0.6)
ax.legend()

plt.tight_layout()

# Save outputs
images_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../images'))
os.makedirs(images_dir, exist_ok=True)

png_out = os.path.join(images_dir, 'performance-benchmark.png')
svg_out = os.path.join(images_dir, 'performance-benchmark.svg')

plt.savefig(png_out, dpi=150)
plt.savefig(svg_out, format='svg')
plt.close()

print(f'Saved default Matplotlib plot to {png_out} and {svg_out}')
