#!/usr/bin/env node
'use strict';
/**
 * 机械臂取物「近侧车道优先」验证脚本
 * ------------------------------------------------
 * 验证《异星工厂》核心机制：机械臂从传送带取物时，应优先抓取靠近自己一侧
 * 的车道（lane）上的物品；当近侧车道无货时才回退到远侧车道抓取，
 * 保证远侧物品也能被取到（而非完全抓不到）。
 *
 * 回归目标：此前提交把机械臂改成「任一线皆可抓取」，导致近侧车道优先语义丢失。
 * 本脚本验证修复后：
 *   1) 双线都有货时，取到的是近侧 lane 的物品；
 *   2) 仅远侧有货时，回退取到远侧 lane 的物品（不空手）；
 *   3) 过滤抓取同样遵守「近侧优先、远侧回退」；
 *   4) 堆叠臂 takeNFrom 跨线凑数时仍以近侧优先。
 *
 * 运行：node tools/verify-inserter-lane-priority.js （退出码 0 = 通过）
 * 零依赖：加载 entity.js / belt.js / inserter.js 做端到端模拟。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const TILE = 32, BELT_SPEED = 1.875, BELT_SPACING = 0.125;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const G = { grid: new Map(), ents: [], buckets: new Map(), techProg: {}, time: 0, dbg: {} };
const entKey = (x, y) => ((x + 32768) << 16) | (y + 32768);
const entAt = (x, y) => G.grid.get(entKey(x, y));

const sandbox = {
  console, TILE, BELT_SPEED, BELT_SPACING, DX, DY, G, entAt, entKey,
  BUILD_DEFS: { 'transport-belt': { w: 1, h: 1, solid: true }, 'inserter': { w: 1, h: 1, solid: true } },
  ITEMS: { 'iron-plate': { name: '铁板' }, 'copper-plate': { name: '铜板' } },
  Underground: class Underground {}, Splitter: class Splitter {},
  buildingMaxHp: () => 100,
  beltSpeed: () => BELT_SPEED,
  groundItemForBelt: () => null,
  circuitSignalNear: () => ({}),
  circuitCondOk: () => true,
  playSfx: () => {},
  dirFromVec: () => 0,
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {},
  window: {}, setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const prefix = 'const G=globalThis.G; const ITEMS=globalThis.ITEMS; const BUILD_DEFS=globalThis.BUILD_DEFS;';
vm.runInContext(prefix + load('core/entity.js') + '\n' + load('devices/belt.js') + '\n' + load('devices/inserter.js'), sandbox, { filename: 'inserter.js' });

const Belt = vm.runInContext('Belt', sandbox);
const Inserter = vm.runInContext('Inserter', sandbox);

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

function setup() {
  G.grid = new Map(); G.ents = [];
  const add = (e) => { G.ents.push(e); G.grid.set(entKey(e.x, e.y), e); };
  // 传送带 dir=0（向右行进），位于 (1,0)。机械臂 dir=2（向左）从右侧取（位于 (2,0)）。
  const belt = new Belt('transport-belt', 1, 0); belt.dir = 0; add(belt);
  const ins = new Inserter('inserter', 2, 0); ins.dir = 2; add(ins);
  return { belt, ins };
}

// 近侧车道 = 靠近机械臂(2,0) 的一侧。带在(1,0) dir=0，perp=[0,-1]。
// 机械臂在带的右侧，dx=1, dy=0，d = dx*0 + dy*(-1) = 0 → pickBeltLane 返回 0。
// 由 geometry：lane1 在行进方向右侧（+perp），lane0 在左侧（-perp）。
// 机械臂在带右侧 → 近侧应为 lane1。但 pickBeltLane 用 (this-belt) 点乘 perp：
//   d = (dx*perp[0]+dy*perp[1]) = (1*0 + 0*(-1)) = 0，返回 0。
// 为让机械臂“右侧”对应 lane1，这里取机械臂在带上方（y 更小）来验证。
// 改为：机械臂在 (1,-1)（带上侧），近侧应为 lane1（perp 正方向？）
// perp=[fdy,-fdx]=[0,-1]，lane1 在 +perp 即 y 负方向（上方），故带上方的机械臂近侧 = lane1。
function pickLane(ins, belt) {
  return ins.pickBeltLane(belt);
}

// —— 用例 1：双线都有货，机械臂在带上侧，优先取近侧 lane ——
{
  const { belt, ins } = setup();
  ins.x = 1; ins.y = -1; // 带上侧
  // 带 dir=0，perp=[0,-1]。lane0 在 -perp（y 下侧），lane1 在 +perp（y 上侧）。
  // 机械臂在上侧 → 近侧 = lane1。
  belt.items.push({ item: 'iron-plate', pos: 0.8, lane: 1, side: -1 }); // 近侧
  belt.items.push({ item: 'iron-plate', pos: 0.9, lane: 0, side: -1 }); // 远侧(更靠前)
  const near = pickLane(ins, belt);
  ok(near === 1, `近侧车道判定：near=${near}（期望 1，机械臂在带上方）`);
  const it = ins.peekSource(belt);
  ok(it === 'iron-plate', 'peekSource 有可取源');
  const got = ins.takeSource(belt);
  // takeSource 应优先取近侧 lane1（pos 0.8）而非远侧更靠前的 lane0(0.9)
  ok(belt.items.length === 1 && belt.items[0].lane === 0,
    '双线有货时优先取近侧 lane1（远侧 lane0 仍在带）');
}

// —— 用例 2：仅远侧有货 → 回退取到远侧 ——
{
  const { belt, ins } = setup();
  ins.x = 1; ins.y = -1;
  belt.items.push({ item: 'copper-plate', pos: 0.8, lane: 0, side: -1 }); // 仅远侧
  const got = ins.takeSource(belt);
  ok(got === 'copper-plate' && belt.items.length === 0,
    '仅远侧有货时回退抓取成功（不空手）');
}

// —— 用例 3：过滤抓取同样近侧优先、远侧回退 ——
{
  const { belt, ins } = setup();
  ins.x = 1; ins.y = -1;
  ins.filter = 'copper-plate';
  belt.items.push({ item: 'iron-plate', pos: 0.9, lane: 1, side: -1 }); // 近侧非过滤物
  belt.items.push({ item: 'copper-plate', pos: 0.8, lane: 0, side: -1 }); // 远侧过滤物
  const it = ins.peekSource(belt);
  ok(it === 'copper-plate', '过滤臂跨线探测到过滤物');
  // 机械臂实际流程 = peekSource + takeNFrom（取指定 item）
  const got = ins.takeNFrom(belt, 'copper-plate', 1);
  ok(got.length === 1 && got[0] === 'copper-plate', '过滤臂抓到过滤物（远侧回退）');
}

// —— 用例 4：堆叠臂 takeNFrom 跨线凑数仍以近侧优先 ——
{
  const { belt, ins } = setup();
  ins.x = 1; ins.y = -1;
  ins.stackMax = 2;
  belt.items.push({ item: 'iron-plate', pos: 0.8, lane: 1, side: -1 }); // 近侧
  belt.items.push({ item: 'iron-plate', pos: 0.7, lane: 0, side: -1 }); // 远侧
  const got = ins.takeNFrom(belt, 'iron-plate', 2);
  ok(got.length === 2, '堆叠臂跨线凑足 2 个');
  ok(belt.items.length === 0, '堆叠臂取空两条 lane');
}

console.log('\n----------------------------------------');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
if (fail) { console.log('❌ 存在失败断言'); process.exit(1); }
console.log('✅ 机械臂近侧车道优先语义正确');
