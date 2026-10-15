/**
 * CircleCode — TypeScript definitions
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
}

export interface ScanResult {
  ok: boolean;
  text?: string;
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

export interface CircleScannerOptions {
  targetSize?: number;
  fps?: number;
  aggressive?: boolean;
  perspective?: boolean;
  confirmCount?: number;
  useWorker?: boolean;
  workerUrl?: string;
  facingMode?: 'environment' | 'user';
  onScan?: (result: ScanResult) => void;
  onError?: (err: Error) => void;
}

export declare const VERSION: string;
export declare const DISC_R: number;
export declare const R_START: number;
export declare const R_END: number;
export declare const CENTER_R: number;
export declare const DASH_OFF: number;
export declare const DASH_LEN: number;

export declare function radii(k: number): number[];
export declare function slotCount(r: number, density: number): number;
export declare function buildModel(payload: string, opts?: ModelOptions): CircleCodeModel;
export declare function getRuns(bits: number[]): ArcRun[];
export declare function renderToCanvas(model: CircleCodeModel, ctx: CanvasRenderingContext2D, size?: number, opts?: RenderOptions): void;
export declare function renderToSVG(model: CircleCodeModel, opts?: RenderOptions): string;
export declare function parsePayloadBits(bits: number[]): { ok: boolean; text?: string; len?: number; chk?: number; reason?: string };

export declare function findCenterAndScale(g: Float32Array, w: number, h: number): { cx: number; cy: number; r: number; scale: number; score: number } | null;
export declare function estimateDisc(g: Float32Array, w: number, h: number, cx: number, cy: number): number | null;
export declare function scanImageData(imageData: { data: Uint8ClampedArray | Uint8Array; width: number; height: number }, options?: ScanOptions): ScanResult;
export declare function scanCanvas(canvas: HTMLCanvasElement, options?: ScanOptions): ScanResult;
export declare function scanImage(imageElement: HTMLImageElement, options?: ScanOptions): ScanResult;

export declare class CircleScanner {
  constructor(videoElement: HTMLVideoElement, options?: CircleScannerOptions);
  start(): Promise<MediaStream>;
  stop(): void;
  setTorch(on: boolean): Promise<boolean>;
  toggleTorch(): Promise<boolean>;
  hasTorch(): boolean;
  setZoom(zoom: number): void;
  getZoom(): number;
  scanNow(): ScanResult;
}
