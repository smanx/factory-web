'use strict';

const fs = require('fs');
const path = require('path');

global.window = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1 };
global.document = {
  getElementById: () => null,
  createElement: () => ({ getContext: () => ({}), toDataURL: () => '', style: {}, appendChild: () => {}, addEventListener: () => {} }),
  addEventListener: () => {},
  readyState: 'loading',
  body: { appendChild: () => {} }
};
global.requestAnimationFrame = () => {};
global.localStorage = { getItem: () => null, setItem() {} };
global.toast = () => {};

const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return () => ({ width: 0 });
    if (k === 'getImageData') return () => ({ data: [] });
    return k in t ? t[k] : () => {};
  },
  set: () => true
});
const realCreateElement = global.document.createElement;
global.document.createElement = tag => {
  const el = realCreateElement(tag);
  if (tag === 'canvas') {
    el.width = el.height = 34;
    el.getContext = () => ctxStub;
    el.toDataURL = () => 'data:,';
  }
  return el;
};

// Load source files in the same order as index.html
const srcFiles = [
  'data.js',
  'world.js',
  'core/registry.js',
  'core/entity.js',
  'core/draw.js',
  'devices/belt.js',
  'devices/splitter.js',
  'devices/underground.js',
  'devices/express-belt.js',
  'devices/inserter.js',
  'devices/drill.js',
  'devices/electric-drill.js',
  'devices/pumpjack.js',
  'devices/furnace.js',
  'devices/electric-furnace.js',
  'devices/steel-furnace.js',
  'devices/assembler.js',
  'devices/assembler-mk2.js',
  'devices/assembler-3.js',
  'devices/chest.js',
  'devices/steel-chest.js',
  'devices/lab.js',
  'devices/boiler.js',
  'devices/steam-engine.js',
  'devices/pump.js',
  'devices/pipe.js',
  'devices/pipe-ground.js',
  'devices/pump-device.js',
  'devices/storage-tank.js',
  'devices/creative.js',
  'devices/refinery.js',
  'devices/chemical-plant.js',
  'devices/power-renewable.js',
  'devices/military.js',
  'core/power.js',
  'player.js',
  'ui.js',
  'render.js',
  'stats.js',
  'main.js'
];
let src = srcFiles.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n;\n');
src += '\n;\n' + fs.readFileSync(path.join(__dirname, 'assertions.js'), 'utf8');
(0, eval)(src);

console.log('\n---- assertions done ----');
