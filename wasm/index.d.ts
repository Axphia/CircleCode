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

declare const _default: {
  initWasm: typeof initWasm;
  ensureWasm: typeof ensureWasm;
  scanFrameWasm: typeof scanFrameWasm;
};
export default _default;
