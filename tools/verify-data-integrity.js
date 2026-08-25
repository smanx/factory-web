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

const DATA_PATH = path.join(__dirname, '..', 'js', 'data.js');
const src = fs.readFileSync(DATA_PATH, 'utf8');

// ---- 在隔离沙箱中加载 data.js，导出所需数据表 ----
const sandbox = { console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp, parseInt, parseFloat };
sandbox.G = { techDone: {}, dbg: null };
sandbox.global = sandbox;
vm.createContext(sandbox);
const probe = src +
  "\n;globalThis.__items=ITEMS;globalThis.__recs=RECIPES;globalThis.__ref=REFINERY_RECIPES;" +
  "globalThis.__cen=CENTRIFUGE_RECIPES;globalThis.__sm=SMELTS;globalThis.__build=BUILD_DEFS;";
vm.runInContext(probe, sandbox, { filename: 'data.js' });

const ITEMS = sandbox.__items;
const RECIPES = sandbox.__recs;
const REFINERY_RECIPES = sandbox.__ref || {};
const CENTRIFUGE_RECIPES = sandbox.__cen || {};
const SMELTS = sandbox.__sm || [];
const BUILD_DEFS = sandbox.__build || {};

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
  'rocket',                       // 火箭发射井拼装完整火箭
  'space-science-pack',           // 火箭发射后产出
  'used-up-uranium-fuel-cell',    // 反应堆燃尽核燃料棒
  'wood', 'raw-wood',             // 砍树获得
  'raw-fish',                     // 捕鱼获得
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
  // 调试/测试专用设备（创造/虚空箱、创造/虚空管道、创造/虚空传送带、被动应急供电）：
  // 仅由 Debug 面板发放，非生存可制造，故允许无配方（对齐官方无此类物品，属本项目测试扩展）
  const testDevices = ['creative-chest','void-chest','creative-pipe','void-pipe','creative-belt','void-belt','passive-power'];
  return !specialBuild.includes(id) && !testDevices.includes(id);
});
check('可建造建筑均有配方（例外=' + buildNoRecipe.length + '）', buildNoRecipe.length === 0,
  buildNoRecipe.length ? JSON.stringify(buildNoRecipe) : '');

console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount === 0 ? 0 : 1);
