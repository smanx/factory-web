'use strict';
/*
 * 游戏数值桥接生成器：用 tools/convert-data.js 现场把 factorio-data 的 Lua 数据
 * 转成 JS 对象（内存中，不落盘），提取游戏运行所需的数值表，生成 js/data.generated.js（GAME_DATA）。
 *
 * 设计原则（对齐项目「混合接入」方案）：
 *   - 唯一数值源 = factorio-data；本脚本产物是构建产物，请勿手改。
 *   - 显示层（中文名/颜色/描述/科技树）与项目特有物品/配方仍由 js/data-*.js 手工维护。
 *   - 配方键 / 物品键 / 建筑键是项目自定的 ID（存档引用），由本脚本内的注册表维护，
 *     数值一律来自官方 data.raw，做到“数值不重复维护”。
 *
 * 用法:
 *   node tools/generate-game-data.js            # 现场转换 factorio-data 并生成 js/data.generated.js
 *   node tools/generate-game-data.js --report   # 报告模式：对比手工表、列出待覆盖项，不写文件
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'js', 'data.generated.js');
const REPORT = process.argv.includes('--report');

// 现场转换 factorio-data → data.raw 的 JS 对象（内存，不生成中间文件）
const raw = require('./convert-data.js');

// ================= 名称映射注册表（项目 → 官方） =================
// 未列出的视为同名（项目 ID 即官方原型名）。
// 物品/实体改名：用于 stackSize / max_health / energy_usage / 配方物品名 的翻译。
const ITEM_MAP = {
  'iron-gear': 'iron-gear-wheel',
  'green-circuit': 'electronic-circuit',
  'science-pack': 'automation-science-pack',
  'green-science': 'logistic-science-pack',
  'military-science': 'military-science-pack',
  'assembling-machine': 'assembling-machine-1',
  'assembling-machine-mk2': 'assembling-machine-2',
  'underground': 'underground-belt',
  'burner-drill': 'burner-mining-drill',
  'electric-drill': 'electric-mining-drill',
  'refinery': 'oil-refinery',
  'lamp': 'small-lamp',
  'long-inserter': 'long-handed-inserter',
  'empty-barrel': 'barrel',
  'explosive': 'explosives',
  'electric-engine': 'electric-engine-unit',
  'magazine': 'firearm-magazine',
  'piercing-rounds': 'piercing-rounds-magazine',
  'uranium-rounds': 'uranium-rounds-magazine',
  'rocket-ammo': 'rocket',
  'logistic-chest-passive': 'passive-provider-chest',
  'logistic-chest-active': 'active-provider-chest',
  'logistic-chest-storage': 'storage-chest',
  'logistic-chest-requester': 'requester-chest',
  'logistic-chest-buffer': 'buffer-chest',
  // 装备（官方 equipment 类型，命名不同）
  'portable-solar-panel': 'solar-panel-equipment',
  'personal-battery': 'battery-equipment',
  'portable-fusion-reactor': 'fusion-reactor-equipment',
  'exoskeleton': 'exoskeleton-equipment',
  'nightvision': 'night-vision-equipment',
  'energy-shield': 'energy-shield-equipment',
  'energy-shield-mk2': 'energy-shield-mk2-equipment',
  'personal-laser-defense': 'personal-laser-defense-equipment',
  'discharge-defense': 'discharge-defense-equipment',
  'personal-roboport': 'personal-roboport-equipment',
  // 2.0 改名 / 官方名不同
  'stack-inserter': 'bulk-inserter',
  'personal-battery-mk2': 'battery-mk2-equipment',
  'personal-roboport-mk2': 'personal-roboport-mk2-equipment',
};
// 官方 → 项目（用于把官方配方里的物品名翻译回项目 ID）
const REV_ITEM = {};
for (const [p, o] of Object.entries(ITEM_MAP)) REV_ITEM[o] = p;

// 配方键改名（项目配方键 → 官方配方名）。未列出的视为同名。
const RECIPE_MAP = {
  'green-circuit': 'electronic-circuit',
  'science-pack': 'automation-science-pack',
  'green-science': 'logistic-science-pack',
  'military-science': 'military-science-pack',
  'assembling-machine': 'assembling-machine-1',
  'assembling-machine-mk2': 'assembling-machine-2',
  'underground': 'underground-belt',
  'burner-drill': 'burner-mining-drill',
  'electric-drill': 'electric-mining-drill',
  'refinery': 'oil-refinery',
  'lamp': 'small-lamp',
  'long-inserter': 'long-handed-inserter',
  'empty-barrel': 'empty-barrel',
  'explosive': 'explosives',
  'electric-engine': 'electric-engine-unit',
  'magazine': 'firearm-magazine',
  'piercing-rounds': 'piercing-rounds-magazine',
  'uranium-rounds': 'uranium-rounds-magazine',
  'rocket-ammo': 'rocket',
  'logistic-chest-passive': 'passive-provider-chest',
  'logistic-chest-active': 'active-provider-chest',
  'logistic-chest-storage': 'storage-chest',
  'logistic-chest-requester': 'requester-chest',
  'logistic-chest-buffer': 'buffer-chest',
  // 炼油 / 化工 / 离心
  'basic-oil': 'basic-oil-processing',
  'advanced-oil': 'advanced-oil-processing',
  'simple-coal': 'simple-coal-liquefaction',
  'crack-light': 'heavy-oil-cracking',
  'crack-gas': 'light-oil-cracking',
  'solid-fuel-light-oil': 'solid-fuel-from-light-oil',
  'solid-fuel-heavy-oil': 'solid-fuel-from-heavy-oil',
  'uranium-processing': 'uranium-processing',
  // 装备配方
  'portable-solar-panel': 'solar-panel-equipment',
  'personal-battery': 'battery-equipment',
  'portable-fusion-reactor': 'fusion-reactor-equipment',
  'exoskeleton': 'exoskeleton-equipment',
  'nightvision': 'night-vision-equipment',
  'energy-shield': 'energy-shield-equipment',
  'energy-shield-mk2': 'energy-shield-mk2-equipment',
  'personal-laser-defense': 'personal-laser-defense-equipment',
  'discharge-defense': 'discharge-defense-equipment',
  'personal-roboport': 'personal-roboport-equipment',
  // 2.0 改名 / 官方名不同
  'iron-gear': 'iron-gear-wheel',
  'solid-fuel': 'solid-fuel-from-petroleum-gas',
  'stack-inserter': 'bulk-inserter',
  'kovarex': 'kovarex-enrichment-process',
  'personal-battery-mk2': 'battery-mk2-equipment',
  'personal-roboport-mk2': 'personal-roboport-mk2-equipment',
};

// ===== 保留手工的配方（项目自定 / 故意用旧版，不允许自动覆盖）=====
// 即使官方有同名或映射配方，也保持手工值。例：storage-chest 在官方 2.0 是物流箱
// （自动会错用 logistic-chest-storage 配方），必须手工；模块 3 级官方用太空材料，项目简化。
const KEEP_MANUAL_RECIPES = new Set([
  'steel-stick', 'blue-science', 'fishing-pole', 'iron-axe', 'steel-axe',
  'deconstruction-planner', 'upgrade-planner', 'diesel-locomotive', 'spidertron-remote',
  'explosive-rocket-launcher', 'rocket-control-unit', 'satellite', 'red-wire', 'green-wire',
  'stone-path', 'portable-solar-panel-mk2', 'storage-chest',
  'artillery-wagon', 'artillery-turret', 'artillery-shell', 'spidertron',
  'speed-module-3', 'productivity-module-3', 'efficiency-module-3', 'portable-fusion-reactor',
  'cliff-explosives',
]);

// ================= 小工具 =================
// 解析手工 JS 文件里某个 const 对象字面量的顶层键（平衡括号扫描，容错嵌套对象）
function extractObjectKeys(file, objName) {
  const s = fs.readFileSync(file, 'utf8');
  const re = new RegExp('\\bconst\\s+' + objName + '\\s*=\\s*\\{');
  const m = re.exec(s);
  if (!m) throw new Error('未找到 ' + objName + ' 对象: ' + file);
  let i = s.indexOf('{', m.index);
  let depth = 0;
  let j = i;
  for (; j < s.length; j++) {
    const c = s[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  const block = s.slice(i + 1, j);
  const keys = [];
  const km = /^\s*'([^']+)'\s*:/gm;
  let mm;
  while ((mm = km.exec(block))) keys.push(mm[1]);
  return keys;
}

const projectItems = extractObjectKeys(path.join(ROOT, 'js', 'data-items.js'), 'ITEMS');
const projectRecipes = extractObjectKeys(path.join(ROOT, 'js', 'data-recipes.js'), 'RECIPES');
const projectBuildings = extractObjectKeys(path.join(ROOT, 'js', 'data-buildings.js'), 'BUILD_DEFS');

// 官方全部原型名 → 原型（用于查找物品/实体）
const officialNames = new Map();
const officialStack = new Map();   // 官方名 → stack_size
const officialHp = new Map();      // 官方名 → max_health
const officialPower = new Map();   // 官方名 → energy_usage(原始字符串)
for (const [type, tbl] of Object.entries(raw)) {
  if (typeof tbl !== 'object' || !tbl) continue;
  for (const [name, proto] of Object.entries(tbl)) {
    if (!proto || typeof proto !== 'object') continue;
    officialNames.set(name, proto);
    if (typeof proto.stack_size === 'number') officialStack.set(name, proto.stack_size);
    if (typeof proto.max_health === 'number') officialHp.set(name, proto.max_health);
    if (typeof proto.energy_usage === 'string') officialPower.set(name, proto.energy_usage);
  }
}

// 官方名 → 项目 ID（反向翻译）。未知官方名返回 null。
function toProjectItem(official) {
  if (REV_ITEM[official]) return REV_ITEM[official];
  if (projectItems.includes(official)) return official;
  return null;
}
// 项目 ID → 官方名
function toOfficialName(projectId) {
  return ITEM_MAP[projectId] || projectId;
}

// 解析官方 energy_usage 字符串 → kW 数值（"90kW" / "1.2MW" / "420kW"）
function parseKiloWatt(str) {
  if (typeof str !== 'string') return null;
  const m = /^([\d.]+)\s*(k?W|W)$/i.exec(str.trim());
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (m[2].toUpperCase() === 'KW') return v;
  if (m[2].toUpperCase() === 'W') return v / 1000;
  return v * 1000; // MW
}

// ================= 配方提取 =================
// 官方 recipe 结构：ingredients/results 是 {"1":{type,name,amount},...}
// 概率结果：2.0 用 shared_probability {min,max}（区间），旧版用 probability 字段。
function extractRecipe(officialRecipe) {
  const toCount = (arr) => {
    const map = {};
    for (const k of Object.keys(arr)) {
      const e = arr[k];
      const pid = toProjectItem(e.name);
      if (!pid) return { skip: e.name }; // 引用了项目没有的物品 → 跳过
      map[pid] = e.amount !== undefined ? e.amount : (e.amount_min !== undefined ? e.amount_min : 1);
    }
    return map;
  };
  const ingredients = toCount(officialRecipe.ingredients || {});
  if (ingredients.skip) return { skip: 'ingredient-unknown:' + ingredients.skip };
  const out = {};
  const prob = {};
  let hasProb = false;
  for (const k of Object.keys(officialRecipe.results || {})) {
    const e = officialRecipe.results[k];
    const pid = toProjectItem(e.name);
    if (!pid) return { skip: 'result-unknown:' + e.name };
    const amount = e.amount !== undefined ? e.amount : (e.amount_min !== undefined ? e.amount_min : 1);
    let p = null;
    if (typeof e.probability === 'number') p = e.probability;
    else if (e.shared_probability) p = (e.shared_probability.max - e.shared_probability.min);
    if (p !== null && p >= 0 && p <= 1) {
      prob[pid] = Math.round(p * 1000000) / 1000000;
      hasProb = true;
    } else {
      out[pid] = (out[pid] || 0) + amount;
    }
  }
  if (hasProb) {
    // 概率配方（如铀浓缩）：确定部分若有剩余也并入 prob 表
    for (const k of Object.keys(out)) { prob[k] = out[k]; }
    return { time: officialRecipe.energy_required !== undefined ? officialRecipe.energy_required : 0.5, inp: ingredients, prob };
  }
  return { time: officialRecipe.energy_required !== undefined ? officialRecipe.energy_required : 0.5, inp: ingredients, out };
}

// 官方 recipe category → 项目设备
const DEVICE_BY_CATEGORY = {
  'oil-processing': 'refinery',
  'chemistry': 'chemical-plant',
  'centrifuging': 'centrifuge',
};
function deviceFor(officialRecipe) {
  const cats = officialRecipe.categories || {};
  const list = [];
  for (const k of Object.keys(cats)) list.push(cats[k]);
  if (list.length === 0) return 'assembling-machine';
  for (const c of list) if (DEVICE_BY_CATEGORY[c]) return DEVICE_BY_CATEGORY[c];
  return 'assembling-machine';
}

// ================= 生成 GAME_DATA =================
const GAME_DATA = {
  stackSize: {},
  buildingHp: {},
  powerUse: {},
  deviceStats: {},
  recipe: {},
  recipeDevice: {},
};

const log = {
  noOfficialItem: [],      // 项目物品在官方无同名映射
  noOfficialRecipe: [],    // 项目配方在官方无同名映射（→ 覆盖清单候选）
  keptManual: [],          // 保留手工（项目自定/旧版，见 KEEP_MANUAL_RECIPES）
  skippedRecipe: [],       // 官方配方引用了项目没有的物品（跳过）
  noHp: [],                // 项目建筑无官方 max_health
  noStack: [],             // 项目物品无官方 stack_size
};

// ---- stackSize ----
for (const id of projectItems) {
  const oid = toOfficialName(id);
  const st = officialStack.get(oid);
  if (st !== undefined) GAME_DATA.stackSize[id] = st;
  else log.noStack.push(id);
}

// ---- buildingHp ----
for (const id of projectBuildings) {
  const oid = toOfficialName(id);
  const hp = officialHp.get(oid);
  if (hp !== undefined) GAME_DATA.buildingHp[id] = hp;
  else log.noHp.push(id);
}

// ---- powerUse（仅生成官方有 energy_usage 的建筑）----
for (const id of projectBuildings) {
  const oid = toOfficialName(id);
  const eu = officialPower.get(oid);
  if (eu === undefined) continue;
  const kw = parseKiloWatt(eu);
  if (kw !== null && kw > 0) GAME_DATA.powerUse[id] = kw;
}

// ---- deviceStats（设备行为参数：制造速度/模块槽/采矿速度/带速/信号塔效果）----
// 项目建筑 id → [官方 raw 类型, 官方原型名]。仅收录可一对一映射的设备；
// 项目自定/模型不同（抽油机基础速率、信号塔效果系数、机械臂简化模型、
// 地下带距离、分流器、创意/虚空带等）保持手工，不在下表。
const DEVICE_STATS_SOURCES = {
  'assembling-machine': ['assembling-machine', 'assembling-machine-1'],
  'assembling-machine-mk2': ['assembling-machine', 'assembling-machine-2'],
  'assembling-machine-3': ['assembling-machine', 'assembling-machine-3'],
  'electric-furnace': ['furnace', 'electric-furnace'],
  'steel-furnace': ['furnace', 'steel-furnace'],
  'stone-furnace': ['furnace', 'stone-furnace'],
  'electric-drill': ['mining-drill', 'electric-mining-drill'],
  'burner-drill': ['mining-drill', 'burner-mining-drill'],
  'pumpjack': ['mining-drill', 'pumpjack'],
  'lab': ['lab', 'lab'],
  'beacon': ['beacon', 'beacon'],
  'transport-belt': ['transport-belt', 'transport-belt'],
  'fast-transport-belt': ['transport-belt', 'fast-transport-belt'],
  'express-transport-belt': ['transport-belt', 'express-transport-belt'],
  'underground': ['underground-belt', 'underground-belt'],
  'fast-underground-belt': ['underground-belt', 'fast-underground-belt'],
  'express-underground-belt': ['underground-belt', 'express-underground-belt'],
  'refinery': ['assembling-machine', 'oil-refinery'],
  'chemical-plant': ['assembling-machine', 'chemical-plant'],
  'centrifuge': ['assembling-machine', 'centrifuge'],
};
for (const [pid, [rtype, oname]] of Object.entries(DEVICE_STATS_SOURCES)) {
  const proto = raw[rtype] && raw[rtype][oname];
  if (!proto || typeof proto !== 'object') continue;
  const ds = {};
  if (typeof proto.crafting_speed === 'number') ds.craftingSpeed = proto.crafting_speed;
  if (typeof proto.module_slots === 'number') ds.moduleSlots = proto.module_slots;
  if (typeof proto.mining_speed === 'number') ds.miningSpeed = proto.mining_speed;
  if (typeof proto.speed === 'number') ds.beltSpeed = Math.round(proto.speed * 60 * 1000) / 1000; // 官方 speed 单位=格/tick，×60 → 格/秒
  if (typeof proto.distribution_effectivity === 'number') ds.beaconEffectivity = proto.distribution_effectivity;
  if (Object.keys(ds).length) GAME_DATA.deviceStats[pid] = ds;
}

// ---- recipe ----
const skipDetails = {}; // rid → 原因
for (const rid of projectRecipes) {
  if (KEEP_MANUAL_RECIPES.has(rid)) {
    log.keptManual.push(rid);
    skipDetails[rid] = '保留手工（项目自定/旧版，见 KEEP_MANUAL_RECIPES）';
    continue;
  }
  const oname = RECIPE_MAP[rid] || rid;
  const or = raw.recipe[oname];
  if (!or) {
    log.noOfficialRecipe.push(rid);
    skipDetails[rid] = '官方无配方「' + oname + '」';
    continue;
  }
  const rec = extractRecipe(or);
  if (rec.skip) {
    log.skippedRecipe.push(rid + ' → ' + oname);
    skipDetails[rid] = rec.skip;
    continue;
  }
  GAME_DATA.recipe[rid] = rec;
  GAME_DATA.recipeDevice[rid] = deviceFor(or);
}

// ================= 报告 =================
function report() {
  console.log('==== 名称映射报告 ====');
  console.log('项目物品: ' + projectItems.length + '  项目配方: ' + projectRecipes.length + '  项目建筑: ' + projectBuildings.length + '\n');

  console.log('-- 项目物品无官方同名/映射（stackSize 缺失，需补 ITEM_MAP 或手工覆盖）--');
  console.log(log.noStack.length ? log.noStack.join(', ') : '（无）');
  console.log('\n-- 项目配方无官方同名/映射（候选覆盖清单，含原因）--');
  for (const rid of log.noOfficialRecipe) console.log('  ' + rid + '   ← ' + skipDetails[rid]);
  if (!log.noOfficialRecipe.length) console.log('（无）');
  console.log('\n-- 保留手工的配方（项目自定/旧版，不自动覆盖）--');
  for (const rid of log.keptManual) console.log('  ' + rid + '   ← ' + skipDetails[rid]);
  if (!log.keptManual.length) console.log('（无）');
  console.log('\n-- 官方配方引用了项目没有的物品（跳过，含原因）--');
  for (const rid of log.skippedRecipe) console.log('  ' + rid + '   ← ' + skipDetails[rid.split(' → ')[0]]);
  if (!log.skippedRecipe.length) console.log('（无）');
  console.log('\n-- 项目建筑无官方 max_health（保持手工/默认）--');
  console.log(log.noHp.length ? log.noHp.join(', ') : '（无）');
  console.log('\n-- 设备行为参数 deviceStats（官方已接入）--');
  console.log(Object.keys(GAME_DATA.deviceStats).length ? Object.keys(GAME_DATA.deviceStats).join(', ') : '（无）');
  console.log('deviceStats 手工保留（项目自定/模型不同，未接入）：抽油机基础速率、信号塔效果系数、机械臂简化模型、地下带距离、分流器、创意/虚空带');

  console.log('\n==== 与手工表差异 ====');
  // 对比 stackSize
  const s = fs.readFileSync(path.join(ROOT, 'js', 'data-items.js'), 'utf8');
  const sm = /const STACK_SIZES = \{([\s\S]*?)\n\};/.exec(s);
  const manualStack = {};
  if (sm) {
    const km = /^\s*'([^']+)'\s*:\s*(\d+)/gm;
    let mm;
    while ((mm = km.exec(sm[1]))) manualStack[mm[1]] = parseInt(mm[2], 10);
  }
  const stackDiff = [];
  for (const id of Object.keys(manualStack)) {
    const auto = GAME_DATA.stackSize[id];
    if (auto !== undefined && auto !== manualStack[id]) stackDiff.push(id + ': 手工' + manualStack[id] + ' → 官方' + auto);
  }
  console.log('stackSize 差异: ' + (stackDiff.length ? stackDiff.join(', ') : '（与官方一致）'));

  // 对比 recipe（vm 解析手工 RECIPES 字面量逐条 diff，发现 storage-chest 类语义冲突）
  const rr = fs.readFileSync(path.join(ROOT, 'js', 'data-recipes.js'), 'utf8');
  const rm = /const RECIPES = \{([\s\S]*?)\n\};/.exec(rr);
  let manualRecipes = {};
  if (rm) {
    try { manualRecipes = vm.runInNewContext('({' + rm[1] + '})'); }
    catch (e) { console.log('配方 diff: 解析手工 RECIPES 失败: ' + e.message); }
  }
  const normInp = (r) => JSON.stringify(Object.keys(r.inp || {}).sort().map(k => k + ':' + r.inp[k]));
  const normOut = (r) => { const o = r.out || r.prob || {}; return JSON.stringify(Object.keys(o).sort().map(k => k + ':' + o[k])); };
  const recipeDiff = [];
  for (const rid of Object.keys(manualRecipes)) {
    const auto = GAME_DATA.recipe[rid];
    const man = manualRecipes[rid];
    if (!auto || !man || typeof man !== 'object') continue;
    const aInp = normInp(auto), mInp = normInp(man);
    const aOut = normOut(auto), mOut = normOut(man);
    if (auto.time !== man.time || aInp !== mInp || aOut !== mOut) {
      recipeDiff.push(rid + ': 手工{time:' + man.time + ',inp:' + mInp + ',out:' + mOut + '} vs 官方{time:' + auto.time + ',inp:' + aInp + ',out:' + aOut + '}');
    }
  }
  console.log('recipe 差异（自动覆盖且与手工不一致，需人工核对语义）: ' +
    (recipeDiff.length ? recipeDiff.length + ' 条\n  ' + recipeDiff.join('\n  ') : '（与官方一致）'));
  console.log('配方覆盖统计: 手工 RECIPES ' + Object.keys(manualRecipes).length + ' 条, 自动生成 GAME_DATA.recipe ' +
    Object.keys(GAME_DATA.recipe).length + ' 条, 保留手工 ' + log.keptManual.length + ' 条(见上), 未覆盖 ' +
    (Object.keys(manualRecipes).length - Object.keys(GAME_DATA.recipe).length - log.keptManual.length) + ' 条(官方无/引用未知物品,见候选清单)');
}

if (REPORT) {
  report();
  process.exit(0);
}

// ================= 输出 js/data.generated.js =================
const header = [
  "'use strict';",
  '',
  '// ===== 自动生成文件：由 factorio-data 经 tools/generate-game-data.js 现场生成 =====',
  '// 唯一数值源 = factorio-data（经 tools/convert-data.js 现场转换），请勿手改本文件。',
  '// 重新生成：npm run data（或 node tools/generate-game-data.js）',
  '// GAME_DATA 结构：',
  '//   recipe[key] = { time, inp:{item:count}, out:{item:count} | prob:{item:p} }',
  '//   recipeDevice[key] = 组装机/化工厂/炼油厂/离心机',
  '//   stackSize[item] = 最大堆叠,  buildingHp[building] = 血量,  powerUse[building] = 功耗kW',
  '//   deviceStats[id] = { craftingSpeed, moduleSlots, miningSpeed, beltSpeed(格/s), beaconEffectivity }',
  'const GAME_DATA = ' + JSON.stringify(GAME_DATA, null, 1) + ';',
  '',
].join('\n');

fs.writeFileSync(OUT_FILE, header);
console.log('OK: 已生成 ' + path.relative(ROOT, OUT_FILE) + ' (配方 ' + Object.keys(GAME_DATA.recipe).length + ' 条, 堆叠 ' + Object.keys(GAME_DATA.stackSize).length + ' 条, 血量 ' + Object.keys(GAME_DATA.buildingHp).length + ' 条, 功耗 ' + Object.keys(GAME_DATA.powerUse).length + ' 条, 设备参数 ' + Object.keys(GAME_DATA.deviceStats).length + ' 条)');
