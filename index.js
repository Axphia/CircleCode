/**
 * CircleCode — Dependency-free circular barcode codec library for Browser and Node.js.
 * @packageDocumentation
 */

// Encoder & Model
export {
  VERSION,
  DISC_R,
  R_START,
  R_END,
  CENTER_R,
  DASH_OFF,
  DASH_LEN,
  xmur3,
  mulberry32,
  rngFrom,
  radii,
  slotCount,
  buildModel,
  renderToCanvas,
  renderToSVG,
  parsePayloadBits
} from './circle-code.js';

// Scanner & Decoder
export {
  toGrayscale,
  sample,
  sampleRadialMin,
  median3,
  otsuThr,
  kmeans2,
  parseBitsAt,
  parseBits,
  repairLens,
  correctBits,
  finderScore,
  mirrorFinderScore,
  tryConfig,
  tryConfigMirrored,
  findCenterAndScale,
  estimateDisc,
  scanImageData,
  scanCanvas,
  scanImage,
  CircleScanner
} from './circle-scanner.js';
