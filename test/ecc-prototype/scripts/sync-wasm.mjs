import { copyFileSync } from 'node:fs';
for (const name of ['circlecode_core.js', 'circlecode_core.d.ts', 'circlecode_core_bg.wasm', 'circlecode_core_bg.wasm.d.ts']) {
  copyFileSync(new URL(`../native/rust/pkg/${name}`, import.meta.url), new URL(`../wasm/${name}`, import.meta.url));
}
