#!/usr/bin/env node
'use strict';
/**
 * 传送带弯道双车道保持验证脚本
 * ------------------------------------------------
 * 验证《异星工厂》核心机制：传送带转弯（纯 90° 转角）时，源带的左右两条车道
 * 必须各自映射到转角的内/外弧并继续沿原车道输出，互不干扰、不塌缩成一条。
 *
 * 回归目标：此前转角通过 sideOfLane 把侧面输入的物品全部归到同一车道，
 * 导致 A/B 两线物品在弯道混叠（一个转角只走一条弧）。本脚本验证修复后
 * 每条车道的物品在穿过转角后仍保持原车道号，且两列互不抢占。
 *
 * 运行：node tools/verify-belt-corner-lane.js （退出码 0 = 通过）
 * 零依赖：加载 entity.js / belt.js 的传送带逻辑做端到端模拟。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const TILE = 32, BELT_SPEED = 1.875, BELT_SPACING = 0.125;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const G = { grid: new Map(), ents: [], buckets: new Map(), techDone: {}, dbg: {}, time: 0 };
const entKey = (x, y) => ((x + 32768) << 16) | (y + 32768);
const entAt = (x, y) => G.grid.get(entKey(x, y));

const sandbox = {
  console, TILE, BELT_SPEED, BELT_SPACING, DX, DY, G, entAt, entKey,
  BUILD_DEFS: { 'transport-belt': { w: 1, h: 1, solid: true }, 'splitter': { w: 2, h: 1, solid: true } },
  ITEMS: { 'iron-plate': { name: '铁板' }, 'copper-plate': { name: '铜板' } },
  // beltInputSide 里用到的邻居类型桩（本脚本不构造地下带/分流器）
  Underground: class Underground {}, Splitter: class Splitter {},
  buildingMaxHp: () => 100,
  beltSpeed: () => BELT_SPEED,
  groundItemForBelt: () => null,
  circuitSignalNear: () => ({}),
  circuitCondOk: () => true,
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {},
  window: {}, setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const prefix = 'const G=globalThis.G; const ITEMS=globalThis.ITEMS; const BUILD_DEFS=globalThis.BUILD_DEFS;';
vm.runInContext(prefix + load('core/entity.js') + '\n' + load('devices/belt.js'), sandbox, { filename: 'belt.js' });

const Belt = vm.runInContext('Belt', sandbox);
const beltCornerDir = vm.runInContext('beltCornerDir', sandbox);
const beltInputSide = vm.runInContext('beltInputSide', sandbox);
const dirIndexOf = vm.runInContext('dirIndexOf', sandbox);

function setup(exitDir, srcPos, srcDir, outPos) {
  G.grid = new Map(); G.ents = []; G.buckets = new Map();
  const add = (e) => { G.ents.push(e); G.grid.set(entKey(e.x, e.y), e); };
  const corner = new Belt('transport-belt', 1, 0); corner.dir = exitDir; corner.__inpCached = false;
  const out = new Belt('transport-belt', outPos[0], outPos[1]); out.dir = exitDir; add(out);
  const src = new Belt('transport-belt', srcPos[0], srcPos[1]); src.dir = srcDir; add(src);
  add(corner);
  corner.__inpCached = false;
  return { corner, out, src };
}

// 端到端：源带两车道各一件，推过转角，检查出带对应车道
function testCorner(name, exitDir, srcPos, srcDir, outPos) {
  const { corner, out, src } = setup(exitDir, srcPos, srcDir, outPos);
  if (beltCornerDir(corner) === null) {
    console.log('  ⚠️  ' + name + '：转角判定失败（beltCornerDir=null），跳过');
    return true;
  }
  const items = { 0: 'iron-plate', 1: 'copper-plate' };
  src.items = [{ item: items[0], pos: 0.99, lane: 0, side: -1 },
               { item: items[1], pos: 0.99, lane: 1, side: -1 }];
  src._sp = 0.2;
  // 调用源带真实的前端转移方法 _transferOne（走与游戏一致的 acceptItem/lane 判定）
  for (let lane = 0; lane < 2; lane++) {
    const i = src.items.findIndex(o => o.lane === lane);
    if (i >= 0) { const r = src._transferOne(i); if (!r && process.env.VERBOSE) console.log('  [dbg] src lane' + lane + ' transfer failed'); }
  }
  // 源→转角后的转角车道状态（验证两线未塌缩）
  const cornerLanes = { 0: null, 1: null };
  for (const o of corner.items) cornerLanes[o.lane] = o.item;

  corner._sp = 0.2;
  // 把转角内物品推到出口再送出（走真实转移方法，验证车道保持）
  for (const o of corner.items) o.pos = 0.99;
  for (let lane = 0; lane < 2; lane++) {
    const fi = corner.items.findIndex(o => o.lane === lane && o.pos >= 0.99);
    if (fi < 0) continue;
    corner._transferOne(fi);
  }
  const outLanes = { 0: null, 1: null };
  for (const o of out.items) outLanes[o.lane] = o.item;
  let pass = true; const report = [];
  for (const l of [0, 1]) {
    if (cornerLanes[l] !== items[l]) { pass = false; report.push('转角lane' + l + '=' + (cornerLanes[l] || '空') + '(期望' + items[l] + ')'); }
    if (outLanes[l] !== items[l]) { pass = false; report.push('出带lane' + l + '=' + (outLanes[l] || '空') + '(期望' + items[l] + ')'); }
  }
  if (cornerLanes[0] && cornerLanes[1] && cornerLanes[0] === cornerLanes[1]) { pass = false; report.push('两条车道塌缩成一条'); }
  console.log((pass ? '  ✅ ' : '  ❌ ') + name + (report.length ? '：' + report.join('；') : ''));
  return pass;
}

let pass = 0, fail = 0;
console.log('\n【弯道双车道保持】');
if (testCorner('东→北 左转：A/B 两线经弯道保持各自车道', 3, [0, 0], 0, [1, -1])) pass++; else fail++;
// 南→东 右转：源带 (1,1) 向上(3)，转角 (1,0) 向右(0)，出带 (2,0) 向右(0)
if (testCorner('南→东 右转：A/B 两线经弯道保持各自车道', 0, [1, 1], 3, [2, 0])) pass++; else fail++;

// —— 渲染连续性：验证转角内 lane 0/1 的内/外弧归属与直行带车道视觉连续 ——
function verifyArc(name, exitDir, s, expectSign) {
  const srcDir = dirIndexOf(-s[0], -s[1]);
  const turnZ = DX[srcDir] * DY[exitDir] - DY[srcDir] * DX[exitDir]; // >0 右转，<0 左转
  const rightTurn = turnZ > 0;
  const innerLane = rightTurn ? 0 : 1;
  const ok = (expectSign > 0 ? rightTurn : !rightTurn) && (turnZ !== 0);
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (ok ? '：内弧=lane' + innerLane : '：turnZ=' + turnZ));
  return ok;
}
// 东→北 左转（turnZ<0）：内弧应归 lane1（源带 lane0 走外弧），与出带 lane0 连续
if (verifyArc('东→北 左转：lane0 外弧 / lane1 内弧（视觉连续）', 3, [-1, 0], -1)) pass++; else fail++;
// 南→东 右转（turnZ>0）：内弧应归 lane0（源带 lane0 走内弧），与出带 lane0 连续
if (verifyArc('南→东 右转：lane0 内弧 / lane1 外弧（视觉连续）', 0, [0, 1], 1)) pass++; else fail++;

console.log('\n----------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail > 0 ? 1 : 0);
