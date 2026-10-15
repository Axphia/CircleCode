/**
 * CircleCode — CommonJS entrypoint for Node.js
 */

const encoder = require('./circle-code.js');
const scanner = require('./circle-scanner.js');

module.exports = {
  ...encoder,
  ...scanner
};
