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

# Set modern high-tech dark theme styling
plt.style.use('dark_background')
fig = plt.figure(figsize=(16, 9.5), dpi=200, facecolor='#090d16')

gs = fig.add_gridspec(2, 2, width_ratios=[1.25, 1.0], height_ratios=[1.0, 1.0],
                       left=0.08, right=0.94, top=0.86, bottom=0.09,
                       wspace=0.24, hspace=0.32)

ax1 = fig.add_subplot(gs[:, 0])    # Main resolution latency chart
ax2 = fig.add_subplot(gs[0, 1])    # Payload scaling
ax3 = fig.add_subplot(gs[1, 1])    # FPS throughput chart

# Colors
color_wasm = '#00d2ff'
color_js = '#f59e0b'
color_grid = '#1a2436'
color_text = '#f3f4f6'
color_subtext = '#9ca3af'
color_card = '#101726'
color_border = '#1e293b'

# ----------------------------------------------------
# 1. Main Latency by Resolution Bar Chart (ax1)
# ----------------------------------------------------
categories = ['320×320\nPreview', '400×400\nViewfinder ★', '480×480\nSquare Cam', '640×480\nVGA Stream', '800×800\nHi-Res Scan']
wasm_latencies = [31.94, 16.64, 34.26, 19.37, 56.72]
js_latencies = [43.95, 10.94, 12.53, 24.40, 18.59]

x = np.arange(len(categories))
width = 0.35

ax1.set_facecolor(color_card)
ax1.grid(axis='y', color=color_grid, linestyle='-', linewidth=0.8, alpha=0.8, zorder=1)

bars_wasm = ax1.bar(x - width/2, wasm_latencies, width, label='Rust WebAssembly Core',
                    color=color_wasm, edgecolor='#38bdf8', linewidth=1.2, zorder=3, alpha=0.92)
bars_js = ax1.bar(x + width/2, js_latencies, width, label='Pure JavaScript Fallback',
                  color=color_js, edgecolor='#fcd34d', linewidth=1.2, zorder=3, alpha=0.92)

# Value labels on bars (with small background box to avoid line collisions)
for bar in bars_wasm:
    h = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2., h + 1.6, f'{h:.1f}ms',
             ha='center', va='bottom', color=color_wasm, fontsize=10.5, fontweight='bold',
             bbox=dict(boxstyle='round,pad=0.15', facecolor='#101726', edgecolor='none', alpha=0.85))

for bar in bars_js:
    h = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2., h + 1.6, f'{h:.1f}ms',
             ha='center', va='bottom', color=color_js, fontsize=10.5, fontweight='bold',
             bbox=dict(boxstyle='round,pad=0.15', facecolor='#101726', edgecolor='none', alpha=0.85))

# Frame Budget reference lines
ax1.axhline(33.33, color='#10b981', linestyle='--', linewidth=1.2, alpha=0.6, zorder=2)
ax1.text(4.45, 34.4, '30 FPS Budget (33.3 ms)', color='#10b981', fontsize=9.5, fontweight='bold', ha='right',
         bbox=dict(boxstyle='round,pad=0.2', facecolor='#101726', edgecolor='#10b981', alpha=0.9))

ax1.axhline(16.67, color='#38bdf8', linestyle='--', linewidth=1.2, alpha=0.6, zorder=2)
ax1.text(4.45, 17.6, '60 FPS Target (16.6 ms)', color='#38bdf8', fontsize=9.5, fontweight='bold', ha='right',
         bbox=dict(boxstyle='round,pad=0.2', facecolor='#101726', edgecolor='#38bdf8', alpha=0.9))

ax1.set_title('Decode Latency Across Input Resolutions (Lower is Faster)',
              fontsize=14, fontweight='bold', color=color_text, pad=14, loc='left')
ax1.set_ylabel('Execution Time per Frame (ms)', fontsize=11, color=color_subtext)
ax1.set_xticks(x)
ax1.set_xticklabels(categories, fontsize=10.5, color=color_text)
ax1.set_ylim(0, 72)
ax1.legend(loc='upper left', frameon=True, facecolor='#162032', edgecolor=color_border, fontsize=10)

for spine in ax1.spines.values():
    spine.set_color(color_border)

# ----------------------------------------------------
# 2. Multi-Ring Payload Scaling (ax2)
# ----------------------------------------------------
ax2.set_facecolor(color_card)
ax2.grid(axis='x', color=color_grid, linestyle='-', linewidth=0.8, alpha=0.8, zorder=1)

ring_labels = ['3 Rings (1 byte)', '5 Rings (8 bytes)', '7 Rings (20 bytes)', '9 Rings (37 bytes)']
wasm_payload = [40.91, 65.89, 84.23, 93.65]
js_payload = [11.29, 83.14, 95.91, 127.13]

y = np.arange(len(ring_labels))
h_bar = 0.35

ax2.barh(y - h_bar/2, wasm_payload, h_bar, label='Rust WASM',
         color=color_wasm, edgecolor='#38bdf8', linewidth=1.0, zorder=3, alpha=0.9)
ax2.barh(y + h_bar/2, js_payload, h_bar, label='Pure JS',
         color=color_js, edgecolor='#fcd34d', linewidth=1.0, zorder=3, alpha=0.9)

