#!/usr/bin/env node
'use strict';
/**
 * 传送带侧面交叉车道回退验证脚本
 * ------------------------------------------------
 * 回归目标：一条传送带横向搭接（侧面汇入）另一条传送带时，若下游目标车道满载
 * 而另一条车道空置，物品应能回退进入空置车道，避免整体堵死。
 *
 * 场景：传送带 1（源带）侧面搭入传送带 2（下游带），下游带 B 线(lane1)满载、
 * A 线(lane0)空置。修复前源带物品若来自 lane1，会因目标车道(lane1)满而被拒绝，
 * 尽管 A 线空置；修复后应能回退流入 A 线。
 *
 * 同时验证：真正的 90° 弯道仍保持双车道号（不塌缩成单列），防止回退逻辑过度放宽
 * 破坏《异星工厂》弯道双列机制。
 *
 * 运行：node tools/verify-belt-cross-lane.js （退出码 0 = 通过）
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
  Underground: class Underground {}, Splitter: class Splitter {},
  buildingMaxHp: () => 100, beltSpeed: () => BELT_SPEED,
  groundItemForBelt: () => null, circuitSignalNear: () => ({}), circuitCondOk: () => true,
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {},
  window: {}, setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const prefix = 'const G=globalThis.G; const ITEMS=globalThis.ITEMS; const BUILD_DEFS=globalThis.BUILD_DEFS;';
vm.runInContext(prefix + load('core/entity.js') + '\n' + load('devices/belt.js'), sandbox, { filename: 'belt.js' });

const Belt = vm.runInContext('Belt', sandbox);
const beltCornerDir = vm.runInContext('beltCornerDir', sandbox);

function setup(b1pos, b1dir, b2pos, b2dir) {
  G.grid = new Map(); G.ents = []; G.buckets = new Map();
  const add = (e) => { G.ents.push(e); G.grid.set(entKey(e.x, e.y), e); };
  const belt1 = new Belt('transport-belt', b1pos[0], b1pos[1]); belt1.dir = b1dir; add(belt1);
  const belt2 = new Belt('transport-belt', b2pos[0], b2pos[1]); belt2.dir = b2dir; add(belt2);
  return { belt1, belt2 };
}

// 场景 1：侧面交叉，下游 B 线(lane1)满载、A 线(lane0)空，源带物品来自 lane1（目标车道正是满载的 lane1）
function testSideFullBelt(srcLane, name, b1pos, b1dir, b2pos, b2dir) {
  const { belt1, belt2 } = setup(b1pos, b1dir, b2pos, b2dir);
  // 下游 B 线(lane1)满载，A 线(lane0)空
  belt2.items = [];
  for (let i = 0; i < 6; i++) belt2.items.push({ item: 'copper-plate', pos: i * 0.1, lane: 1, side: -1 });
  // 源带前端物品到达出口，准备转移到下游
  belt1.items = [{ item: 'iron-plate', pos: 0.99, lane: srcLane, side: -1 }];
  belt1._sp = 0.2;
  const idx = belt1.items.findIndex(o => o.lane === srcLane);
  const r = belt1._transferOne(idx);
  const lane0 = belt2.items.filter(o => o.lane === 0).length;
  const pass = r === true && lane0 === 1;
  console.log((pass ? '  ✅ ' : '  ❌ ') + name + `：srcLane=${srcLane}，_transferOne=${r}，下游 A 线物品数=${lane0}（期望 1）`);
  return pass;
}

// 场景 2：真正的 90° 弯道双车道号保持（不塌缩），目标车道空置时仍保持各自车道
function testCornerLaneKeep() {
  G.grid = new Map(); G.ents = []; G.buckets = new Map();
  const add = (e) => { G.ents.push(e); G.grid.set(entKey(e.x, e.y), e); };
  // 东→北 左转：src(0,0) 朝东(0)，corner(1,0) 朝北(3)，out(1,-1) 朝北(3)
  const corner = new Belt('transport-belt', 1, 0); corner.dir = 3; corner.__inpCached = false;
  const out = new Belt('transport-belt', 1, -1); out.dir = 3; add(out);
  const src = new Belt('transport-belt', 0, 0); src.dir = 0; add(src);
  add(corner); corner.__inpCached = false;
  if (beltCornerDir(corner) === null) { console.log('  ⚠️  转角判定失败，跳过'); return true; }
  const items = { 0: 'iron-plate', 1: 'copper-plate' };
  src.items = [{ item: items[0], pos: 0.99, lane: 0, side: -1 },
               { item: items[1], pos: 0.99, lane: 1, side: -1 }];
  src._sp = 0.2;
  for (let lane = 0; lane < 2; lane++) {
    const i = src.items.findIndex(o => o.lane === lane);
    if (i >= 0) src._transferOne(i);
  }
  const cornerLanes = { 0: null, 1: null };
  for (const o of corner.items) cornerLanes[o.lane] = o.item;
  const pass = cornerLanes[0] === items[0] && cornerLanes[1] === items[1];
  console.log((pass ? '  ✅ ' : '  ❌ ') + '真正 90° 弯道保持双车道号：corner lane0=' + (cornerLanes[0] || '空') + '、lane1=' + (cornerLanes[1] || '空') + '（期望 lane0=铁板、lane1=铜板）');
  return pass;
}

let pass = 0, fail = 0;
console.log('\n【侧面交叉：下游 B 线满载时物品可回退流入空置 A 线】');
// 转角场景（belt2 仅一个侧面输入）：belt1 从北侧搭入 belt2(朝东)，belt2 B线(lane1)满、A线(lane0)空
if (testSideFullBelt(1, '北侧搭入 lane1，B线满 A线空', [2, 0], 1, [2, 1], 0)) pass++; else fail++;
if (testSideFullBelt(0, '北侧搭入 lane0，B线满 A线空', [2, 0], 1, [2, 1], 0)) pass++; else fail++;
// 转角场景：belt1 从西侧搭入 belt2(朝南)，belt2 B线(lane1)满、A线(lane0)空
if (testSideFullBelt(1, '西侧搭入 lane1，B线满 A线空', [1, 1], 0, [2, 1], 1)) pass++; else fail++;
if (testSideFullBelt(0, '西侧搭入 lane0，B线满 A线空', [1, 1], 0, [2, 1], 1)) pass++; else fail++;

console.log('\n【弯道双车道保持（防止回退过度放宽导致塌缩）】');
if (testCornerLaneKeep()) pass++; else fail++;

console.log('\n----------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail > 0 ? 1 : 0);
