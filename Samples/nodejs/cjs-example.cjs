/**
 * CircleCode Node.js CommonJS Sample App
 * Run: node Samples/nodejs/cjs-example.cjs
 */

const { VERSION, buildModel, renderToSVG } = require('../../index.cjs');

const model = buildModel('Table-24', { rings: 5, density: 0.35 });
const svg = renderToSVG(model, { style: 'circle', center: 'Pay' });

console.log(`CircleCode CommonJS v${VERSION} ready!`);
console.log(`Generated SVG length: ${svg.length} chars (payload="${model.payload}")`);

