import { Camera } from './camera.js';
import { ScannerClient, confirmFrame } from './scanner-client.js';

const $ = id => document.getElementById(id);
const camera = new Camera();
const scanner = new ScannerClient();
const preview = $('preview');
const context = preview.getContext('2d', { willReadFrequently: true });
let generation = 0, timer = null, facing = 'environment', currentResult = null;
let hasPreview = false, confirmation = { key: '', count: 0 };

function status(message, error = false) {
  if ($('status').textContent !== message) $('status').textContent = message;
  $('status').classList.toggle('error', error);
}
function bytesHex(bytes) { return [...bytes].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' '); }
function resetResult() {
  currentResult = null;
  confirmation = { key: '', count: 0 };
  $('result').value = '';
  $('result-state').textContent = 'รอข้อมูล';
  $('copy').disabled = true;
  $('download').hidden = true;
  $('timing').textContent = 'ผลกล้องต้องตรงกัน 2 เฟรมก่อนยอมรับ';
  for (const id of ['actual-engine', 'mode', 'detected-rings', 'corrected']) $(id).textContent = '—';
  $('result-note').textContent = 'ข้อมูลที่อ่านได้จะแสดงเป็นข้อความ ลิงก์ไม่ถูกเปิดอัตโนมัติ';
}
function halt(message) {
  generation++;
  clearTimeout(timer);
  camera.stop();
  scanner.stop();
  $('video').hidden = true;
  $('guide').hidden = true;
  preview.hidden = !hasPreview;
  $('empty-state').hidden = hasPreview;
  $('start').disabled = false;
  $('stop').disabled = true;
  $('switch').disabled = true;
  $('camera-state').textContent = 'กล้องปิดอยู่';
  $('camera-state').classList.remove('active');
  if (message) status(message);
}
function cameraError(error) {
  const messages = {
    NotAllowedError: 'ไม่ได้รับสิทธิ์กล้อง เปิดสิทธิ์กล้องของเว็บไซต์ในเบราว์เซอร์แล้วลองใหม่ หรือใช้เลือกภาพ',
    NotFoundError: 'ไม่พบกล้องในอุปกรณ์ ใช้เลือกภาพเพื่อสแกนได้',
    NotReadableError: 'กล้องกำลังถูกใช้งานหรือเปิดไม่ได้ ปิดแอปที่ใช้กล้องแล้วลองใหม่',
    SecurityError: 'กล้องถูกปิดโดยนโยบายเบราว์เซอร์ ลองเปิดเว็บผ่าน HTTPS ในเบราว์เซอร์หลัก',
  };
  return messages[error.name] || error.message || 'เปิดกล้องไม่สำเร็จ';
}
function showResult(reply, live) {
  const { result, engine, ms, fallback } = reply;
  currentResult = result;
  $('result').value = result.mode === 'binary' ? bytesHex(result.bytes) : result.text;
  $('result-state').textContent = `V${result.format}`;
  $('copy').disabled = false;
  $('download').hidden = result.mode !== 'binary';
  $('actual-engine').textContent = engine === 'rust' ? 'Rust / WASM' : 'JavaScript';
  $('mode').textContent = result.mode;
  $('detected-rings').textContent = `${result.rings} วง`;
  $('corrected').textContent = `${result.correctedBytes} ไบต์`;
  $('result-note').textContent = result.mode === 'binary' ? `ไบนารี ${result.bytes.length} ไบต์ · แสดงเป็น hex และบันทึกเป็นไฟล์ต้นฉบับได้` : `UTF-8 ${result.bytes.length} ไบต์ · ไม่เปิดลิงก์หรือเรียกใช้ข้อความอัตโนมัติ`;
  $('timing').textContent = `ถอดรหัส ${ms.toFixed(1)} ms · ${live ? 'ยืนยันตรงกัน 2 เฟรม' : 'อ่านจากภาพหนึ่งครั้ง'}${fallback ? ' · ' + fallback : ''}`;
  status('อ่านข้อมูลสำเร็จ' + (live ? ' · ยืนยันตรงกัน 2 เฟรมและหยุดกล้องแล้ว' : '') + (fallback ? ' · ' + fallback : ''));
}
function capture(source, live) {
  const width = live ? source.videoWidth : source.width;
  const height = live ? source.videoHeight : source.height;
  if (!width || !height) throw new Error('ภาพยังไม่พร้อม');
  if (live) {
    const side = Math.min(width, height);
    preview.width = preview.height = Math.min(640, side);
    context.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, preview.width, preview.height);
  } else {
    const scale = Math.min(1, 960 / Math.max(width, height));
    preview.width = Math.round(width * scale);
    preview.height = Math.round(height * scale);
    if (preview.width < 32 || preview.height < 32) throw new Error('ภาพเล็กเกินไป ต้องไม่น้อยกว่า 32 × 32 พิกเซลหลังย่อ');
    context.clearRect(0, 0, preview.width, preview.height);
    context.drawImage(source, 0, 0, preview.width, preview.height);
  }
  hasPreview = true;
  return context.getImageData(0, 0, preview.width, preview.height);
}
async function readFrame(token) {
  if (token !== generation || !camera.stream) return;
  if (!$('video').videoWidth) { timer = setTimeout(() => readFrame(token), 100); return; }
  const started = performance.now();
  try {
    const reply = await scanner.scan(capture($('video'), true), Number($('rings').value), $('engine').value);
    if (token !== generation) return;
    confirmation = confirmFrame(confirmation, reply.result);
    if (reply.result.ok) {
      if (confirmation.confirmed) { halt(); showResult(reply, true); return; }
      status('พบโค้ดแล้ว กำลังยืนยันอีกเฟรม…');
    } else {
      status('กำลังค้นหา · วางโค้ดให้ครบวง ภาพตรงและนิ่ง' + (reply.fallback ? ' · ' + reply.fallback : ''));
    }
    timer = setTimeout(() => readFrame(token), Math.max(180, 400 - (performance.now() - started)));
  } catch (error) {
    if (token !== generation) return;
    halt();
    status(error.message, true);
  }
}
async function startCamera() {
  halt();
  resetResult();
  const token = generation;
  $('start').disabled = true;
  $('stop').disabled = false;
  status('กำลังขอใช้กล้อง · อนุญาตกล้องในหน้าต่างของเบราว์เซอร์');
  try {
    if (!window.isSecureContext) throw new Error('กล้องต้องเปิดเว็บผ่าน HTTPS ส่วน http://localhost ใช้ทดสอบบนเครื่องเดียวกันได้');
    if (!await camera.start($('video'), facing) || token !== generation) return;
    $('video').hidden = false;
    preview.hidden = true;
    $('empty-state').hidden = true;
    $('guide').hidden = false;
    $('source-label').hidden = false;
    $('source-label').textContent = 'วาง CircleCode ให้อยู่ครบในกรอบ';
    $('switch').disabled = false;
    $('camera-state').textContent = 'กำลังใช้กล้อง';
    $('camera-state').classList.add('active');
    camera.stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (token === generation) halt('กล้องถูกหยุด กดเปิดกล้องเพื่อเริ่มใหม่'); });
    status('กำลังค้นหา CircleCode…');
    readFrame(token);
  } catch (error) {
    if (token !== generation) return;
    halt();
    status(cameraError(error), true);
  }
}
async function readFile(blob, name = 'ภาพที่เลือก') {
  halt();
  resetResult();
  const token = generation;
  $('start').disabled = true;
  $('stop').disabled = false;
  status('กำลังอ่านภาพ…');
  let bitmap;
  try {
    if (!blob || blob.size > 10 * 1024 * 1024) throw new Error('ไฟล์ภาพต้องไม่เกิน 10 MB');
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (token !== generation) return;
    const png = header[0] === 137 && header[1] === 80 && header[2] === 78 && header[3] === 71;
    const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
    const webp = String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP';
    if (!png && !jpeg && !webp) throw new Error('รองรับเฉพาะไฟล์ PNG, JPEG หรือ WebP ที่ถูกต้อง');
    bitmap = await createImageBitmap(blob);
    if (bitmap.width * bitmap.height > 32 * 1024 * 1024) throw new Error('ภาพใหญ่เกิน 32 ล้านพิกเซล กรุณาย่อภาพก่อน');
    if (token !== generation) return;
    const image = capture(bitmap, false);
    $('video').hidden = true;
    preview.hidden = false;
    $('empty-state').hidden = true;
    $('source-label').hidden = false;
    $('source-label').textContent = name;
    const reply = await scanner.scan(image, Number($('rings').value), $('engine').value);
    if (token !== generation) return;
    if (reply.result.ok) showResult(reply, false);
    else { status('อ่านภาพไม่ได้ · ต้องเป็น CircleCode V2/V2.1 ที่เห็นครบวงและชัด ลองระบุจำนวนวงหรือเลือกภาพใหม่', true); }
  } catch (error) {
    if (token === generation) status(error.message || 'เปิดไฟล์ภาพไม่สำเร็จ', true);
  } finally {
    bitmap?.close();
    if (token === generation) { $('start').disabled = false; $('stop').disabled = true; }
  }
}

