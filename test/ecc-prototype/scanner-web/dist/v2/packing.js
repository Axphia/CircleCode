export const MODES = ['utf8', 'numeric', 'alphanumeric', 'binary'];
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function bitLength(mode, length) {
  if (mode === 'numeric') return Math.floor(length / 3) * 10 + [0, 4, 7][length % 3];
  if (mode === 'alphanumeric') return Math.floor(length / 2) * 11 + (length % 2) * 6;
  return length * 8;
}

export function modeCapacity(mode, availableBytes) {
  if (!MODES.includes(mode) || !Number.isInteger(availableBytes) || availableBytes < 0) throw new RangeError('Invalid mode or capacity');
  const bits = availableBytes * 8;
  if (mode === 'numeric') return Math.floor(bits / 10) * 3 + (bits % 10 >= 7 ? 2 : bits % 10 >= 4 ? 1 : 0);
  if (mode === 'alphanumeric') return Math.floor(bits / 11) * 2 + (bits % 11 >= 6 ? 1 : 0);
  return availableBytes;
}

export function packPayload(payload, mode, availableBytes) {
  if (typeof payload !== 'string' && !(payload instanceof Uint8Array)) throw new TypeError('Payload must be text or Uint8Array');
  // shortcut: one mode per frame; add mixed segments only when real payloads justify their headers.
  if (mode === 'auto') mode = payload instanceof Uint8Array ? 'binary' :
    /^[0-9]+$/.test(payload) ? 'numeric' : payload.length && [...payload].every(char => ALPHABET.includes(char)) ? 'alphanumeric' : 'utf8';
  if (!MODES.includes(mode)) throw new RangeError('Unsupported encoding mode');
  if (mode === 'binary' ? !(payload instanceof Uint8Array) : typeof payload !== 'string') throw new TypeError('Binary mode requires Uint8Array; text modes require text');
  if (mode === 'numeric' && !/^[0-9]*$/.test(payload)) throw new Error('Numeric mode accepts only 0–9');
  if (mode === 'alphanumeric' && ![...payload].every(char => ALPHABET.includes(char))) throw new Error('Alphanumeric mode accepts 0–9, A–Z, space and $%*+-./:');
  const source = mode === 'utf8' ? new TextEncoder().encode(payload) : payload;
  if (mode === 'utf8' && new TextDecoder('utf-8', { ignoreBOM: true }).decode(source) !== payload) throw new TypeError('Text contains an unpaired UTF-16 surrogate');
  const length = source.length;
  const bits = bitLength(mode, length);
  if (length > 65535 || bits > availableBytes * 8) throw new RangeError(`Payload needs ${bits} bits; capacity is ${availableBytes * 8} bits in ${mode} mode`);
  const packed = new Uint8Array(Math.ceil(bits / 8));
  let offset = 0;
  const write = (value, width) => {
    for (let shift = width - 1; shift >= 0; shift--, offset++) packed[offset >>> 3] |= ((value >>> shift) & 1) << (7 - (offset & 7));
  };
  if (mode === 'numeric') {
    for (let i = 0; i < length; i += 3) {
      const group = payload.slice(i, i + 3);
      write(Number(group), [0, 4, 7, 10][group.length]);
    }
  } else if (mode === 'alphanumeric') {
    for (let i = 0; i < length; i += 2) {
      const first = ALPHABET.indexOf(payload[i]);
      write(i + 1 < length ? first * 45 + ALPHABET.indexOf(payload[i + 1]) : first, i + 1 < length ? 11 : 6);
    }
  } else packed.set(source);
  return { mode, length, bitLength: bits, packed };
}

export function unpackPayload(mode, length, packed) {
  if (!MODES.includes(mode)) throw new Error('Unsupported encoding mode');
  const bits = bitLength(mode, length);
  if (bits > packed.length * 8) throw new Error('Invalid payload length');
  let offset = 0;
  const read = width => {
    let value = 0;
    for (let i = 0; i < width; i++, offset++) value = value * 2 + ((packed[offset >>> 3] >>> (7 - (offset & 7))) & 1);
    return value;
  };
  let text;
  if (mode === 'numeric') {
    text = '';
    for (let i = 0; i < length; i += 3) {
      const digits = Math.min(3, length - i);
      const value = read([0, 4, 7, 10][digits]);
      if (value >= 10 ** digits) throw new Error('Invalid numeric group');
      text += String(value).padStart(digits, '0');
    }
  } else if (mode === 'alphanumeric') {
    text = '';
    for (let i = 0; i < length; i += 2) {
      const pair = i + 1 < length;
      const value = read(pair ? 11 : 6);
      if (value >= (pair ? 45 * 45 : 45)) throw new Error('Invalid alphanumeric group');
      text += pair ? ALPHABET[Math.floor(value / 45)] + ALPHABET[value % 45] : ALPHABET[value];
    }
  } else if (mode === 'utf8') text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(packed.subarray(0, length));
  for (offset = bits; offset < packed.length * 8; offset++) {
    if ((packed[offset >>> 3] >>> (7 - (offset & 7))) & 1) throw new Error('Invalid nonzero padding');
  }
  const bytes = mode === 'binary' ? packed.slice(0, length) : new TextEncoder().encode(text);
  return { mode, text, bytes, payloadLength: length, packedBits: bits, packedBytes: Math.ceil(bits / 8) };
}
