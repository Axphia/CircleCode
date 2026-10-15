# Circle Code site — js.org edition

Static site (no build step): landing page + generator + scanner.
`generator.html` and `scanner.html` are copies of the tested apps.

## Publish it (4 steps, per https://github.com/js-org/js.org)

**Step 1 — GitHub Pages.** Create a repo (e.g. `circlecode`), upload this
folder's files to its publishing branch (`main` + `/ (root)`), enable
Settings → Pages. Open `https://YOURNAME.github.io/circlecode/` and check
both pages load. Camera scanning needs `https://` — GitHub Pages has it.

**Step 2 — Pick subdomain.** Either your username or repo name, e.g.
`circlecode.js.org`. Edit the `CNAME` file in this folder to that one line.

**Step 3 — CNAME.** Already included: the `CNAME` file in this folder goes
to the repo root (same branch you publish from). Commit + push it.

**Step 4 — Claim it.** Fork https://github.com/js-org/js.org, add your line
to `cnames_active.js`, e.g. `"circlecode": "YOURNAME.github.io/circlecode"`,
open a PR. Goes live ~24h after merge. Watch the PR for naming conflicts.

Notes:
- js.org requires JS-ecosystem content with real substance — this is a JS
  developer tool, no redirects, so it qualifies.
- Never commit secrets; this repo is pure static files.

## Use as a library

### 1. Code Generator (`circle-code.js`)
`circle-code.js` is a dependency-free ES module for generating Apple Pay-style circular codes:

```js
import { buildModel, renderToCanvas, renderToSVG }
  from 'https://circlecode.js.org/circle-code.js'; // or './circle-code.js'

const model = buildModel('user-12345', { rings: 5, density: 0.35 });
renderToCanvas(model, canvas.getContext('2d'), 400, {
  dark: '#000000',
  light: '#d1d1d6',
  center: 'Pay'
});
```

### 2. Code Scanner (`circle-scanner.js`)
`circle-scanner.js` is a standalone, dependency-free decoder for images, canvases, and live camera streams:

```js
import { scanImage, scanCanvas, CircleScanner }
  from 'https://circlecode.js.org/circle-scanner.js'; // or './circle-scanner.js'

// Scan from an Image or Canvas
const result = await scanImage(imgElement);
if (result.ok) {
  console.log('Decoded text:', result.text); // 'user-12345'
}

// Live Camera Scanner
const scanner = new CircleScanner({
  fps: 8,
  onScan: (res) => {
    console.log('Scanned successfully:', res.text);
    scanner.stop();
  }
});
await scanner.start(videoElement);
```
