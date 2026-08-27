#!/usr/bin/env node
'use strict';
/**
 * 机械臂「多原料抓取」验证脚本
 * ------------------------------------------------
 * 对齐《异星工厂》：机械臂从传送带向组装机等目标取料时，不只会抓传送带上最靠前的
 * 一个物品，而会结合放货格的接收能力选品。
 *
 * 回归目标（修复前 bug）：
 *   传送带两条 lane 各有一种原料，组装机需要两种。若最靠前的物品目标已满/不需要
 *   （canDropAt=false），旧逻辑 peekSource 只探测最靠前那一个 → 机械臂卡死，另一种
 *   原料永远不被抓取，组装机断料停产。
 *   修复后 pickSourceForDrop 会遍历传送带上所有可取物品，按“近侧优先、靠前优先”
 *   排序，返回第一个目标能收的物品，保证组装机需要的多种原料都能补齐。
 *
 * 运行：node tools/verify-inserter-multi-input.js （退出码 0 = 通过）
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
  buildingMaxHp: () => 100, beltSpeed: () => BELT_SPEED,
  groundItemForBelt: () => null, circuitSignalNear: () => ({}),
  circuitCondOk: () => true, playSfx: () => {}, dirFromVec: () => 0, onScreen: () => true,
  SMELTS: [], RECIPES: {},
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
  const belt = new Belt('transport-belt', 1, 0); belt.dir = 0; add(belt);
  const ins = new Inserter('inserter', 1, -1); ins.dir = 2; add(ins);
  return { belt, ins };
}

// —— 用例 1：最靠前的物品目标已满，改抓另一 lane 上目标能收的原料 ——
{
  const { belt, ins } = setup();
  // 近侧 lane1 铁板(pos0.9 靠前)，远侧 lane0 铜板(pos0.8)
  belt.items.push({ item: 'iron-plate', pos: 0.9, lane: 1, side: -1 });
  belt.items.push({ item: 'copper-plate', pos: 0.8, lane: 0, side: -1 });
  const t = { type: 'assembling-machine-1', recipe: 'x' };
  ins.canDropAt = (tt, item) => item === 'copper-plate'; // 铁板已满不收，只收铜板
  const it = ins.pickSourceForDrop(belt, t);
  ok(it === 'copper-plate',
    '最靠前物品(铁板)目标不收时，改抓另一 lane 上目标能收的铜板');
}

// —— 用例 2：两种原料目标都能收 → 近侧优先 ——
{
  const { belt, ins } = setup();
  belt.items.push({ item: 'iron-plate', pos: 0.9, lane: 1, side: -1 });   // 近侧+靠前
  belt.items.push({ item: 'copper-plate', pos: 0.8, lane: 0, side: -1 }); // 远侧
  const t = { type: 'assembling-machine-1', recipe: 'x' };
  ins.canDropAt = (tt, item) => item === 'iron-plate' || item === 'copper-plate';
  const it = ins.pickSourceForDrop(belt, t);
  ok(it === 'iron-plate', '两种都收时优先近侧 lane 靠前的铁板');
}

// —— 用例 3：过滤臂仍只抓过滤物 ——
{
  const { belt, ins } = setup();
  ins.filterOn = true; ins.filters = ['copper-plate'];
  belt.items.push({ item: 'iron-plate', pos: 0.9, lane: 1, side: -1 });   // 近侧非过滤物
  belt.items.push({ item: 'copper-plate', pos: 0.8, lane: 0, side: -1 }); // 远侧过滤物
  const t = { type: 'assembling-machine-1', recipe: 'x' };
  ins.canDropAt = (tt, item) => true;
  const it = ins.pickSourceForDrop(belt, t);
  ok(it === 'copper-plate', '过滤臂跨越 lane 仍只选过滤物');
}

// —— 用例 4：所有物品目标都不收 → 返回 null（不误取） ——
{
  const { belt, ins } = setup();
  belt.items.push({ item: 'iron-plate', pos: 0.9, lane: 1, side: -1 });
  belt.items.push({ item: 'copper-plate', pos: 0.8, lane: 0, side: -1 });
  const t = { type: 'assembling-machine-1', recipe: 'x' };
  ins.canDropAt = (tt, item) => false;   // 目标什么都不收
  const it = ins.pickSourceForDrop(belt, t);
  ok(it === null, '目标不收任何物品时不取物（返回 null）');
}

// —— 用例 5：update 实际搬运闭环 —— 最靠前铁板目标不收，应抓铜板 ——
{
  const { belt, ins } = setup();
  // 机械臂放在传送带左侧，dir=2（取物格指向右侧 = 传送带 (1,0)）
  ins.x = 0; ins.y = 0; ins.dir = 2;
  G.grid.set(entKey(0, 0), ins);
  belt.items.push({ item: 'iron-plate', pos: 0.9, lane: 1, side: -1 });
  belt.items.push({ item: 'copper-plate', pos: 0.8, lane: 0, side: -1 });
  // 让机械臂空手到达取物位后立即完成一次取物
  ins.canDropAt = (tt, item) => item === 'copper-plate';
  // 直接调用 update 一帧：armAng 初始为 undefined，先转到位再取。
  ins.armAng = ins.pickAng();
  ins.update(0.016);
  ok(ins.holding === 'copper-plate' && ins.holdingCount === 1,
    'update 闭环：跳过已满的铁板，实际抓到铜板（holding=' + ins.holding + '）');
}

console.log('\n----------------------------------------');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
if (fail) { console.log('❌ 存在失败断言'); process.exit(1); }
console.log('✅ 机械臂多原料抓取语义正确');
