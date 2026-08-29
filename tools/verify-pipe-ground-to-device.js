#!/usr/bin/env node
'use strict';
/**
 * 地下管道「直接对接流体设备」验证脚本
 * ------------------------------------------------
 * 验证：地下管道（pipe-to-ground）管口直接对接炼油厂/化工厂/装配机/电采矿机时，
 * 能把管道里的流体注入设备的流体输入口（对齐普通管道 Pipe.update 的直推逻辑）。
 *   1. 炼油厂（5×5）：管口落在北侧输入口格（背面第 1/3 格）→ 原油注入设备
 *   2. 化工厂（3×3）：管口落在南侧输入口格（底部第 0/2 格）→ 石油气注入设备
 *   3. 装配机（3×3）：管口对接 + acceptsFluid 门控 → 仅当前配方流体注入
 *   4. 电采矿机（3×3）：管口落在非出口三向中间格 → 硫酸注入
 *   5. 负例：管口在设备输出侧（非输入格）→ 不注入
 *   6. 全链路：抽油机侧普通管道 → 配对地下管道 → 炼油厂（模拟真实布局）
 *   7. 火焰炮塔（2×3）：管口落在底部(南)油口格 → 轻油注入
 *   8. 推进器（4×8）：管口落在两端中部汽口格 → 北口收燃料、南口收氧化剂（分口）
 *   9. 聚变反应堆（6×6）：管口全向对接 → 氟酮冷液注入
 *  10. 聚变发电机（3×5）：管口全向对接 → 等离子体注入
 *  11. 守恒：注入后 A+B+设备 流体总量不变
 *
 * 运行：node tools/verify-pipe-ground-to-device.js （退出码 0 = 通过）
 * 零依赖：加载真实 data/data.generated.js / data.js / data-buildings.js / core/entity.js
 *         / devices/pipe.js / devices/pipe-ground.js，并用忠实复刻真实设备输入口
 *         判定的 mock 类（复用 entity.js 的 neighborOnSideCell）做端到端模拟。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// 世界地形：默认全草地
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
  + load('devices/pipe-ground.js') + '\n'
  + 'globalThis.__Entity=Entity;globalThis.__Pipe=Pipe;globalThis.__PipeToGround=PipeToGround;'
  + 'globalThis.__PIPE_CAP=PIPE_CAP;globalThis.__BUILD_DEFS=BUILD_DEFS;',
  sandbox, { filename: 'pipe-ground.js' }
);

// ---- 忠实复刻真实设备的输入口判定（复用 entity.js 的 neighborOnSideCell，几何与真实一致）----
vm.runInContext(`
class Refinery extends Entity {
  constructor(type, x, y) { super(type || 'oil-refinery', x, y); this.inp = {}; this.outp = {}; }
  // 与 refinery.js isFluidInlet 一致：仅背面(北)两个输入格可被管道直接注入
  isFluidInlet(x, y) {
    const inSide = (3 + (this.dir | 0)) % 4;
    for (const cell of [1, 3]) {
      const p = neighborOnSideCell(this, inSide, cell);
      if (p && p.x === x && p.y === y) return true;
    }
    return false;
  }
  giveItem(item) { if (item === 'crude-oil') { this.inp[item] = (this.inp[item] || 0) + 1; return true; } return false; }
}
class ChemicalPlant extends Entity {
  constructor(type, x, y) { super(type || 'chemical-plant', x, y); this.inp = {}; this.outp = {}; }
  // 与 chemical-plant.js isFluidInlet 一致：仅底部(南)两个输入格可被管道直接注入
  isFluidInlet(x, y) {
    const inSide = (1 + (this.dir | 0)) % 4;
    for (const cell of [0, 2]) {
      const p = neighborOnSideCell(this, inSide, cell);
      if (p && p.x === x && p.y === y) return true;
    }
    return false;
  }
  giveItem(item) { if (item === 'petroleum-gas') { this.inp[item] = (this.inp[item] || 0) + 1; return true; } return false; }
}
class Assembler extends Entity {
  constructor(type, x, y) { super(type || 'assembling-machine-1', x, y); this.inp = {}; this.outp = {}; }
  acceptsFluid(k) { return k === 'sulfuric-acid'; }   // 模拟：当前配方只收硫酸
  giveItem(item) { if (this.acceptsFluid(item)) { this.inp[item] = (this.inp[item] || 0) + 1; return true; } return false; }
}
class ElectricDrill extends Entity {
  constructor(type, x, y) { super(type || 'electric-mining-drill', x, y); this.acid = 0; }
  // 与 electric-drill.js isFluidInlet 一致：除输出方向外 3 向正中间格可接入
  isFluidInlet(x, y) {
    for (const s of [(this.dir + 1) % 4, (this.dir + 2) % 4, (this.dir + 3) % 4]) {
      const p = neighborOnSideCell(this, s, 1);
      if (p && p.x === x && p.y === y) return true;
    }
    return false;
  }
  giveItem(item) { if (item === 'sulfuric-acid') { this.acid = (this.acid || 0) + 1; return true; } return false; }
}
class FlamethrowerTurret extends Entity {
  constructor(type, x, y) { super(type || 'flamethrower-turret', x, y); this.fluid = {}; }
  // 与 combat2-turrets.js giveItem 一致：收轻油
  giveItem(item) {
    if (item === 'light-oil') {
      if ((this.fluid['light-oil'] || 0) >= 100) return false;
      this.fluid['light-oil'] = (this.fluid['light-oil'] || 0) + 1;
      return true;
    }
    return false;
  }
}
class Thruster extends Entity {
  constructor(type, x, y) { super(type || 'thruster', x, y); this.fuelBuf = 0; this.oxidBuf = 0; }
  // 与 space-platform.js giveItem 一致：双流体输入
  giveItem(item) {
    if (item === 'thruster-fuel' && this.fuelBuf < 1000) { this.fuelBuf++; return true; }
    if (item === 'thruster-oxidizer' && this.oxidBuf < 1000) { this.oxidBuf++; return true; }
    return false;
  }
}
class FusionReactor extends Entity {
  constructor(type, x, y) { super(type || 'fusion-reactor', x, y); this.coolantBuf = 0; this.fuel = 0; }
  // 与 fusion.js giveItem 一致：氟酮冷液冷却剂（全向接口，无格级判定）
  giveItem(item) {
    if (item === 'fluoroketone-cold' && this.coolantBuf < FUSION_REACTOR_FLUID_USAGE * 2 + 1) { this.coolantBuf++; return true; }
    if (item === 'fusion-power-cell' && this.fuel < 10) { this.fuel++; return true; }
    return false;
  }
}
class FusionGenerator extends Entity {
  constructor(type, x, y) { super(type || 'fusion-generator', x, y); this.heatEnergy = 0; }
  specificHeat() { return FUSION_GENERATOR_SPECIFIC_HEAT; }
  maxEnergy() { return HEAT_MAX_TEMP * this.specificHeat(); }
  temperature() { return this.heatEnergy / this.specificHeat(); }
  // 与 fusion.js giveItem 一致：聚变等离子体 → 热量（全向接口，无格级判定）
  giveItem(item) {
    if (item === 'fusion-plasma' && this.temperature() < HEAT_MAX_TEMP) {
      this.heatEnergy = Math.min(this.maxEnergy(), this.heatEnergy + FUSION_HEAT_PER_PLASMA);
      return true;
    }
    return false;
  }
}
globalThis.__Refinery = Refinery;
globalThis.__ChemicalPlant = ChemicalPlant;
globalThis.__Assembler = Assembler;
globalThis.__ElectricDrill = ElectricDrill;
globalThis.__FlamethrowerTurret = FlamethrowerTurret;
globalThis.__Thruster = Thruster;
globalThis.__FusionReactor = FusionReactor;
globalThis.__FusionGenerator = FusionGenerator;
`, sandbox);

const { __Refinery: Refinery, __ChemicalPlant: ChemicalPlant, __Assembler: Assembler,
        __ElectricDrill: ElectricDrill, __FlamethrowerTurret: FlamethrowerTurret,
        __Thruster: Thruster, __FusionReactor: FusionReactor, __FusionGenerator: FusionGenerator,
        __Entity: Entity, __Pipe: Pipe,
        __PipeToGround: PipeToGround, __PIPE_CAP: PIPE_CAP } = sandbox;

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
  ensureBucket(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) G.grid.set(entKey(e.x + dx, e.y + dy), e);
  return e;
}
function entKey(x, y) { return ((x + 32768) << 16) | (y + 32768); }
function ensureBucket(e) {
  const k = ((e.x >> 4) + 4096) * 8192 + ((e.y >> 4) + 4096);
  let s = G.buckets.get(k); if (!s) { s = new Set(); G.buckets.set(k, s); }
  s.add(e);
}
function ug(x, y, dir) { const e = new PipeToGround('pipe-to-ground', x, y); e.dir = dir; return put(e); }
function tickN(ents, n) { for (let i = 0; i < n; i++) for (const e of ents) e.update(0.05); }

console.log('\n【1. 炼油厂（5×5）管口对接北侧输入格 → 原油注入】');
fresh();
{
  const ref = new Refinery('oil-refinery', 20, 20); ref.dir = 0; put(ref);
  const a = ug(21, 19, 3);   // 管口朝南：mouth=(21,20) 落在炼油厂北侧输入格 1 上
  const b = ug(21, 15, 1);   // 背靠背配对端
  ok(a.findMate() === b && b.findMate() === a, '管口落在炼油厂输入格：A↔B 配对成立');
  ok(ref.isFluidInlet(a.x, a.y), 'A 所在格是炼油厂输入格（isFluidInlet=true）');
  for (let i = 0; i < 10; i++) b.giveItem('crude-oil');
  tickN([a, b], 300);
  ok((ref.inp['crude-oil'] || 0) > 0, '炼油厂收到原油（inp.crude-oil=' + (ref.inp['crude-oil'] || 0) + '）');
  const tot = (ref.inp['crude-oil'] || 0) + a.total() + b.total();
  ok(tot === 10, '原油总量守恒 = 10（实际 ' + tot + '）');
  // 第二个输入格（右侧）同样可对接
  fresh();
  const ref2 = new Refinery('oil-refinery', 30, 20); ref2.dir = 0; put(ref2);
  const a2 = ug(33, 19, 3);  // mouth=(33,20) 落在北侧输入格 3 上
  const b2 = ug(33, 15, 1);
  for (let i = 0; i < 6; i++) b2.giveItem('crude-oil');
  tickN([a2, b2], 300);
  ok((ref2.inp['crude-oil'] || 0) > 0, '炼油厂右侧输入格同样可注入（inp=' + (ref2.inp['crude-oil'] || 0) + '）');
}

console.log('\n【2. 化工厂（3×3）管口对接底部输入格 → 石油气注入】');
fresh();
{
  const cp = new ChemicalPlant('chemical-plant', 40, 20); cp.dir = 0; put(cp);
  const a = ug(40, 23, 1);   // 管口朝北：mouth=(40,22) 落在化工厂南侧输入格 0 上
  const b = ug(40, 26, 3);
  ok(a.findMate() === b && b.findMate() === a, '管口落在化工厂输入格：A↔B 配对成立');
  for (let i = 0; i < 10; i++) b.giveItem('petroleum-gas');
  tickN([a, b], 300);
  ok((cp.inp['petroleum-gas'] || 0) > 0, '化工厂收到石油气（inp.petroleum-gas=' + (cp.inp['petroleum-gas'] || 0) + '）');
  const tot = (cp.inp['petroleum-gas'] || 0) + a.total() + b.total();
  ok(tot === 10, '石油气总量守恒 = 10（实际 ' + tot + '）');
}

console.log('\n【3. 装配机（3×3）管口对接 + acceptsFluid 门控】');
fresh();
{
  const asm = new Assembler('assembling-machine-1', 60, 20); asm.dir = 0; put(asm);
  const a = ug(60, 19, 3);   // mouth=(60,20) 落在装配机内
  const b = ug(60, 15, 1);
  for (let i = 0; i < 8; i++) b.giveItem('sulfuric-acid');
  tickN([a, b], 300);
  ok((asm.inp['sulfuric-acid'] || 0) > 0, '装配机收到当前配方流体（硫酸 inp=' + (asm.inp['sulfuric-acid'] || 0) + '）');
  // 门控负例：装配机不收非配方流体
  fresh();
  const asm2 = new Assembler('assembling-machine-1', 70, 20); asm2.dir = 0; put(asm2);
  const a2 = ug(70, 19, 3), b2 = ug(70, 15, 1);
  for (let i = 0; i < 8; i++) b2.giveItem('water');
  tickN([a2, b2], 300);
  ok((asm2.inp['water'] || 0) === 0, '装配机不收非配方流体（门控生效，inp=0）');
}

console.log('\n【4. 电采矿机（3×3）管口对接非出口三向 → 硫酸注入】');
fresh();
{
  const drill = new ElectricDrill('electric-mining-drill', 80, 20); drill.dir = 0; put(drill);
  const a = ug(81, 19, 3);   // 北侧中间格（非出口三向之一），mouth=(81,20) 落在采矿机内
  const b = ug(81, 15, 1);
  ok(drill.isFluidInlet(a.x, a.y), 'A 所在格是采矿机输入格（isFluidInlet=true）');
  for (let i = 0; i < 8; i++) b.giveItem('sulfuric-acid');
  tickN([a, b], 300);
  ok((drill.acid || 0) > 0, '电采矿机收到硫酸（acid=' + (drill.acid || 0) + '）');
}

console.log('\n【5. 负例：管口在设备输出侧（非输入格）→ 不注入】');
fresh();
{
  const ref = new Refinery('oil-refinery', 100, 20); ref.dir = 0; put(ref);
  const a = ug(101, 25, 1);  // 管口朝北：mouth=(101,24) 落在炼油厂南侧（输出侧）
  const b = ug(101, 28, 3);  // 配对端
  ok(!ref.isFluidInlet(a.x, a.y), 'A 所在格（南侧输出边）不是输入格（isFluidInlet=false）');
  for (let i = 0; i < 8; i++) b.giveItem('crude-oil');
  tickN([a, b], 300);
  ok((ref.inp['crude-oil'] || 0) === 0, '输出侧不注入（ref.inp=0）');
  ok(b.total() + a.total() === 8, '流体滞留在管道中，总量守恒 = 8（实际 ' + (b.total() + a.total()) + '）');
}

console.log('\n【6. 全链路：普通管道 → 配对地下管道 → 炼油厂】');
fresh();
{
  const ref = new Refinery('oil-refinery', 120, 20); ref.dir = 0; put(ref);
  const a = ug(121, 19, 3);   // 管口对接炼油厂输入格
  const b = ug(121, 15, 1);   // 配对端
  const ground = put(new Pipe('pipe', 121, 14));   // b 管口（(121,14)）接普通管道
  ok(b._adjacentMouthOpposite() === null && ground instanceof Pipe, 'b 管口邻接普通管道');
  for (let i = 0; i < 10; i++) ground.giveItem('crude-oil');
  // 普通管道不更新：由地下管道 B 的 update 主动从管口侧（ground）均压抽取，A 再注入炼油厂
  tickN([a, b], 400);
  ok((ref.inp['crude-oil'] || 0) > 0, '抽油机侧普通管道 → 地下配对 → 炼油厂全程流动（inp=' + (ref.inp['crude-oil'] || 0) + '）');
  const tot = (ref.inp['crude-oil'] || 0) + a.total() + b.total() + ground.total();
  ok(tot === 10, '全程总量守恒 = 10（实际 ' + tot + '）');
}

console.log('\n【7. 火焰炮塔（2×3）管口对接底部(南)油口 → 轻油注入】');
fresh();
{
  const ft = new FlamethrowerTurret('flamethrower-turret', 100, 20); ft.dir = 0; put(ft);
  const a = ug(100, 23, 1);   // 管口朝北：mouth=(100,22) 落在火焰炮塔底部(左下)格
  const b = ug(100, 26, 3);   // 配对端（南侧）
  ok(a.findMate() === b && b.findMate() === a, '管口落在火焰炮塔南口格：A↔B 配对成立');
  for (let i = 0; i < 8; i++) b.giveItem('light-oil');
  tickN([a, b], 400);
  ok((ft.fluid['light-oil'] || 0) > 0, '火焰炮塔收到轻油（light-oil=' + (ft.fluid['light-oil'] || 0) + '）');
  const tot = (ft.fluid['light-oil'] || 0) + a.total() + b.total();
  ok(tot === 8, '轻油总量守恒 = 8（实际 ' + tot + '）');
}

console.log('\n【8. 推进器（4×8）管口对接两端中部汽口 → 双流体分口注入】');
fresh();
{
  // 南口（氧化剂）：管口格 = rotCell(thr,2,8) = (122,28)，mouth=(122,27) 落在推进器内
  const thr = new Thruster('thruster', 120, 20); thr.dir = 0; put(thr);
  const aS = ug(122, 28, 1);
  const bS = ug(122, 31, 3);
  ok(aS.findMate() === bS && bS.findMate() === aS, '推进器南口：A↔B 配对成立');
  for (let i = 0; i < 8; i++) bS.giveItem('thruster-oxidizer');
  tickN([aS, bS], 400);
  ok(thr.oxidBuf > 0, '推进器南口收氧化剂（oxidBuf=' + thr.oxidBuf + '）');
  ok(thr.fuelBuf === 0, '推进器南口不收燃料（fuelBuf=0，分口生效）');
  const tot = thr.oxidBuf + thr.fuelBuf + aS.total() + bS.total();
  ok(tot === 8, '氧化剂总量守恒 = 8（实际 ' + tot + '）');
  // 北口（燃料）：管口格 = rotCell(thr,2,-1) = (132,19)，mouth=(132,20) 落在推进器内
  fresh();
  const thr2 = new Thruster('thruster', 130, 20); thr2.dir = 0; put(thr2);
  const aN = ug(132, 19, 3);
  const bN = ug(132, 16, 1);
  ok(aN.findMate() === bN && bN.findMate() === aN, '推进器北口：A↔B 配对成立');
  for (let i = 0; i < 8; i++) bN.giveItem('thruster-fuel');
  tickN([aN, bN], 400);
  ok(thr2.fuelBuf > 0, '推进器北口收燃料（fuelBuf=' + thr2.fuelBuf + '）');
  ok(thr2.oxidBuf === 0, '推进器北口不收氧化剂（oxidBuf=0，分口生效）');
}

console.log('\n【9. 聚变反应堆（6×6）管口全向对接 → 氟酮冷液注入】');
fresh();
{
  const reac = new FusionReactor('fusion-reactor', 150, 20); reac.dir = 0; put(reac);
  const a = ug(152, 19, 3);   // mouth=(152,20) 落在反应堆内（四周全向接口，无格级判定）
  const b = ug(152, 15, 1);
  ok(a.findMate() === b && b.findMate() === a, '聚变反应堆管口对接：A↔B 配对成立');
  for (let i = 0; i < 8; i++) b.giveItem('fluoroketone-cold');
  tickN([a, b], 400);
  ok(reac.coolantBuf > 0, '聚变反应堆收到氟酮冷液（coolantBuf=' + reac.coolantBuf + '）');
  const tot = reac.coolantBuf + a.total() + b.total();
  ok(tot === 8, '氟酮冷液总量守恒 = 8（实际 ' + tot + '）');
}

console.log('\n【10. 聚变发电机（3×5）管口全向对接 → 等离子体注入】');
fresh();
{
  const gen = new FusionGenerator('fusion-generator', 170, 20); gen.dir = 0; put(gen);
  const a = ug(171, 19, 3);   // mouth=(171,20) 落在发电机内（四周全向接口）
  const b = ug(171, 15, 1);
  ok(a.findMate() === b && b.findMate() === a, '聚变发电机管口对接：A↔B 配对成立');
  for (let i = 0; i < 8; i++) b.giveItem('fusion-plasma');
  tickN([a, b], 400);
  ok(gen.heatEnergy > 0, '聚变发电机收到等离子体（heatEnergy=' + gen.heatEnergy + '）');
  const tot = gen.heatEnergy / 1 + a.total() + b.total();   // 每单位等离子体折 1 热量
  ok(tot === 8, '等离子体总量守恒 = 8（实际 ' + tot + '）');
}

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
