import { buildEccModel, frameFromModel, modelWithFrame, decodeFrame } from './codec.js';
import { renderToCanvas, renderToSVG } from './legacy/circle-code.js';
import { modeCapacity } from './packing.js';

const element = id => document.getElementById(id);
let model = null, originalFrame = null, damagedFrame = null;
let worker = null, pendingScan = null, scanId = 0, scanBusy = false;
const rendering = () => ({ style: element('style').value, center: 'Code', bg: '#ffffff' });

function setText(id, text) { element(id).textContent = text; }
function resultText(result) {
  return result.mode === 'binary' ? [...result.bytes].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ') || '(ไบนารีว่าง)' : result.text || '(ข้อความว่าง)';
}
function draw(canvas, nextModel) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (nextModel) renderToCanvas(nextModel, context, canvas.width, rendering());
}
function renderExperiment() {
  if (!model) return;
  const result = decodeFrame(damagedFrame);
  let changedBytes = 0, changedBits = 0;
  for (let i = 0; i < originalFrame.length; i++) {
    let difference = originalFrame[i] ^ damagedFrame[i];
    if (difference) changedBytes++;
    while (difference) { changedBits++; difference &= difference - 1; }
  }
  const matched = result.ok && (typeof model.payload === 'string' ? result.text === model.payload :
    result.bytes.length === model.payload.length && result.bytes.every((byte, index) => byte === model.payload[index]));
  draw(element('clean'), model);
  draw(element('damaged'), modelWithFrame(model, damagedFrame));
  draw(element('recovered'), result.ok ? modelWithFrame(model, result.codeword) : null);
  element('decode-status').classList.toggle('error', !matched);
  setText('decode-title', matched ? 'กู้ข้อมูลตรงกับต้นฉบับ' : result.ok ? 'ข้อความไม่ตรงกับต้นฉบับ' : 'ปฏิเสธผล / กู้ข้อมูลไม่ได้');
  setText('decoded-text', result.ok ? resultText(result) : result.reason);
  setText('corrected-count', result.ok ? `แก้ ${result.correctedBytes} ไบต์` : 'RS / CRC ไม่ผ่าน');
  setText('damage-caption', `${changedBytes} ไบต์ · ${changedBits} บิตเปลี่ยน`);
  setText('recovery-caption', result.ok ? 'ผลหลังแก้ RS และผ่าน CRC32' : 'ไม่แสดงโค้ดที่กู้ไม่ได้');
  setText('frame-label', `${originalFrame.length} BYTES`);
  const grid = element('byte-grid');
  const focusedIndex = grid.contains(document.activeElement) ? document.activeElement.dataset.index : null;
  grid.replaceChildren();
  damagedFrame.forEach((value, index) => {
    const changed = value !== originalFrame[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'byte-cell' + (changed ? ' changed' : '');
    button.dataset.index = index;
    button.textContent = value.toString(16).padStart(2, '0').toUpperCase();
    button.setAttribute('aria-pressed', String(changed));
    button.setAttribute('aria-label', `ไบต์ ${index} ค่า ${button.textContent}${changed ? ' เปลี่ยนแล้ว' : ''}`);
    button.addEventListener('click', () => {
      damagedFrame[index] = changed ? originalFrame[index] : value ^ (element('damage-mode').value === 'byte' ? 255 : 1);
      renderExperiment();
    });
    grid.append(button);
  });
  if (focusedIndex !== null) grid.querySelector(`[data-index="${focusedIndex}"]`)?.focus();
}

function generate() {
  try {
    const rings = Number(element('rings').value);
    const mode = element('encoding-mode').value;
    let payload = element('payload').value;
    if (mode === 'binary') {
      const hex = payload.replace(/\s/g, '');
      if (hex.length % 2 || !/^[0-9a-f]*$/i.test(hex)) throw new Error('ไบนารีต้องเป็นเลขฐานสิบหกครบคู่ เช่น 00 FF 41 80');
      payload = Uint8Array.from(hex.match(/../g) || [], pair => parseInt(pair, 16));
    }
    const nextModel = buildEccModel(payload, rings, mode);
    model = nextModel;
    originalFrame = frameFromModel(model);
    damagedFrame = originalFrame.slice();
    element('scan-rings').value = String(rings);
    const available = originalFrame.length - 17;
    const unit = model.mode === 'numeric' ? 'หลัก' : model.mode === 'alphanumeric' ? 'ตัว' : 'ไบต์';
    setText('capacity', `${model.mode} · ${model.payloadLength} / ${modeCapacity(model.mode, available)} ${unit} · แพ็ก ${model.packedBits} / ${available * 8} บิต`);
    renderExperiment();
  } catch (error) {
    model = originalFrame = damagedFrame = null;
    for (const id of ['clean', 'damaged', 'recovered']) draw(element(id), null);
    element('byte-grid').replaceChildren();
    element('decode-status').classList.add('error');
    setText('decode-title', 'สร้างโค้ดไม่ได้');
    setText('decoded-text', error.message);
    setText('capacity', 'ข้อความต้องอยู่ภายในความจุของจำนวนวงที่เลือก');
    setText('frame-label', '—');
    setText('corrected-count', '—');
    setText('damage-caption', '—');
    setText('recovery-caption', '—');
  }
  for (const id of ['apply-damage', 'reset', 'download-png', 'download-svg']) element(id).disabled = !model;
  element('scan-current').disabled = !model || scanBusy;
}

element('settings').addEventListener('submit', event => { event.preventDefault(); generate(); });
element('payload').addEventListener('input', generate);
element('encoding-mode').addEventListener('change', () => {
  const binary = element('encoding-mode').value === 'binary';
  setText('payload-label', binary ? 'ไบต์ฐานสิบหกที่ต้องการเก็บ' : 'ข้อความที่ต้องการเก็บ');
  setText('input-help', binary ? 'ใส่ไบต์ครบคู่ เช่น 00 FF 41 80 · เว้นวรรคได้ · ไม่เติม 0x' : 'Auto เลือก Numeric / Alphanumeric / UTF-8 ให้ทั้งข้อความ โดยคงตัวพิมพ์และเลขศูนย์นำหน้า');
  generate();
});
element('rings').addEventListener('change', generate);
element('style').addEventListener('change', renderExperiment);
element('damage-count').addEventListener('input', () => setText('damage-label', element('damage-count').value));
element('apply-damage').addEventListener('click', () => {
  if (!model) return;
  const positions = Array.from(originalFrame.keys());
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  damagedFrame = originalFrame.slice();
  const count = Number(element('damage-count').value);
  for (const position of positions.slice(0, count)) damagedFrame[position] ^= element('damage-mode').value === 'byte' ? 255 : 1;
  renderExperiment();
});
element('reset').addEventListener('click', () => {
  if (!model) return;
  damagedFrame = originalFrame.slice();
  element('damage-count').value = '0';
  setText('damage-label', '0');
  renderExperiment();
});

function download(blob, filename) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
element('download-png').addEventListener('click', () => {
  if (model) element('damaged').toBlob(blob => {
    if (blob) download(blob, 'circlecode-ecc-damaged.png');
    else {
      element('decode-status').classList.add('error');
      setText('decode-title', 'บันทึก PNG ไม่สำเร็จ');
    }
  }, 'image/png');
});
element('download-svg').addEventListener('click', () => {
  if (!model) return;
  const svg = renderToSVG(modelWithFrame(model, damagedFrame), rendering());
  download(new Blob([svg], { type: 'image/svg+xml' }), 'circlecode-ecc-damaged.svg');
});

function workerFailure() {
  worker?.terminate();
  worker = null;
  if (pendingScan) {
    clearTimeout(pendingScan.timeout);
    pendingScan.reject(new Error('ตัวอ่านภาพเริ่มทำงานไม่ได้ กรุณาเปิดผ่าน HTTP server แล้วลองใหม่'));
    pendingScan = null;
  }
}
function scanInWorker(image, rings) {
  return new Promise((resolve, reject) => {
    if (pendingScan) { reject(new Error('กำลังอ่านภาพอื่นอยู่')); return; }
    if (!worker) {
      worker = new Worker(new URL('./scan-worker.js', import.meta.url), { type: 'module' });
      worker.onerror = worker.onmessageerror = workerFailure;
      worker.onmessage = ({ data }) => {
        if (!pendingScan || pendingScan.id !== data.id) return;
        const current = pendingScan;
        clearTimeout(current.timeout);
        pendingScan = null;
        current.resolve(data);
      };
    }
    const id = ++scanId;
    pendingScan = { id, resolve, reject, timeout: setTimeout(workerFailure, 10000) };
    try { worker.postMessage({ id, image, rings }, [image.data.buffer]); }
    catch (error) { workerFailure(); }
  });
}
function setBusy(value) {
  scanBusy = value;
  for (const id of ['scan-sample', 'upload', 'scan-rings', 'sample']) element(id).disabled = value;
  element('scan-current').disabled = value || !model;
  element('scan-status').setAttribute('aria-busy', String(value));
}
function showScan(result, ms) {
  element('scan-status').classList.toggle('error', !result.ok);
  setText('scan-title', result.ok ? 'อ่านภาพสำเร็จ' : 'ปฏิเสธผลอ่าน');
  setText('scan-text', result.ok ? resultText(result) : result.reason);
  setText('scan-mode', result.ok ? result.mode : '—');
  setText('scan-corrected', result.ok ? `${result.correctedBytes} ไบต์` : '—');
  setText('scan-inverted', result.ok ? result.inverted ? 'ใช่' : 'ไม่' : '—');
  setText('scan-mirrored', result.ok ? result.mirrored ? 'ใช่' : 'ไม่' : '—');
  setText('scan-time', Number.isFinite(ms) ? `${ms.toFixed(1)} ms` : '—');
}
async function scanSource(loadSource) {
  if (scanBusy) return;
  setBusy(true);
  setText('scan-title', 'กำลังอ่านภาพ…');
  setText('scan-text', 'กำลังค้นหาตำแหน่งและตรวจข้อมูล');
  let source;
  try {
    source = await loadSource();
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    const scale = Math.min(1, 800 / Math.max(width, height));
    const preview = element('scan-preview');
    preview.width = Math.round(width * scale);
    preview.height = Math.round(height * scale);
    if (preview.width < 32 || preview.height < 32) throw new Error('ภาพเล็กเกินไป ต้องมีขนาดอย่างน้อย 32 × 32 พิกเซลหลังย่อภาพ');
    const context = preview.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, preview.width, preview.height);
    const image = context.getImageData(0, 0, preview.width, preview.height);
    const { result, ms } = await scanInWorker(image, Number(element('scan-rings').value));
    showScan(result, ms);
  } catch (error) {
    showScan({ ok: false, reason: error.message });
  } finally {
    source?.close?.();
    setBusy(false);
  }
}
element('scan-current').addEventListener('click', () => scanSource(async () => element('damaged')));
element('scan-sample').addEventListener('click', () => scanSource(async () => {
  const image = new Image();
  image.src = new URL(`./outputs/optical/${element('sample').value}`, import.meta.url).href;
  await image.decode();
  element('scan-rings').value = '7';
  return image;
}));
element('upload').addEventListener('change', () => scanSource(async () => {
  const file = element('upload').files?.[0];
  if (!file) throw new Error('ยังไม่ได้เลือกไฟล์ภาพ');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('รองรับเฉพาะ PNG, JPEG และ WebP');
  if (file.size > 10 * 1024 * 1024) throw new Error('ไฟล์ภาพต้องไม่เกิน 10 MB');
  return createImageBitmap(file);
}));
window.addEventListener('pagehide', () => {
  worker?.terminate();
  if (pendingScan) clearTimeout(pendingScan.timeout);
});
generate();
element('boot-error').hidden = true;
