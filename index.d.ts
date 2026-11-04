/**
 * CircleCode — TypeScript definitions (v1.1.8)
 */

export interface ModelOptions {
  mode?: 'data' | 'art';
  rings?: number;
  density?: number;
}

export interface Slot {
  finder: boolean;
  bit: number;
}

export interface Ring {
  r: number;
  n: number;
  slots: Slot[];
}

export interface CircleCodeModel {
  rings: Ring[];
  cap: number;
  used: number;
  bytes: number;
  checksum: number;
  payload: string;
}

export interface RenderOptions {
  dark?: string;
  light?: string;
  bg?: string;
  style?: 'circle' | 'loncle' | 'discrete';
  loncle?: boolean;
  lonCle?: boolean;
  lineWidth?: number;
  center?: string | HTMLImageElement | { img: HTMLImageElement; dataUrl?: string } | { dataUrl: string } | { text: string };
  centerBg?: string;
  title?: string;
  sub?: string;
  // Backward compatibility aliases
  connectedArcs?: boolean;
  merged?: boolean;
}

export interface ArcRun {
  start: number;
  len: number;
  full?: boolean;
}

export interface ScanOptions {
  aggressive?: boolean;
  mirrored?: boolean;
  perspective?: boolean;
  rings?: number;
  density?: number;
  cx?: number;
  cy?: number;
  scale?: number;
  maxScanDimension?: number;
}

export interface ScanResult {
  ok: boolean;
  text?: string;
  bytes?: number[];
  len?: number;
  chk?: number;
  rings?: number;
  density?: number;
  rot?: number;
  sep?: number;
  fMean?: number;
  fixed?: number;
  mirrored?: boolean;
  cx?: number;
  cy?: number;
  scale?: number;
  aspect?: number;
  tilt?: number;
  reason?: string;
}

export interface FrameTelemetry {
  ms: number;
  fps: number;
  result: ScanResult;
}

export interface WasmScannerEngine {
  scan_frame_wasm(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, aggressive?: boolean): ScanResult;
}

export interface CircleScannerOptions {
  fps?: number;
  facingMode?: 'environment' | 'user';
  aggressive?: boolean;
  perspective?: boolean;
  confirmCount?: number;
  useWorker?: boolean;
  workerUrl?: string;
  wasmEngine?: WasmScannerEngine;
  onScan?: (result: ScanResult) => void;
  onError?: (err: Error) => void;
  onFrame?: (telemetry: FrameTelemetry) => void;
}

export declare const VERSION: string;
export declare const DISC_R: number;
export declare const R_START: number;
export declare const R_END: number;
export declare const CENTER_R: number;
export declare const DASH_OFF: number;
export declare const DASH_LEN: number;

// Deterministic PRNG & Geometry Helpers
export declare function xmur3(str: string): () => number;
export declare function mulberry32(seed: number): () => number;
export declare function rngFrom(str: string): () => number;
export declare function radii(k: number): number[];
export declare function slotCount(r: number, density: number): number;

// Encoder & Renderers
export declare function buildModel(payload: string, opts?: ModelOptions): CircleCodeModel;
export declare function getRuns(bits: number[]): ArcRun[];
export declare function renderToCanvas(model: CircleCodeModel, ctx: CanvasRenderingContext2D, size?: number, opts?: RenderOptions): void;
export declare function renderToSVG(model: CircleCodeModel, opts?: RenderOptions): string;
export declare function parsePayloadBits(bits: number[]): ScanResult;

// Low-level Computer Vision & Thresholding Helpers
export declare function toGrayscale(imageData: { data: Uint8ClampedArray | Uint8Array; width: number; height: number }, mode?: 'luminance' | 'red' | 'green' | 'blue'): Float32Array;
export declare function sample(g: Float32Array, w: number, h: number, cx: number, cy: number, r?: number, ang?: number, aspect?: number, tilt?: number): number;
export declare function sampleRadialMin(g: Float32Array, w: number, h: number, cx: number, cy: number, r: number, ang: number, scale?: number, aspect?: number, tilt?: number): number;
export declare function median3(g: Float32Array, w: number, h: number, cx: number, cy: number, r: number, ang: number, slot: number, scale?: number, aspect?: number, tilt?: number): number;
export declare function otsuThr(vals: ArrayLike<number>): { thr: number; sep: number };
export declare function kmeans2(vals: ArrayLike<number>): { thr: number; sep: number };
export declare function parseBitsAt(bits: number[], len: number): ScanResult & { needFix?: boolean; sum?: number };
export declare function parseBits(bits: number[]): ScanResult;
export declare function repairLens(header16: number[], capBits: number): number[];
export declare function correctBits(bits: number[], conf: number[], len: number, aggressive?: boolean, gate?: { fMean: number; minSep: number }): ScanResult | null;
export declare function finderScore(g: Float32Array, w: number, h: number, cx: number, cy: number, scale: number, k: number, density: number, rot: number, aspect?: number, tilt?: number): number;
export declare function mirrorFinderScore(g: Float32Array, w: number, h: number, cx: number, cy: number, scale: number, k: number, density: number, rot: number): number;
export declare function tryConfig(g: Float32Array, w: number, h: number, cx: number, cy: number, scale: number, k: number, density: number, rot: number, aggressive?: boolean, aspect?: number, tilt?: number): ScanResult;
export declare function tryConfigMirrored(g: Float32Array, w: number, h: number, cx: number, cy: number, scale: number, k: number, density: number, rot: number, aggressive?: boolean): ScanResult;

// High-level Scanner API
export declare function findCenterAndScale(g: Float32Array, w: number, h: number): { cx: number; cy: number; r: number; scale: number; score: number } | null;
export declare function estimateDisc(g: Float32Array, w: number, h: number, cx: number, cy: number): number | null;
export declare function scanImageData(imageData: { data: Uint8ClampedArray | Uint8Array; width: number; height: number }, options?: ScanOptions): ScanResult;
export declare function scanCanvas(canvas: HTMLCanvasElement | CanvasRenderingContext2D, options?: ScanOptions): ScanResult;
export declare function scanImage(source: HTMLImageElement | string, options?: ScanOptions): Promise<ScanResult>;

export declare class CircleScanner {
  options: CircleScannerOptions;
  stream: MediaStream | null;
  video: HTMLVideoElement | null;
  isScanning: boolean;
  torchOn: boolean;
  constructor(options?: CircleScannerOptions);
  start(videoElement: HTMLVideoElement, onScan?: (result: ScanResult) => void, onError?: (err: Error) => void): Promise<boolean>;
  stop(): void;
  hasTorch(): boolean;
  setTorch(on: boolean): Promise<boolean>;
  toggleTorch(): Promise<boolean>;
  setWasmEngine(wasmEngine: WasmScannerEngine): void;
}