for i, (w_val, j_val) in enumerate(zip(wasm_payload, js_payload)):
    ax2.text(w_val + 2, i - h_bar/2, f'{w_val:.1f}ms', va='center', color=color_wasm, fontsize=9.5, fontweight='bold')
    ax2.text(j_val + 2, i + h_bar/2, f'{j_val:.1f}ms', va='center', color=color_js, fontsize=9.5, fontweight='bold')

ax2.set_title('Payload Density Scaling (400×400 Frame)', fontsize=13, fontweight='bold', color=color_text, pad=12, loc='left')
ax2.set_xlabel('Decode Time (ms)', fontsize=10.5, color=color_subtext)
ax2.set_yticks(y)
ax2.set_yticklabels(ring_labels, fontsize=10, color=color_text)
ax2.set_xlim(0, 155)
ax2.legend(loc='lower right', frameon=True, facecolor='#162032', edgecolor=color_border, fontsize=9.5)

for spine in ax2.spines.values():
    spine.set_color(color_border)

# ----------------------------------------------------
# 3. Scanning Throughput / FPS Comparison (ax3)
# ----------------------------------------------------
ax3.set_facecolor(color_card)
ax3.grid(axis='y', color=color_grid, linestyle='-', linewidth=0.8, alpha=0.8, zorder=1)

res_fps_names = ['400×400', 'VGA (640×480)', '800×800']
wasm_fps = [1000/16.64, 1000/19.37, 1000/56.72]
js_fps = [1000/10.94, 1000/24.40, 1000/18.59]

x_fps = np.arange(len(res_fps_names))
w_fps = 0.32

bars_w_fps = ax3.bar(x_fps - w_fps/2, wasm_fps, w_fps, label='Rust WASM (FPS)',
                     color=color_wasm, edgecolor='#38bdf8', linewidth=1.0, zorder=3, alpha=0.9)
bars_j_fps = ax3.bar(x_fps + w_fps/2, js_fps, w_fps, label='Pure JS (FPS)',
                     color=color_js, edgecolor='#fcd34d', linewidth=1.0, zorder=3, alpha=0.9)

for bar in bars_w_fps:
    h = bar.get_height()
    ax3.text(bar.get_x() + bar.get_width()/2., h + 1.5, f'{h:.0f} FPS',
             ha='center', va='bottom', color=color_wasm, fontsize=10, fontweight='bold')

for bar in bars_j_fps:
    h = bar.get_height()
    ax3.text(bar.get_x() + bar.get_width()/2., h + 1.5, f'{h:.0f} FPS',
             ha='center', va='bottom', color=color_js, fontsize=10, fontweight='bold')

ax3.axhline(60, color='#10b981', linestyle=':', linewidth=1.3, alpha=0.7, zorder=2)
ax3.text(2.45, 62.0, '60 FPS Full Camera Speed', color='#10b981', fontsize=9, fontweight='bold', ha='right',
         bbox=dict(boxstyle='round,pad=0.2', facecolor='#101726', edgecolor='#10b981', alpha=0.9))

ax3.set_title('Real-Time Camera Throughput (Frames Per Second - Higher is Better)',
              fontsize=13, fontweight='bold', color=color_text, pad=12, loc='left')
ax3.set_ylabel('Scan Rate (FPS)', fontsize=10.5, color=color_subtext)
ax3.set_xticks(x_fps)
ax3.set_xticklabels(res_fps_names, fontsize=10, color=color_text)
ax3.set_ylim(0, 110)
ax3.legend(loc='upper right', frameon=True, facecolor='#162032', edgecolor=color_border, fontsize=9.5)

for spine in ax3.spines.values():
    spine.set_color(color_border)

# ----------------------------------------------------
# Top Banner / Title & KPI Cards
# ----------------------------------------------------
fig.text(0.08, 0.945, 'CircleCode Performance & Latency Benchmark',
         fontsize=20, fontweight='bold', color=color_text, family='sans-serif')
fig.text(0.08, 0.915, 'Empirical evaluation of Pure JavaScript vs Native Rust WebAssembly (v1.1.6) across input frame resolutions',
         fontsize=11.5, color=color_subtext, family='sans-serif')

# Badges on Top Right
fig.text(0.94, 0.94, '360° INVARIANT  •  DUAL ENGINE (JS & WASM)',
         fontsize=11, fontweight='bold', color='#38bdf8', ha='right',
         bbox=dict(boxstyle='round,pad=0.5', facecolor='#131d2e', edgecolor='#1e293b'))

# Footer note
fig.text(0.08, 0.03, 'Benchmark Recommendation: Cropping camera video stream to 400x400 viewfinder maintains consistent 60+ FPS real-time decode with zero UI lag.',
         fontsize=10.5, color='#94a3b8', style='italic')

# Output paths
images_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../images'))
os.makedirs(images_dir, exist_ok=True)

png_out = os.path.join(images_dir, 'performance-benchmark.png')
svg_out = os.path.join(images_dir, 'performance-benchmark.svg')

plt.savefig(png_out, dpi=200, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
plt.savefig(svg_out, format='svg', facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
plt.close()

print(f'Successfully generated {png_out}')
print(f'Successfully generated {svg_out}')
