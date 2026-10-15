import type { CircleCodeModel, Ring } from '../legacy/index.js';
export type EncodingMode = 'utf8' | 'numeric' | 'alphanumeric' | 'binary';
export interface V2Model extends Omit<CircleCodeModel, 'payload'> {
  payload: string | Uint8Array;
  mode: EncodingMode;
  packedBits: number;
  packedBytes: number;
  payloadLength: number;
  version: '2.1';
}
export type V2Result = { ok: false; reason: string } | {
  ok: true;
  text?: string;
  bytes: Uint8Array;
  mode: EncodingMode;
  format: '2' | '2.1';
  correctedBytes: number;
  codeword: Uint8Array;
  payloadLength: number;
  packedBits: number;
  packedBytes: number;
  rings?: number;
  inverted?: boolean;
  mirrored?: boolean;
};
export declare const PARITY_BYTES: 8;
export declare const MODES: EncodingMode[];
export declare function crc32(bytes: Uint8Array): number;
export declare function modeCapacity(mode: EncodingMode, availableBytes: number): number;
export declare function encodeFrame(payload: string | Uint8Array, frameBytes?: number, mode?: EncodingMode | 'auto'): Uint8Array;
export declare function decodeFrame(frame: Uint8Array): V2Result;
export declare function buildEccModel(payload: string | Uint8Array, rings?: number, mode?: EncodingMode | 'auto'): V2Model;
export declare function frameFromModel(model: CircleCodeModel | V2Model): Uint8Array;
export declare function modelWithFrame<T extends { cap: number; rings: Ring[] }>(model: T, frame: Uint8Array): T;
export declare function scanImageV2(image: { width: number; height: number; data: Uint8Array | Uint8ClampedArray }, rings?: number): V2Result;