for (let rings = 5; rings <= 14; rings++) $('rings').add(new Option(String(rings), String(rings)));
$('start').addEventListener('click', startCamera);
$('stop').addEventListener('click', () => halt('หยุดแล้ว · เปิดกล้องหรือเลือกภาพเพื่อเริ่มใหม่'));
$('switch').addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; startCamera(); });
$('choose-image').addEventListener('click', () => { $('file').value = ''; $('file').click(); });
$('file').addEventListener('change', () => { if ($('file').files[0]) readFile($('file').files[0], $('file').files[0].name); });
$('sample').addEventListener('click', async () => {
  halt();
  resetResult();
  const token = generation;
  status('กำลังโหลดภาพตัวอย่าง…');
  try {
    const response = await fetch(new URL('./samples/circle-damaged.png', import.meta.url));
    if (!response.ok) throw new Error('โหลดภาพตัวอย่างไม่สำเร็จ');
    const blob = await response.blob();
    if (token === generation) await readFile(blob, 'ตัวอย่างข้อมูลเสียหาย 4 ไบต์');
  } catch (error) { if (token === generation) status(error.message, true); }
});
for (const id of ['engine', 'rings']) $(id).addEventListener('change', () => { halt('เปลี่ยนการตั้งค่าแล้ว · เปิดกล้องหรือเลือกภาพเพื่อเริ่มใหม่'); resetResult(); });
$('copy').addEventListener('click', async () => {
  if (!currentResult) return;
  try { await navigator.clipboard.writeText($('result').value); status('คัดลอกข้อมูลแล้ว'); }
  catch { $('result').focus(); $('result').select(); status('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความไว้แล้ว สามารถคัดลอกด้วยเมนูของเบราว์เซอร์'); }
});
$('download').addEventListener('click', () => {
  if (currentResult?.mode !== 'binary') return;
  const href = URL.createObjectURL(new Blob([currentResult.bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = href;
  link.download = 'circlecode-data.bin';
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) halt('พักการสแกนแล้ว · เปิดกล้องเพื่อเริ่มใหม่'); });
window.addEventListener('pagehide', () => halt());
$('boot-error').hidden = true;
