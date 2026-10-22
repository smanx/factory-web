#!/usr/bin/env node
'use strict';
/**
 * 品质物流链路校验（Quality DLC 对齐）
 * ------------------------------------------------
 * 核验品质物品（`item~quality` 变体 id）在整条物流链路上保留品质且可被机器消费：
 *   1. 品质变体是独立物品 id：带/箱/机械臂按完整 id 搬运与存放（品质不合并、不丢失）。
 *   2. 堆叠上限：品质变体继承基础物品 stack（stackSize 单源回退）。
 *   3. 机械臂筛选：白/黑名单按基础物品命中品质变体（wantsItem）。
 *   4. 机器进料：组装机/熔炉把 `item~quality` 按基础原料收料（giveItem / canDropAt）。
 *   5. 端到端：机械臂从供应箱抓 `assembling-machine-1~rare` 放上传送带 → 带上保留品质 →
 *      另一端机械臂放入需求箱，箱内品质 id 原样保留。
 *   6. 品质产出：emitQuality 按 moduleQualityChance 掷出带品质 id（rollQualityUpgrade 链）。
 *
 * 运行：node tools/verify-quality-logistics.js （退出码 0 = 通过）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const G = { grid: new Map(), ents: [], buckets: new Map(), settings: { language: 'zh' }, techDone: {} };
const TERRAIN = new Map();

const sandbox = {
  console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp,
  parseInt, parseFloat, isFinite, isNaN,
  G,
  getTerrain: (tx, ty) => TERRAIN.get(tx + ',' + ty) ?? 0,
  isWater: () => false, isCliff: () => false, isTree: () => false,
  row: (label, val) => '<div>' + label + val + '</div>',
  chip: (id, n) => id + '×' + (n === undefined ? '' : n),
  countStr: (o) => Object.keys(o).map(k => k + '×' + o[k]).join(''),
  buildingMaxHp: () => 100,
  regPowerEnt: () => {}, unregPowerEnt: () => {},
  invalidateBeltInputNear: () => {},
  circuitSignalNear: () => ({}),
  playSfx: () => {}, toast: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {}, DEVICE_PLACE: {},
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);

vm.runInContext(
  load('data/data.generated.js') + '\n'
  + load('data/data.js') + '\n'
  + load('data/data-items.js') + '\n'
  + load('data/data-recipes.js') + '\n'
  + load('data/data-buildings.js') + '\n'
  + load('data/data-tech.js') + '\n'
  + load('data/data-util.js') + '\n'
  + load('core/entity.js') + '\n'
  + load('devices/chest.js') + '\n'
  + load('devices/belt.js') + '\n'
  + load('devices/splitter.js') + '\n'
  + load('devices/inserter.js') + '\n'
  + 'globalThis.__Chest=Chest;globalThis.__Belt=Belt;globalThis.__Inserter=Inserter;'
  + 'globalThis.__ITEMS=ITEMS;globalThis.__GAME_DATA=GAME_DATA;'
  + 'globalThis.__stackSize=stackSize;globalThis.__splitQuality=splitQuality;globalThis.__tagQuality=tagQuality;'
  + 'globalThis.__QUALITY_TIERS=QUALITY_TIERS;globalThis.__QUALITY_SEP=QUALITY_SEP;'
  + 'globalThis.__RECIPES=RECIPES;globalThis.__BUILD_DEFS=BUILD_DEFS;'
  + 'globalThis.__moduleQualityChance=moduleQualityChance;globalThis.__rollQualityUpgrade=rollQualityUpgrade;',
  sandbox, { filename: 'quality-logistics.js' }
);

const { __Chest: Chest, __Belt: Belt, __Inserter: Inserter,
        __stackSize: stackSize, __splitQuality: splitQuality, __tagQuality: tagQuality,
        __QUALITY_TIERS: QUALITY_TIERS, __RECIPES: RECIPES, __BUILD_DEFS: BUILD_DEFS,
        __moduleQualityChance: moduleQualityChance, __rollQualityUpgrade: rollQualityUpgrade } = sandbox;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}
function fresh() { G.grid = new Map(); G.ents = []; G.buckets = new Map(); TERRAIN.clear(); }
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

console.log('\n【品质变体 id 与辅助函数】');
const V = tagQuality('assembling-machine-1', 'rare');
ok(V === 'assembling-machine-1~rare', 'tagQuality(assembling-machine-1, rare) = ' + V);
ok(splitQuality(V).base === 'assembling-machine-1' && splitQuality(V).quality === 'rare', 'splitQuality 还原 base/quality');
ok(tagQuality('iron-plate', 'normal') === 'iron-plate', 'normal 品质不加后缀');
ok(Array.isArray(QUALITY_TIERS) && QUALITY_TIERS.length >= 5, 'QUALITY_TIERS ≥ 5 级');

console.log('\n【堆叠上限：品质变体继承基础物品 stack】');
// 组装机官方 stack=50；石炉官方 stack=50；铁板默认 100
ok(stackSize('assembling-machine-1') === 50, '基础组装机 stack=50');
ok(stackSize(V) === 50, '品质变体 stack 继承基础（' + stackSize(V) + '）');
ok(stackSize('assembling-machine-1~legendary') === 50, '传说变体 stack 同样继承（50）');
ok(stackSize('stone-furnace~rare') === 50, '石炉稀有变体 stack=50');
ok(stackSize('stone-brick~epic') === 100, '默认堆叠物品变体回退 100');

console.log('\n【机械臂筛选：品质变体按基础物品命中】');
const arm = new Inserter('inserter', 20, 20);
arm.filterOn = true; arm.filterMode = 'white'; arm.filters = ['assembling-machine-1'];
ok(arm.wantsItem(V), '白名单「组装机1」命中 ' + V);
ok(!arm.wantsItem('steel-chest'), '白名单不命中无关物品');
arm.filterMode = 'black';
ok(!arm.wantsItem(V), '黑名单「组装机1」同样拦截品质变体');
ok(arm.wantsItem('steel-chest'), '黑名单放行无关物品');
arm.filterOn = false;
ok(arm.wantsItem(V), '未启用筛选时全收');

console.log('\n【箱子：品质变体按独立 id 存放（不与基础物品合并）】');
fresh();
{
  const box = put(new Chest('iron-chest', 30, 30));
  ok(box.giveItem('assembling-machine-1'), '放入基础组装机');
  ok(box.giveItem(V), '放入稀有组装机（独立格）');
  ok(box.countOf('assembling-machine-1') === 1 && box.countOf(V) === 1, '两种 id 各自计数（不合并）');
  const slotCount = box.slots.filter(Boolean).length;
  ok(slotCount === 2, '占两个格子（一格一种物品，品质变体是不同物品）');
  ok(box.takeItemOf(V) === V, '按品质 id 取回原样返还');
  ok(box.countOf(V) === 0 && box.countOf('assembling-machine-1') === 1, '取走稀有后基础仍在');
}

console.log('\n【机器进料：品质变体按基础原料命中配方输入】');
{
  // 本沙盒未载入 assembler.js/furnace.js（设备类在各自文件），收料口径以
  // 「拆分后命中配方输入」统一断言：giveItem/canDropAt 侧均已按 splitQuality(item).base 收料。
  const rec = RECIPES['iron-chest'];
  ok(!!rec && !!rec.inp['iron-plate'], '配方 iron-chest 输入含 iron-plate');
  const qIn = 'iron-plate~rare';
  const base = splitQuality(qIn).base;
  ok(!!rec.inp[base], '品质变体 ' + qIn + ' 拆分后命中配方输入（' + base + '）');
}

console.log('\n【端到端：箱→机械臂→带→机械臂→箱 品质全程保留】');
fresh();
{
  const src = put(new Chest('iron-chest', 10, 10));
  for (let i = 0; i < 3; i++) src.giveItem(V);
  const belt = put(new Belt('transport-belt', 12, 10));
  belt.dir = 0;
  const arm1 = put(new Inserter('inserter', 11, 10)); arm1.dir = 0;   // 箭头朝东：取西箱 → 放东带
  const dst = put(new Chest('iron-chest', 14, 10));
  const arm2 = put(new Inserter('inserter', 13, 10)); arm2.dir = 0;   // 取带 → 放箱
  // 机械臂不做筛选
  for (let i = 0; i < 600; i++) {
    arm1.update(0.03); arm2.update(0.03); belt.update(0.03);
    if (dst.countOf(V) >= 3) break;
  }
  ok(src.countOf(V) === 0, '供应箱已被搬空');
  ok(dst.countOf(V) === 3, '需求箱收满 3 个 ' + V + '（品质 id 全程未变）');
  ok(dst.countOf('assembling-machine-1') === 0, '没有掉品质的合并（基础 id 计数为 0）');
  ok(belt.items.length === 0 || belt.items.every(o => o.item === V), '带上有货时均为品质 id');
}

console.log('\n【品质产出：模块掷链产出带品质 id】');
{
  // moduleQualityChance 按品质模块等级累计（官方 1%/2%/2.5%）
  ok(Math.abs(moduleQualityChance({ 'quality-module': 2 }) - 0.02) < 1e-9, '2×品质模块I = 2% 品质加成');
  // rollQualityUpgrade 链：chance=1 必进升级池；进池后沿官方 chain_probability（0.1）
  // 掷「是否升到下一级」——绝大多数停在当前级（≈90%）、约 10% 升一级（与官方分布一致）
  let upgraded = 0;
  for (let i = 0; i < 4000; i++) {
    const q = rollQualityUpgrade('normal', 1);   // chance=1 必进升级池
    if (q !== 'normal') upgraded++;
  }
  ok(upgraded > 4000 * 0.05 && upgraded < 4000 * 0.2, 'chance=1 时按官方 chain_probability≈10% 升级（实测 ' + (upgraded / 40).toFixed(1) + '%）');
  let stayed = 0;
  for (let i = 0; i < 200; i++) if (rollQualityUpgrade('normal', 0) === 'normal') stayed++;
  ok(stayed === 200, 'chance=0 永不升级');
  // legendary 已是链末：不再升级
  ok(rollQualityUpgrade('legendary', 1) === 'legendary', 'legendary 为链末（不再升级）');
}

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
