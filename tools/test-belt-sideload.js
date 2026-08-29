'use strict';
// 侧向搭接：一侧目标车道堵塞、另一侧目标车道空闲时，空闲侧不应被连累卡死。
// 场景（C 向左流）：A(0,-1) 向下汇入 C 上侧（→ C.lane0）、B(0,1) 向上汇入 C 下侧（→ C.lane1）。
// C.lane1 满载堵塞、C.lane0 为空。期望：A 的物品持续流入 C.lane0。
// 用法：node tools/test-belt-sideload.js
const fs = require('fs');
const path = require('path');

const BELT_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'devices', 'belt.js'), 'utf8');

function buildBelt(src) {
  const prelude = `
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const TILE = 32;
const BELT_SPACING = 0.125;
const BELT_SPEED = 1.875;
const FAST_BELT_MULT = 1;
function beltSpeed() { return BELT_SPEED; }
const G = { time: 0, dbg: {} };
class Entity { constructor(t, x, y) { this.type = t; this.x = x; this.y = y; } }
class Splitter { }
class Underground { }
function circuitSignalNear() { return {}; }
function circuitCondOk() { return true; }
function tri() {}
const ENT_CLASSES = {}, DEVICE_RENDER = {}, DEVICE_STATUS = {}, DEVICE_PANEL = {}, DEVICE_DIR_ROTATE = {};
const ITEMS = {};
const __ents = new Map();
function entAt(x, y) { return __ents.get(x + ',' + y) || null; }
`;
  return new Function(prelude + '\n' + src + '\nreturn { Belt, __ents };')();
}

const IT = (lane, pos) => ({ item: 'iron-plate', pos, lane, side: -1 });

function buildWorld(Belt, ents) {
  ents.clear();
  const C = new Belt('transport-belt', 0, 0); C.dir = 2; // 向左
  const A = new Belt('transport-belt', 0, -1); A.dir = 1; // 向下，汇入 C 上侧 lane0
  const B = new Belt('transport-belt', 0, 1); B.dir = 3;  // 向上，汇入 C 下侧 lane1
  ents.set('0,0', C); ents.set('0,-1', A); ents.set('0,1', B);
  C.items = [0, 1, 2, 3, 4, 5, 6].map(i => IT(1, +(0.875 - i * 0.125).toFixed(3))); // lane1 近满载
  A.items = [IT(1, 0.9), IT(1, 0.65), IT(0, 0.9), IT(0, 0.65)];
  B.items = [IT(0, 1), IT(0, 0.875), IT(0, 0.75), IT(1, 1), IT(1, 0.875), IT(1, 0.75)];
  return { C, A, B };
}

function run(src, ticks = 120) {
  const { Belt, __ents } = buildBelt(src);
  const w = buildWorld(Belt, __ents);
  const dt = 1 / 60;
  for (let t = 0; t < ticks; t++) { w.A.update(dt); w.C.update(dt); w.B.update(dt); }
  const count = (items, lane) => items.filter(o => (o.lane === 1 ? 1 : 0) === lane).length;
  return {
    cLane0: count(w.C.items, 0),
    cLane1: count(w.C.items, 1),
    aLeft: w.A.items.length,
    bLeft: w.B.items.length,
  };
}

// 修复前等价行为：去掉规则 2 的「真能进入」门控
const PRE = src => src
  .replace('&& this._sideCanEnter(pri[0], pri[1])', '&& true')
  .replace('&& this._sideCanEnter(other[0], other[1])', '&& true');

let fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
  if (!cond) fail++;
}

const pre = run(PRE(BELT_SRC));
console.log('修复前（无门控）:', JSON.stringify(pre));
check('bug 复现：A 被连累卡死（A 剩余积压、lane0 未流满）', pre.aLeft >= 1 && pre.cLane0 < 4, `C.lane0=${pre.cLane0}, C.lane1=${pre.cLane1}, A 剩余=${pre.aLeft}`);

const post = run(BELT_SRC);
console.log('修复后（当前代码）:', JSON.stringify(post));
check('A 持续流入空闲 lane0（4 件全部流入）', post.cLane0 === 4 && post.aLeft === 0, `C.lane0=${post.cLane0}, C.lane1=${post.cLane1}, A 剩余=${post.aLeft}`);
check('B 侧仍被 lane1 堵塞（未异常放行）', post.cLane1 >= 8 && post.bLeft >= 2, `C.lane1=${post.cLane1}, B 剩余=${post.bLeft}`);

// 回归：两侧都空闲时，1:1 轮流仍应生效（两侧都能进）
function runBothOpen(src) {
  const { Belt, __ents } = buildBelt(src);
  __ents.clear();
  const C = new Belt('transport-belt', 0, 0); C.dir = 2;
  const A = new Belt('transport-belt', 0, -1); A.dir = 1;
  const B = new Belt('transport-belt', 0, 1); B.dir = 3;
  __ents.set('0,0', C); __ents.set('0,-1', A); __ents.set('0,1', B);
  C.items = [];
  A.items = [IT(1, 1), IT(1, 0.875), IT(0, 1), IT(0, 0.875)];
  B.items = [IT(0, 1), IT(0, 0.875), IT(1, 1), IT(1, 0.875)];
  const dt = 1 / 60;
  for (let t = 0; t < 120; t++) { A.update(dt); C.update(dt); B.update(dt); }
  const count = (items, lane) => items.filter(o => (o.lane === 1 ? 1 : 0) === lane).length;
  return { cLane0: count(C.items, 0), cLane1: count(C.items, 1) };
}
const both = runBothOpen(BELT_SRC);
console.log('回归（双侧空闲）:', JSON.stringify(both));
check('双侧空闲时 A、B 都能进入', both.cLane0 >= 1 && both.cLane1 >= 1, JSON.stringify(both));

process.exit(fail ? 1 : 0);
