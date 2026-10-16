import os
import matplotlib.pyplot as plt
import numpy as np

# Set clean, modern styling
plt.style.use('dark_background')
fig, ax = plt.subplots(figsize=(11, 6.2), dpi=220, facecolor='#0b0f19')
ax.set_facecolor('#111827')

# Data
resolutions = ['400×400\n(Viewfinder)', '480×480\n(Camera Stream)', '640×480\n(VGA)', '800×800\n(High-Res Photo)']
wasm_ms = [16.6, 34.3, 19.4, 56.7]
js_ms = [10.9, 12.5, 24.4, 18.6]

x = np.arange(len(resolutions))
width = 0.30

# Grid lines
ax.grid(axis='y', color='#1f293d', linestyle='--', linewidth=0.8, alpha=0.7, zorder=1)

# Bars
bars_wasm = ax.bar(x - width/2, wasm_ms, width, label='Rust WebAssembly Core',
                   color='#00d2ff', edgecolor='#38bdf8', linewidth=1.2, zorder=3, alpha=0.95)
bars_js = ax.bar(x + width/2, js_ms, width, label='Pure JavaScript Fallback',
                 color='#f59e0b', edgecolor='#fbbf24', linewidth=1.2, zorder=3, alpha=0.95)

# Value labels on top of bars
for bar in bars_wasm:
    h = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., h + 1.4, f'{h:.1f} ms',
            ha='center', va='bottom', color='#00d2ff', fontsize=11, fontweight='bold')

for bar in bars_js:
    h = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., h + 1.4, f'{h:.1f} ms',
            ha='center', va='bottom', color='#fbbf24', fontsize=11, fontweight='bold')

# Frame rate budget line (60 FPS = 16.6ms)
ax.axhline(16.67, color='#10b981', linestyle='--', linewidth=1.5, alpha=0.75, zorder=2)
# Clean label positioned in upper area or with dark background pill so it never collides
ax.text(0.02, 17.6, '  60 FPS Real-Time Target (16.6 ms)  ', color='#10b981', fontsize=9.5, fontweight='bold',
        va='bottom', bbox=dict(boxstyle='round,pad=0.25', facecolor='#111827', edgecolor='#10b981', alpha=0.95))

# Labels and Titles
ax.set_title('CircleCode Decoder Latency by Resolution', fontsize=17, fontweight='bold', color='#f8fafc', pad=20)
ax.set_ylabel('Decode Time per Frame (ms) — Lower is Faster', fontsize=11.5, color='#94a3b8', labelpad=12)
ax.set_xticks(x)
ax.set_xticklabels(resolutions, fontsize=11, color='#e2e8f0')
ax.set_ylim(0, 68)

# Legend
ax.legend(loc='upper left', frameon=True, facecolor='#161f30', edgecolor='#25354f', fontsize=11, framealpha=0.95)

# Spines
for spine in ax.spines.values():
    spine.set_color('#25354f')

plt.tight_layout()

# Save
images_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../images'))
os.makedirs(images_dir, exist_ok=True)

png_out = os.path.join(images_dir, 'performance-benchmark.png')
svg_out = os.path.join(images_dir, 'performance-benchmark.svg')

plt.savefig(png_out, dpi=220, facecolor=fig.get_facecolor(), edgecolor='none')
plt.savefig(svg_out, format='svg', facecolor=fig.get_facecolor(), edgecolor='none')
plt.close()

print(f'✓ Simple benchmark image updated: {png_out}')
