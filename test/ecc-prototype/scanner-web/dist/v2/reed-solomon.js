// Experimental shortened Reed-Solomon over GF(256), primitive polynomial 0x11D.
const exp = new Uint8Array(510);
const log = new Uint8Array(256);
let value = 1;
for (let i = 0; i < 255; i++) {
  exp[i] = value;
  log[value] = i;
  value <<= 1;
  if (value & 256) value ^= 0x11d;
}
exp.set(exp.subarray(0, 255), 255);

function multiply(a, b) { return a && b ? exp[log[a] + log[b]] : 0; }
function divide(a, b) {
  if (!b) throw new Error('Division by zero in GF(256)');
  return a ? exp[(log[a] - log[b] + 255) % 255] : 0;
}
function validate(input, parityBytes) {
  if (!(input instanceof Uint8Array)) throw new TypeError('Expected Uint8Array');
  if (!Number.isInteger(parityBytes) || parityBytes < 1 || parityBytes > 254) {
    throw new RangeError('Parity length must be an integer from 1 to 254');
  }
}
function evaluateDescending(coefficients, x) {
  let result = 0;
  for (const coefficient of coefficients) result = multiply(result, x) ^ coefficient;
  return result;
}
function syndromes(codeword, parityBytes) {
  return Uint8Array.from({ length: parityBytes }, (_, i) => evaluateDescending(codeword, exp[i]));
}

export function encode(data, parityBytes = 8) {
  validate(data, parityBytes);
  if (!data.length || data.length + parityBytes > 255) throw new RangeError('RS block must contain 1 to 255 symbols including parity');
  let generator = Uint8Array.of(1);
  for (let root = 0; root < parityBytes; root++) {
    const next = new Uint8Array(generator.length + 1);
    for (let j = 0; j < generator.length; j++) {
      next[j] ^= generator[j];
      next[j + 1] ^= multiply(generator[j], exp[root]);
    }
    generator = next;
  }
  const remainder = new Uint8Array(data.length + parityBytes);
  remainder.set(data);
  for (let i = 0; i < data.length; i++) {
    const coefficient = remainder[i];
    for (let j = 0; j < generator.length; j++) remainder[i + j] ^= multiply(coefficient, generator[j]);
  }
  const codeword = remainder;
  codeword.set(data);
  return codeword;
}

export function decode(input, parityBytes = 8) {
  validate(input, parityBytes);
  if (input.length <= parityBytes || input.length > 255) throw new RangeError('Invalid RS block length');
  const codeword = input.slice();
  const errors = syndromes(codeword, parityBytes);
  if (errors.every(value => value === 0)) return { codeword, correctedBytes: 0 };

  // Berlekamp-Massey finds an error-locator polynomial from the syndrome sequence.
  let locator = new Uint8Array(parityBytes + 1);
  let previous = new Uint8Array(parityBytes + 1);
  locator[0] = previous[0] = 1;
  let degree = 0, shift = 1, lastDiscrepancy = 1;
  for (let n = 0; n < parityBytes; n++) {
    let discrepancy = errors[n];
    for (let i = 1; i <= degree; i++) discrepancy ^= multiply(locator[i], errors[n - i]);
    if (!discrepancy) { shift++; continue; }
    const saved = locator.slice();
    const factor = divide(discrepancy, lastDiscrepancy);
    for (let i = 0; i + shift < locator.length; i++) locator[i + shift] ^= multiply(factor, previous[i]);
    if (2 * degree <= n) {
      degree = n + 1 - degree;
      previous = saved;
      lastDiscrepancy = discrepancy;
      shift = 1;
    } else shift++;
  }
  if (!degree || 2 * degree > parityBytes) throw new Error('RS correction capacity exceeded');

  const positions = [];
  const locations = [];
  for (let position = 0; position < codeword.length; position++) {
    const power = codeword.length - 1 - position;
    const inverse = exp[(255 - power) % 255];
    let result = 0;
    for (let i = degree; i >= 0; i--) result = multiply(result, inverse) ^ locator[i];
    if (!result) { positions.push(position); locations.push(exp[power]); }
  }
  if (positions.length !== degree) throw new Error('RS error locations could not be recovered');

  // Solve a small Vandermonde system for error magnitudes.
  const matrix = Array.from({ length: degree }, (_, row) => {
    const coefficients = Uint8Array.from(locations, location => row ? exp[(log[location] * row) % 255] : 1);
    return [...coefficients, errors[row]];
  });
  for (let column = 0; column < degree; column++) {
    let pivot = column;
    while (pivot < degree && !matrix[pivot][column]) pivot++;
    if (pivot === degree) throw new Error('RS magnitude equations are singular');
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    for (let j = column; j <= degree; j++) matrix[column][j] = divide(matrix[column][j], divisor);
    for (let row = 0; row < degree; row++) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let j = column; j <= degree; j++) matrix[row][j] ^= multiply(factor, matrix[column][j]);
    }
  }
  for (let i = 0; i < degree; i++) codeword[positions[i]] ^= matrix[i][degree];
  if (syndromes(codeword, parityBytes).some(value => value !== 0)) throw new Error('RS syndrome verification failed');
  return { codeword, correctedBytes: degree };
}
