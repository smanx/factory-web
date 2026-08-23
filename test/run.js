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

const files = ['data.js', 'world.js', 'entities.js', 'player.js', 'ui.js', 'render.js', 'main.js'];
let src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n;\n');
src += '\n;\n' + fs.readFileSync(path.join(__dirname, 'assertions.js'), 'utf8');
(0, eval)(src);
