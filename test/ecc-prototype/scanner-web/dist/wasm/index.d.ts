export interface WasmScanResult {
  ok: boolean;
  text?: string;
  bytes?: number[];
  len: number;
  chk: number;
  rings: number;
  density: number;
  rot: number;
  sep: number;
  fixed: number;
  reason?: string;
}

export declare function initWasm(module_or_path?: { module_or_path: RequestInfo | URL | Response | BufferSource | WebAssembly.Module } | RequestInfo | URL | Response | BufferSource | WebAssembly.Module): Promise<any>;
export declare function ensureWasm(wasmBinaryOrUrl?: any): Promise<boolean>;
export declare function scanFrameWasm(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, aggressive?: boolean): WasmScanResult;

export interface V2WasmResult {
  ok: boolean;
  text: string | null;
  bytes: number[];
  mode: 'numeric' | 'alphanumeric' | 'utf8' | 'binary' | null;
  format: string | null;
  correctedBytes: number;
  payloadLength: number;
  packedBits: number;
  codeword: number[];
  rings: number;
  inverted: boolean;
  mirrored: boolean;
  reason: string | null;
}
export declare function scanV2Wasm(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, rings?: number): V2WasmResult;
export declare function decodeV2FrameWasm(frame: Uint8Array): V2WasmResult;

declare const _default: {
  initWasm: typeof initWasm;
  ensureWasm: typeof ensureWasm;
  scanFrameWasm: typeof scanFrameWasm;
  scanV2Wasm: typeof scanV2Wasm;
  decodeV2FrameWasm: typeof decodeV2FrameWasm;
};
export default _default;
