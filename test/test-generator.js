import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const elements = new Map();
const labels = [];
const drawing = new Proxy({}, {
  get(target, key) {
    if (key === 'fillText') return text => labels.push(text);
    return target[key] ?? (() => {});
  }
});
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: '', textContent: '', style: {}, listeners: {}, width: 400, height: 400,
    addEventListener(type, handler) { this.listeners[type] = handler; },
    removeAttribute(name) { delete this[name]; },
    getContext: () => drawing,
    toDataURL: () => 'data:image/png;base64,AA=='
  });
  return elements.get(id);
}
for (const [id, value] of Object.entries({
  mode: 'data', rings: '5', density: '0.35', colorDark: '#000000',
  colorLight: '#8e8e93', centerText: 'MyPay', payload: 'Table-24'
})) element(id).value = value;
const document = {
  getElementById: element,
  querySelector: selector => selector === 'input[name="centerBg"]:checked' ? { value: '#000000' } : element('cv'),
  querySelectorAll: () => []
};
class Image {
  width = 64;
  height = 32;
  async decode() {}
}
const browser = vm.createContext({ document, Image, console, TextEncoder, TextDecoder, URL });
vm.runInContext('window = globalThis', browser);
vm.runInContext(readFileSync(new URL('../dist/circlecode.umd.js', import.meta.url), 'utf8'), browser);
const html = readFileSync(new URL('../web-use-demo/generator.html', import.meta.url), 'utf8');
assert.doesNotMatch(html, /data-mode="(?:apple|appclip)"/);
for (const path of ['../circle-code.js', '../dist/circlecode.umd.js', '../dist/circlecode.min.js']) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /M15\.22 8\.44|appleStyle|appclip|/);
}
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
vm.runInContext(script, browser);
const evaluate = code => vm.runInContext(code, browser);

assert.match(element('status').textContent, /Ready.*LonCle/);
assert.match(element('info').textContent, /5 Rings/);
assert.equal(labels.at(-1), 'Pay');
assert.equal(evaluate('model.payload'), 'Table-24');

for (const style of ['circle', 'loncle']) {
  evaluate(`currentArcStyle = '${style}'; generate()`);
  assert.equal(evaluate('renderOptions(opts()).style'), style);
  assert.match(element('status').textContent, /Ready/);
}
evaluate("currentLogoMode = 'text'");
for (const text of ['apple', 'appclip', 'Code', '<logo>&"']) {
  element('centerText').value = text;
  evaluate('generate()');
  assert.equal(labels.at(-1), text);
  const svg = evaluate('renderToSVG(model, renderOptions(opts()))');
  assert.ok(!svg.includes('transform="translate(177'));
  assert.ok(!svg.includes('[object Object]'));
}
assert.ok(evaluate('renderToSVG(model, renderOptions(opts()))').includes('&lt;logo&gt;&amp;&quot;'));

evaluate("currentLogoMode = 'image'; customLogoImg = new Image(); customLogoDataUrl = 'data:image/png;base64,AA=='; generate()");
assert.ok(evaluate('renderToSVG(model, renderOptions(opts()))').includes('<image href="data:image/png;base64,AA=="'));
assert.match(element('jsOutput').value, /await logo.decode\(\)/);
// Execute the exported snippet against the same local library instead of fetching the CDN.
const generated = element('jsOutput').value.replace(/^import[^\n]+/, 'const { buildModel, renderToCanvas } = window.CircleCode;');
await evaluate(`(async () => { ${generated}\n })()`);

element('payload').value = 'A'.repeat(30);
element('payload').listeners.input();
assert.ok(evaluate('model.rings.length') > 5);
assert.equal(evaluate('model.payload'), 'A'.repeat(30));

element('payload').value = 'A'.repeat(100);
element('payload').listeners.input();
assert.match(element('status').textContent, /Payload too long/);
assert.equal(evaluate('model'), null);
assert.equal(element('jsOutput').value, '');
assert.equal(element('sheetImg').src, undefined);
element('dlPng').onclick();
element('dlSvg').onclick();

element('payload').value = 'กขค';
element('payload').listeners.input();
assert.match(element('status').textContent, /Ready/);
assert.equal(evaluate('model.payload'), 'กขค');
console.log('✓ Generator uses the shared UMD codec for styles, logos, exports, capacity errors, and recovery');
