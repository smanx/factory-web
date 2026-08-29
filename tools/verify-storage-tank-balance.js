#!/usr/bin/env node
'use strict';
/**
 * 储液罐 ↔ 管道 液体流通逻辑验证脚本
 * ------------------------------------------------
 * 目的：实证"罐里 2000+ 液体、相邻管道却是个位数、罐不下放"现象的成因。
 * 逻辑回顾（对应用户疑问）：
 *   1. 罐→管道：storage-tank.js _balanceWith 按「液位比例」平衡——罐液位比例高于管道时，
 *      把管道补到两者比例的均值。罐 2000/25000=8%，管 5/100=5% → 均值 6.5% → 管道只补到 ~6。
 *   2. 管道→罐：pipe.js update 对相邻储液罐是「无条件回赠 1 单位」（只要管里有、罐没满）。
 *   3. 两者恰好相抵 → 管道在个位数徘徊、罐停在 8% 附近不动（用户所见"徘徊"）。
 *   4. 罐只在对角接口格（isPortCell）才与管道交换流体；非接口格紧贴也不通。
 *
 * 运行：node tools/verify-storage-tank-balance.js （退出码 0 = 通过）
 * 零依赖：加载真实 data/data.generated.js / data.js / data-buildings.js / core/entity.js
 *         / devices/pipe.js / devices/storage-tank.js 做端到端模拟。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const TERRAIN = new Map();
const G = { grid: new Map(), ents: [], buckets: new Map(), settings: { language: 'zh' }, techDone: {} };

const sandbox = {
  console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp,
  parseInt, parseFloat, isFinite, isNaN,
  G,
  getTerrain: (tx, ty) => TERRAIN.get(tx + ',' + ty) ?? 0,
  setTerrain: (tx, ty, v) => TERRAIN.set(tx + ',' + ty, v),
  isWater: (tx, ty) => sandbox.getTerrain(tx, ty) === 1,
  isCliff: (tx, ty) => sandbox.getTerrain(tx, ty) === 7,
  isTree: (tx, ty) => sandbox.getTerrain(tx, ty) === 4,
  row: (label, val) => '<div>' + label + '</div>',
  chip: (id, n) => id,
  countStr: (o) => Object.keys(o).map(k => k + '×' + o[k]).join(''),
  ITEMS: { water: { name: '水', color: '#3fa0e8' } },
  buildingMaxHp: () => 100,
  regPowerEnt: () => {}, unregPowerEnt: () => {},
  invalidateBeltInputNear: () => {},
  circuitSignalNear: () => ({}),
  playSfx: () => {}, toast: () => {},
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {}, DEVICE_PLACE: {},
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);

vm.runInContext(
  load('data/data.generated.js') + '\n'
  + load('data/data.js') + '\n'
  + load('data/data-buildings.js') + '\n'
  + load('core/entity.js') + '\n'
  + load('devices/pipe.js') + '\n'
  // 储液罐依赖 CircuitNode（circuit.js）与若干设备类；此处提供最小桩，仅验证罐↔管流通
  + 'const PORT_FLUID = "#c9a84a"; const DEVICE_FLUID_ICONS = {};'
  // 忠实复刻 core/draw.js 的 sideNeighborCell（储液罐 isPortCell 依赖它判定对角接口格）
  + 'function sideNeighborCell(e, side, cell) { const sd = (side + (e.dir | 0)) % 4; let bx, by;'
  + ' if (sd === 3) { bx = e.x; by = e.y - 1; } else if (sd === 1) { bx = e.x; by = e.y + e.h; }'
  + ' else if (sd === 0) { bx = e.x + e.w; by = e.y; } else { bx = e.x - 1; by = e.y; }'
  + ' return (sd === 1 || sd === 3) ? [bx + cell, by] : [bx, by + cell]; }'
  + 'class CircuitNode extends Entity { constructor(type,x,y){ super(type,x,y); this.red=new Set(); this.green=new Set(); this.netRed={}; this.netGreen={}; this.wireChan="both"; } }'
  + 'class Refinery extends Entity {} class ChemicalPlant extends Entity {} class Assembler extends Entity {}'
  + 'class ElectricDrill extends Entity {}'
  + load('devices/storage-tank.js') + '\n'
  + 'globalThis.__Entity=Entity;globalThis.__Pipe=Pipe;globalThis.__StorageTank=StorageTank;'
  + 'globalThis.__Refinery=Refinery;globalThis.__ChemicalPlant=ChemicalPlant;globalThis.__Assembler=Assembler;'
  + 'globalThis.__ElectricDrill=ElectricDrill;'
  + 'globalThis.__PIPE_CAP=PIPE_CAP;globalThis.__STORAGE_TANK_CAP=STORAGE_TANK_CAP;',
  sandbox, { filename: 'storage-tank.js' }
);

const { __Entity: Entity, __Pipe: Pipe, __StorageTank: StorageTank,
        __Refinery: Refinery, __PIPE_CAP: PIPE_CAP, __STORAGE_TANK_CAP: STORAGE_TANK_CAP } = sandbox;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

function fresh() {
  G.grid = new Map(); G.ents = []; G.buckets = new Map();
  TERRAIN.clear();
}
function put(e) {
  G.ents.push(e);
  const k = ((e.x >> 4) + 4096) * 8192 + ((e.y >> 4) + 4096);
  let s = G.buckets.get(k); if (!s) { s = new Set(); G.buckets.set(k, s); }
  s.add(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) G.grid.set(entKey(e.x + dx, e.y + dy), e);
  return e;
}
function entKey(x, y) { return ((x + 32768) << 16) | (y + 32768); }
function pipe(x, y) { return put(new Pipe('pipe', x, y)); }
// 模拟炼油厂：持续吞原油（继承桩 Refinery，管道 update 才会把它当设备直推；1×1 免重叠）
class MockRefinery extends Refinery {
  constructor(type, x, y) { super(type || 'oil-refinery', x, y); this.w = 1; this.h = 1; this.consumed = 0; }
  isFluidInlet() { return true; }
  giveItem(item) { if (item === 'crude-oil') { this.consumed++; return true; } return false; }
}
function tickN(ents, n) { for (let i = 0; i < n; i++) for (const e of ents) e.update(0.05); }

console.log('容量常量：STORAGE_TANK_CAP=' + STORAGE_TANK_CAP + '（官方 25000），PIPE_CAP=' + PIPE_CAP + '（官方 100）');
console.log('储液罐 3×3 的 4 个接口格（isPortCell）为：北·左上(西列)、西·左上(北行)、南·右下(东列)、东·右下(南行)。');

console.log('\n【A. 罐 2000、紧邻接口格单管、无消费】');
fresh();
{
  const tank = put(new StorageTank('storage-tank', 20, 20));
  tank.fluid = { 'crude-oil': 2000 };
  const p = pipe(20, 19);          // 北·左上接口格（side3,cell0）
  ok(tank.isPortCell(p.x, p.y), '管道所在格是罐的接口格（isPortCell=true）');
  const pBad = pipe(24, 20);       // 东侧中行(23,20)外侧：紧贴但不是接口格、且不挨其它管
  ok(!tank.isPortCell(pBad.x, pBad.y), '紧贴但非接口格（24,20 邻 23,20）isPortCell=false → 罐不与其直接交换');
  tickN([tank, p, pBad], 400);
  ok(p.total() > 0, '接口格的管道收到液体（p=' + p.total() + '）');
  ok(pBad.total() === 0, '非接口格的管道始终为 0（不与罐直接交换）');
  ok(tank.total() >= 1980 && tank.total() <= 2000, '无消费时罐趋平后基本不下放（tank=' + tank.total() + '）');
  ok(Math.abs(p.total() / PIPE_CAP - tank.total() / STORAGE_TANK_CAP) < 0.02,
    '管道液位比例与罐趋同（p=' + p.total() + '=' + (p.total() / PIPE_CAP * 100).toFixed(1) +
    '% vs 罐=' + (tank.total() / STORAGE_TANK_CAP * 100).toFixed(2) + '%）');
  console.log('      → 稳态：接口管道 p=' + p.total() + '（' + (p.total() / PIPE_CAP * 100).toFixed(1) + '%），罐=' +
    tank.total() + '（' + (tank.total() / STORAGE_TANK_CAP * 100).toFixed(2) + '%）');
}

console.log('\n【B. 罐 2000 → 接口管 → 炼油厂（持续消耗）】');
fresh();
{
  const tank = put(new StorageTank('storage-tank', 40, 20));
  tank.fluid = { 'crude-oil': 2000 };
  const p = pipe(40, 19);          // 北接口格
  const ref = put(new MockRefinery('oil-refinery', 40, 18));
  tickN([tank, p, ref], 600);
  console.log('      → 600 步(0.05s)后：炼油厂累计消费=' + ref.consumed + '，管=' + p.total() + '，罐=' + tank.total());
  ok(ref.consumed > 0, '罐持续供油给炼油厂（consumed=' + ref.consumed + '）');
  ok(tank.total() < 2000, '有消费时罐确实下放（tank=' + tank.total() + '）');
  ok(p.total() >= 4, '管道保持有液位持续供流（p=' + p.total() + '）');
}

console.log('\n【C. 完整网络比例验证：罐 8% 时整网各管都停在 ~8%】');
fresh();
{
  const tank = put(new StorageTank('storage-tank', 60, 20));
  tank.fluid = { 'crude-oil': 2000 };
  const p1 = pipe(60, 19);   // 接口管
  const p2 = pipe(60, 18);   // 第二根
  const p3 = pipe(60, 17);   // 第三根
  tickN([tank, p1, p2, p3], 400);
  console.log('      → 稳态：p1=' + p1.total() + ' p2=' + p2.total() + ' p3=' + p3.total() +
    '（各管 ' + (p1.total() / PIPE_CAP * 100).toFixed(1) + '% / ' +
    (p2.total() / PIPE_CAP * 100).toFixed(1) + '% / ' + (p3.total() / PIPE_CAP * 100).toFixed(1) + '%），罐=' + tank.total());
  ok(p1.total() > 0 && p2.total() > 0 && p3.total() > 0, '流体能沿管网逐根传导');
  ok(Math.abs(p2.total() - p1.total()) <= 3 && Math.abs(p3.total() - p1.total()) <= 3,
    '管网内各管液位趋平（比例均分）');
}

console.log('\n结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
