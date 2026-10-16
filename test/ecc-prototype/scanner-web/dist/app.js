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
  $('result-state').textContent = 'Awaiting scan';
  $('copy').disabled = true;
  $('download').hidden = true;
  $('timing').textContent = 'Camera results require 2 consecutive matching frames to confirm.';
  for (const id of ['actual-engine', 'mode', 'detected-rings', 'corrected']) $(id).textContent = '—';
  $('result-note').textContent = 'Decoded data is displayed as plain text. URLs are not automatically navigated.';
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
  $('camera-state').textContent = 'Camera idle';
  $('camera-state').classList.remove('active');
  if (message) status(message);
}
function cameraError(error) {
  const messages = {
    NotAllowedError: 'Camera permission denied. Grant camera permissions in browser settings or choose an image file.',
    NotFoundError: 'No camera found on this device. Choose an image file to scan.',
    NotReadableError: 'Camera is currently in use or cannot be accessed. Close other apps using the camera and retry.',
    SecurityError: 'Camera access blocked by browser policy. Open via HTTPS in a standard browser.',
  };
  return messages[error.name] || error.message || 'Failed to start camera';
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
  $('detected-rings').textContent = `${result.rings} rings`;
  $('corrected').textContent = `${result.correctedBytes} byte(s)`;
  $('result-note').textContent = result.mode === 'binary' ? `Binary ${result.bytes.length} byte(s) · Displayed as hex; can be downloaded as raw file` : `UTF-8 ${result.bytes.length} byte(s) · Links and commands are not executed automatically`;
  $('timing').textContent = `Decoded in ${ms.toFixed(1)} ms · ${live ? '2-frame confirmation' : 'Single image scan'}${fallback ? ' · ' + fallback : ''}`;
  status('Payload decoded successfully' + (live ? ' · Confirmed across 2 frames and paused camera' : '') + (fallback ? ' · ' + fallback : ''));
}
function capture(source, live) {
  const width = live ? source.videoWidth : source.width;
  const height = live ? source.videoHeight : source.height;
  if (!width || !height) throw new Error('Image not ready');
  if (live) {
    const side = Math.min(width, height);
    preview.width = preview.height = Math.min(640, side);
    context.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, preview.width, preview.height);
  } else {
    const scale = Math.min(1, 960 / Math.max(width, height));
    preview.width = Math.round(width * scale);
    preview.height = Math.round(height * scale);
    if (preview.width < 32 || preview.height < 32) throw new Error('Image too small; must be at least 32 × 32 pixels after scaling.');
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
      status('Code detected. Confirming with next frame…');
    } else {
      status('Searching… Keep the code fully in frame, flat, and still' + (reply.fallback ? ' · ' + reply.fallback : ''));
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
  status('Requesting camera… Allow camera access in the browser prompt');
  try {
    if (!window.isSecureContext) throw new Error('Camera access requires HTTPS or localhost in modern browsers.');
    if (!await camera.start($('video'), facing) || token !== generation) return;
    $('video').hidden = false;
    preview.hidden = true;
    $('empty-state').hidden = true;
    $('guide').hidden = false;
    $('source-label').hidden = false;
    $('source-label').textContent = 'Fit CircleCode inside the guide';
    $('switch').disabled = false;
    $('camera-state').textContent = 'Camera active';
    $('camera-state').classList.add('active');
    camera.stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (token === generation) halt('Camera stream ended. Press Start Camera to restart.'); });
    status('Searching for CircleCode…');
    readFrame(token);
  } catch (error) {
    if (token !== generation) return;
    halt();
    status(cameraError(error), true);
  }
}
async function readFile(blob, name = 'Selected image') {
  halt();
  resetResult();
  const token = generation;
  $('start').disabled = true;
  $('stop').disabled = false;
  status('Processing image…');
  let bitmap;
  try {
    if (!blob || blob.size > 10 * 1024 * 1024) throw new Error('Image file must not exceed 10 MB');
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (token !== generation) return;
    const png = header[0] === 137 && header[1] === 80 && header[2] === 78 && header[3] === 71;
    const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
    const webp = String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP';
    if (!png && !jpeg && !webp) throw new Error('Only valid PNG, JPEG, or WebP files are supported');
    bitmap = await createImageBitmap(blob);
    if (bitmap.width * bitmap.height > 32 * 1024 * 1024) throw new Error('Image exceeds 32 megapixels; please downscale first');
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
    else { status('Cannot decode code · Ensure full CircleCode V2/V2.1 is visible and focused. Try setting rings manually or choose another image.', true); }
  } catch (error) {
    if (token === generation) status(error.message || 'Failed to open image file', true);
  } finally {
    bitmap?.close();
    if (token === generation) { $('start').disabled = false; $('stop').disabled = true; }
  }
}

for (let rings = 5; rings <= 14; rings++) $('rings').add(new Option(String(rings), String(rings)));
$('start').addEventListener('click', startCamera);
$('stop').addEventListener('click', () => halt('Stopped · Start camera or choose an image to scan'));
$('switch').addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; startCamera(); });
$('choose-image').addEventListener('click', () => { $('file').value = ''; $('file').click(); });
$('file').addEventListener('change', () => { if ($('file').files[0]) readFile($('file').files[0], $('file').files[0].name); });
$('sample').addEventListener('click', async () => {
  halt();
  resetResult();
  const token = generation;
  status('Loading sample image…');
  try {
    const response = await fetch(new URL('./samples/circle-damaged.png', import.meta.url));
    if (!response.ok) throw new Error('Failed to load sample image');
    const blob = await response.blob();
    if (token === generation) await readFile(blob, 'Sample 4-byte damaged image');
  } catch (error) { if (token === generation) status(error.message, true); }
});
for (const id of ['engine', 'rings']) $(id).addEventListener('change', () => { halt('Settings updated · Start camera or choose an image to restart'); resetResult(); });
$('copy').addEventListener('click', async () => {
  if (!currentResult) return;
  try { await navigator.clipboard.writeText($('result').value); status('Data copied to clipboard'); }
  catch { $('result').focus(); $('result').select(); status('Automatic clipboard copy failed; text selected for manual copy'); }
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
document.addEventListener('visibilitychange', () => { if (document.hidden) halt('Scanning paused · Start camera to resume'); });
window.addEventListener('pagehide', () => halt());
$('boot-error').hidden = true;
