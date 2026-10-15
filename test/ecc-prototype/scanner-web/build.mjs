import { mkdir, cp, copyFile, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const out = new URL('./dist/', import.meta.url);
await mkdir(out, { recursive: true });
await cp(new URL('./src/', import.meta.url), out, { recursive: true });
await cp(new URL('v2/', root), new URL('v2/', out), { recursive: true });
await cp(new URL('wasm/', root), new URL('wasm/', out), { recursive: true });
await cp(new URL('legacy/', root), new URL('legacy/', out), { recursive: true });
await copyFile(new URL('legacy/LICENSE', root), new URL('LICENSE', out));
await mkdir(new URL('samples/', out), { recursive: true });
await copyFile(new URL('outputs/optical/circle-damaged.png', root), new URL('samples/circle-damaged.png', out));
const html = await readFile(new URL('index.html', out), 'utf8');
if (!html.includes('CircleCode Scanner')) throw new Error('Scanner entry point missing');
await writeFile(new URL('_headers', out), `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'
  Permissions-Policy: camera=(self), microphone=(), geolocation=()
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Cache-Control: no-cache
`);
console.log(`Scanner built: ${out.href}`);
