#!/usr/bin/env node
'use strict';
/**
 * 数据完整性对齐验证脚本
 * ------------------------------------------------
 * 依据「数据先行 / 资源铁律：零冗余零遗漏」原则，交叉核对 js/data.js 的
 * ITEMS 与 RECIPES 等数据表，确保：
 *   1. 所有配方引用的物品都已在 ITEMS 中定义（无“无源项”）
 *   2. 配方键都能映射到 ITEMS（除离心机 kovarex 等特殊逻辑配方）
 *   3. 所有可通过配方产出的物品都有 ITEMS 描述
 *   4. 无“孤儿物品”/“疑似缺失配方”的中间件（排除由特殊游戏逻辑产出的物品）
 *
 * 运行：node tools/verify-data-integrity.js
 * 退出码：0 = 全部通过；1 = 存在差异（便于接入 CI）。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA_DIR = path.join(__dirname, '..', 'js', 'data');
const src = fs.readFileSync(path.join(DATA_DIR, 'data.generated.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data-items.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data-recipes.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data-buildings.js'), 'utf8');

// ---- 在隔离沙箱中加载 data.js，导出所需数据表 ----
const sandbox = { console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp, parseInt, parseFloat };
sandbox.G = { techDone: {}, dbg: null };
sandbox.global = sandbox;
vm.createContext(sandbox);
const probe = src +
  "\n;globalThis.__items=ITEMS;globalThis.__recs=RECIPES;globalThis.__ref=REFINERY_RECIPES;" +
  "globalThis.__cen=CENTRIFUGE_RECIPES;globalThis.__sm=SMELTS;globalThis.__build=BUILD_DEFS;globalThis.__stack=STACK_SIZES;globalThis.__GD=GAME_DATA;";
vm.runInContext(probe, sandbox, { filename: 'data.js' });

const ITEMS = sandbox.__items;
const RECIPES = sandbox.__recs;
const REFINERY_RECIPES = sandbox.__ref || {};
const CENTRIFUGE_RECIPES = sandbox.__cen || {};
const SMELTS = sandbox.__sm || [];
const BUILD_DEFS = sandbox.__build || {};
const STACK_SIZES = sandbox.__stack || {};
const GAME_DATA = sandbox.__GD || {};

let passCount = 0;
let failCount = 0;
function check(name, ok, detail) {
  if (ok) { passCount++; console.log('  ✅ ' + name); }
  else { failCount++; console.log('  ❌ ' + name + (detail ? '：' + detail : '')); }
}

// ---- 1) 配方引用但未定义的物品（无源项）----
console.log('\n【配方引用 → ITEMS 交叉核对（零无源项）】');
const refs = new Set();
for (const rid in RECIPES) { for (const k in RECIPES[rid].inp) refs.add(k); for (const k in RECIPES[rid].out) refs.add(k); }
for (const rid in REFINERY_RECIPES) { for (const k in REFINERY_RECIPES[rid].inp) refs.add(k); for (const k in REFINERY_RECIPES[rid].out) refs.add(k); }
for (const rid in CENTRIFUGE_RECIPES) { for (const k in CENTRIFUGE_RECIPES[rid].inp) refs.add(k); for (const k in CENTRIFUGE_RECIPES[rid].out) refs.add(k); }
for (const s of SMELTS) { refs.add(s.id); refs.add(s.inp); }
const missingRefs = [...refs].filter(id => !ITEMS[id]);
check('所有配方引用的物品均已定义（缺失=' + missingRefs.length + '）', missingRefs.length === 0,
  missingRefs.length ? JSON.stringify(missingRefs) : '');

// ---- 2) 配方键无 ITEMS 条目（排除动态桶配方与离心机特殊键）----
console.log('\n【配方键 → ITEMS 映射（零遗漏）】');
const dynamicKeys = new Set([
  'kovarex', // 离心机富集配方（产物为铀-235/238，无独立物品）
  'crack-light', 'crack-gas', // 裂化配方（产物为流体，无独立物品键）
  'solid-fuel-light-oil', 'solid-fuel-heavy-oil', // 同种固体燃料的变体配方
  'nutrients-from-yumako-mash', // 生化炉配方：果泥→营养素（官方 nutrients-from-yumako-mash，产物键≠配方键）
  'biosulfur',              // 生化炉配方：变质物+生物结晶→硫磺（产物键≠配方键）
  'metallic-asteroid-crushing', 'carbonic-asteroid-crushing', 'oxide-asteroid-crushing', // 破碎机配方：星块粉碎（产物键≠配方键）
  'ice-melting',            // 破碎机配方：冰→水（产物为流体，无独立物品键）
  // 进阶星块加工（产物键≠配方键，产物为已有基础资源/星块）
  'advanced-metallic-asteroid-crushing', 'advanced-carbonic-asteroid-crushing', 'advanced-oxide-asteroid-crushing',
  'metallic-asteroid-reprocessing', 'carbonic-asteroid-reprocessing', 'oxide-asteroid-reprocessing',
  'yumako-growing', // 农业塔种植配方：种子→玉玛果（产物键≠配方键）
  'jellynut-processing', 'jellynut-growing', 'nutrients-from-biter-egg', // Gleba 果仁链：果仁→果冻/果仁种植/虫蛋→营养素（产物键≠配方键）
  'recycle-scrap', // 废料回收配方：废料→基础资源（产物键≠配方键）
  'advanced-thruster-fuel', 'advanced-thruster-oxidizer', // 太空推进高级配方：产物为推进器燃料/氧化剂流体（产物键≠配方键）
  'iron-bacteria-cultivation', 'copper-bacteria-cultivation', // 细菌培养配方：细菌→细菌（扩增，产物键≠配方键）
  'iron-plate-from-iron-bacteria', 'copper-plate-from-copper-bacteria', // 细菌→板还原配方：产物为铁板/铜板（产物键≠配方键）
  'nutrients-from-spoilage', 'nutrients-from-bioflux', 'burnt-spoilage', // Gleba 营养素/回收配方：变质物→营养素、生物流→营养素、变质物→碳（产物键≠配方键）
  'bioplastic', // 生化炉配方：生物流+果泥→塑料（产物键≠配方键，产物为塑料）
  'fish-breeding', // 养鱼配方：生鱼→生鱼（扩增，产物键≠配方键）
  'nutrients-from-fish', // 鱼制营养素配方：生鱼→营养素（产物键≠配方键）
  'coal-synthesis', // 煤合成配方：碳+硫磺+水→煤（产物键≠配方键）
  'rocket-fuel-from-jelly', // 果冻制火箭燃料配方：水+果冻+生物流→火箭燃料（产物键≠配方键）
  'solid-fuel-from-ammonia', // 氨制固体燃料配方：氨+原油→固体燃料（产物键≠配方键）
  'ammonia-rocket-fuel', // 氨制火箭燃料配方：固燃+水+氨→火箭燃料（产物键≠配方键）
  'biolubricant', // 生化炉配方：果冻→润滑油（产物键≠配方键，产物为润滑油流体）
  'ammoniacal-solution-separation', // 氨溶液分离配方：氨溶液→冰+氨（产物键≠配方键，产物为流体）
  'molten-iron-from-lava', 'molten-copper-from-lava', // 岩浆炼熔融金属配方：岩浆→熔融铁/铜+石头（产物键≠配方键，产物为流体）
  // ===== 太空时代熔融金属铸造链（Vulcanus 铸造厂，产物键≠配方键）=====
  'iron-ore-melting', 'copper-ore-melting', // 熔炼配方：矿→熔融铁/铜流体（产物为流体）
  'casting-iron', 'casting-steel', 'casting-copper', // 浇铸配方：熔融→铁板/钢板/铜板（产物键≠配方键）
  'casting-iron-gear-wheel', 'casting-iron-stick', 'casting-pipe', 'casting-pipe-to-ground', // 浇铸齿轮/铁杆/管道/地下管道（产物键≠配方键）
  'casting-low-density-structure', // 浇铸低密度结构（产物键≠配方键）
  'casting-copper-cable', // 浇铸铜线（产物键≠配方键）
  'concrete-from-molten-iron', // 熔融铁制混凝土（产物键≠配方键）
  'steam-condensation', 'acid-neutralisation', // 蒸汽冷凝→水 / 酸中和→蒸汽（产物为流体）
  'fluoroketone', 'fluoroketone-cooling', // Aquilo 氟酮链：氟+氨+固燃+锂→氟酮热（产物键≠配方键）/ 氟酮热→氟酮冷（产物为流体）
]);
for (const rid in RECIPES) {
  if (rid.startsWith('fill-') || rid.startsWith('empty-')) continue; // 动态桶配方
  if (dynamicKeys.has(rid)) continue;
  if (rid in BUILD_DEFS) continue; // 建筑物品在 BUILD_DEFS 也有定义
  check('配方键「' + rid + '」存在 ITEMS 条目', !!ITEMS[rid]);
}

// ---- 3) 疑似中间件但无产出配方的物品（缺失配方）----
console.log('\n【疑似缺失配方的中间件（零冗余）】');
// 特殊游戏逻辑产出、非合成配方的物品（由建筑/机制产出，合法无组装配方）
const specialOutput = new Set([
  'rocket-part',                  // 火箭发射井逐件组装
  'rocket-body',                  // 火箭发射井拼装完整火箭（非合成物品，由发射井组装）
  'space-science-pack',           // 火箭发射后产出
  'depleted-uranium-fuel-cell',   // 反应堆燃尽核燃料棒
  'wood', 'raw-wood',             // 砍树获得
  'raw-fish',                     // 捕鱼获得
  'artillery-targeting-remote',   // 重炮瞄准遥控器：研究「军事科技 IV」后自动授予（对齐官方 spawnable 遥控器）
  'discharge-defense-remote',     // 放电防御遥控器：研究「装甲电力」后自动授予（对齐官方 spawnable 遥控器）
]);
// 所有可通过配方产出的物品
const craftable = new Set();
for (const rid in RECIPES) for (const k in RECIPES[rid].out) craftable.add(k);
for (const rid in REFINERY_RECIPES) for (const k in REFINERY_RECIPES[rid].out) craftable.add(k);
for (const rid in CENTRIFUGE_RECIPES) for (const k in CENTRIFUGE_RECIPES[rid].out) craftable.add(k);
for (const s of SMELTS) craftable.add(s.id);

const hasRecipe = new Set(Object.keys(RECIPES).concat(Object.keys(REFINERY_RECIPES)).concat(Object.keys(CENTRIFUGE_RECIPES)));
const feature = /(板|线|圈|器|单元|部件|框架|模块|件|料|包|杆|炮|壳|箭|雷|机器人|电池|装甲|护甲)/;
const rawMats = new Set(['iron-ore','copper-ore','coal','stone','uranium-ore','crude-oil','water','steam',
  'heavy-oil','light-oil','petroleum-gas','lubricant','sulfuric-acid']);
const likelyMissing = Object.keys(ITEMS).filter(id => {
  if (hasRecipe.has(id) || craftable.has(id) || specialOutput.has(id) || rawMats.has(id)) return false;
  const nm = ITEMS[id] && ITEMS[id].name || '';
  return feature.test(nm);
});
check('无疑似缺失配方的中间件（潜在缺失=' + likelyMissing.length + '）', likelyMissing.length === 0,
  likelyMissing.length ? JSON.stringify(likelyMissing) : '');

// ---- 4) 可建造建筑均有 ITEMS 描述 ----
console.log('\n【可建造建筑 → ITEMS 描述（零遗漏）】');
const buildNoItem = Object.keys(BUILD_DEFS).filter(id => !ITEMS[id]);
check('所有可建造建筑均有 ITEMS 描述（缺失=' + buildNoItem.length + '）', buildNoItem.length === 0,
  buildNoItem.length ? JSON.stringify(buildNoItem) : '');

// ---- 5) 可建造建筑均有对应实体/生产逻辑（排除纯装饰/特殊）----
console.log('\n【可建造建筑均有配方或特殊逻辑产出】');
const buildNoRecipe = Object.keys(BUILD_DEFS).filter(id => {
  if (id in RECIPES || id in REFINERY_RECIPES || id in CENTRIFUGE_RECIPES) return false;
  // 这些建筑由特殊机制生成（蓝图/放置/初始物品），允许无配方
  const specialBuild = ['rocket-silo'];
  // 调试/测试专用设备（创造/虚空箱、创造/虚空管道、创造/虚空传送带）：
  // 仅由 Debug 面板发放，非生存可制造，故允许无配方（对齐官方无此类物品，属本项目测试扩展）
  const testDevices = ['creative-chest','void-chest','creative-pipe','void-pipe','creative-belt','void-belt'];
  return !specialBuild.includes(id) && !testDevices.includes(id);
});
check('可建造建筑均有配方（例外=' + buildNoRecipe.length + '）', buildNoRecipe.length === 0,
  buildNoRecipe.length ? JSON.stringify(buildNoRecipe) : '');


// ---- 6) 物品 ID 与官方对齐（零非官方物品，仅保留 6 个创造/虚空测试物品 + 显式白名单内部件）----
console.log('\n【物品 ID 对齐官方（factorio-data 原型名，零冗余）】');
const raw = require('./convert-data.js');
const officialNameSet = new Set();
for (const [type, tbl] of Object.entries(raw)) {
  if (typeof tbl !== 'object' || !tbl) continue;
  for (const name of Object.keys(tbl)) officialNameSet.add(name);
}
// 6 个创造/虚空测试物品（Debug 面板发放，非生存物品，官方无对应，允许保留）
const creativeVoid = new Set(['creative-chest','void-chest','creative-pipe','void-pipe','creative-belt','void-belt']);
// 显式白名单：项目内部表示/官方 locale 条目（非官方原型名但属官方概念）
//   rocket-body   —— 火箭发射井内部组装表示（对应官方 rocket-part 组装流程）
//   satellite     —— 官方卫星（locale 有官方条目，2.0 为火箭载荷）
const allowInternal = new Set(['rocket-body', 'satellite']);
const nonOfficial = Object.keys(ITEMS).filter(id =>
  !creativeVoid.has(id) && !officialNameSet.has(id) && !allowInternal.has(id));
check('非创造/虚空物品均使用官方原型名（非官方=' + nonOfficial.length + '）', nonOfficial.length === 0,
  nonOfficial.length ? JSON.stringify(nonOfficial) : '');

// ---- 7) 物品堆叠上限与官方对齐（零偏差）----
console.log('\n【物品堆叠上限对齐官方（factorio-data item stack_size，零偏差）】');
const officialStack = new Map();
const stackLikeTypes = ['item','ammo','gun','capsule','armor','module','tool','repair-tool',
  'rail-planner','deconstruction-item','upgrade-item','selection-tool','item-with-entity-data',
  'spider-vehicle','car','tank','locomotive','cargo-wagon','fluid-wagon','artillery-wagon',
  'spidertron-remote','space-platform-starter-pack'];
for (const t of stackLikeTypes) {
  if (!raw[t]) continue;
  for (const [n, proto] of Object.entries(raw[t]))
    if (typeof proto.stack_size === 'number') officialStack.set(n, proto.stack_size);
}
// 项目堆叠来源：GAME_DATA.stackSize（自动桥接，官方数据优先）+ STACK_SIZES（手工兜底）
const stackIds = new Set([...Object.keys(STACK_SIZES), ...Object.keys(GAME_DATA.stackSize || {})]);
const stackMismatch = [];
for (const id of stackIds) {
  const off = officialStack.get(id);
  if (off === undefined) continue;                       // 官方无此原型（创造/虚空等），跳过
  const projVal = (GAME_DATA.stackSize && id in GAME_DATA.stackSize) ? GAME_DATA.stackSize[id] : STACK_SIZES[id];
  if (projVal !== undefined && projVal !== off) stackMismatch.push(id + ':项目=' + projVal + ' 官方=' + off);
}
check('物品堆叠上限与官方一致（偏差=' + stackMismatch.length + '）', stackMismatch.length === 0,
  stackMismatch.length ? JSON.stringify(stackMismatch) : '');

// 抽油机基础抽取速率单源校验：GAME_DATA.pumpjackBaseRate 须存在且 = 官方 10 原油/秒
// （官方 crude-oil.minable.results=10 ÷ mining_time=1 × pumpjack.mining_speed=1 = 10）
const pumpRate = GAME_DATA && GAME_DATA.pumpjackBaseRate;
check('抽油机基础抽取速率单源化（GAME_DATA.pumpjackBaseRate=' + (pumpRate ?? '缺失') + '，官方=10）',
  pumpRate === 10, pumpRate === 10 ? '' : ('pumpjackBaseRate=' + pumpRate));

console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount === 0 ? 0 : 1);
