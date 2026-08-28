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
const OUT_FILE = path.join(ROOT, 'js', 'data', 'data.generated.js');
const DATA_DIR = path.join(ROOT, 'data');
const REPORT = process.argv.includes('--report');

// 现场转换 factorio-data → data.raw 的 JS 对象（内存，不生成中间文件）
const raw = require('./convert-data.js');

// ================= 名称映射注册表（项目 → 官方） =================
// 未列出的视为同名（项目 ID 即官方原型名）。
// 物品/实体改名：用于 stackSize / max_health / energy_usage / 配方物品名 的翻译。
const ITEM_MAP = {
  // 项目物品 ID 现已与官方一致（对齐《异星工厂》官方命名），无需额外映射。
  // 唯一例外：装备类物品（官方为 equipment 类型，命名同 item 原型），此处留空由同名兜底。
};
// 官方 → 项目（用于把官方配方里的物品名翻译回项目 ID）
const REV_ITEM = {};
for (const [p, o] of Object.entries(ITEM_MAP)) REV_ITEM[o] = p;

// 配方键改名（项目配方键 → 官方配方名）。未列出的视为同名。
const RECIPE_MAP = {
  // 项目配方键与官方同名（对齐官方命名），仅保留少数项目自定键 → 官方配方名。
  // 炼油 / 化工 / 离心
  'basic-oil': 'basic-oil-processing',
  'advanced-oil': 'advanced-oil-processing',
  'simple-coal': 'simple-coal-liquefaction',
  'crack-light': 'heavy-oil-cracking',
  'crack-gas': 'light-oil-cracking',
  'solid-fuel-light-oil': 'solid-fuel-from-light-oil',
  'solid-fuel-heavy-oil': 'solid-fuel-from-heavy-oil',
  'solid-fuel': 'solid-fuel-from-petroleum-gas',
  'uranium-processing': 'uranium-processing',
  'kovarex': 'kovarex-enrichment-process',
  // 太空时代 Gleba：项目 yumako-mash 对应官方 yumako-processing（含种子产出，实现自持农业）
  'yumako-mash': 'yumako-processing',
};
// ===== 保留手工的配方（项目自定 / 故意用旧版，不允许自动覆盖）=====
// 即使官方有同名或映射配方，也保持手工值。例：storage-chest 在官方 2.0 是物流箱
// （自动会错用 logistic-chest-storage 配方），必须手工；模块 3 级官方用太空材料，项目简化。
const KEEP_MANUAL_RECIPES = new Set([
  'chemical-science-pack',
  'deconstruction-planner', 'upgrade-planner', 'spidertron-remote',
  'satellite', 'red-wire', 'green-wire',
  'stone-path', 'storage-chest',
  // ===== 太空时代 Space Age 手工适配配方（官方配方依赖星球专属资源，此处适配基础资源）=====
  'lithium', 'lithium-brine', 'ammoniacal-solution', 'ammoniacal-solution-separation', 'electromagnetic-science-pack',
  'agricultural-science-pack', 'biochamber',
  'yumako-growing', 'jellynut-growing',
  // 太空时代 Gleba 金属细菌链：细菌→板还原配方为项目适配（官方无此合成，Gleba 用细菌还原成熔融金属再铸板），保留手工
  'iron-plate-from-iron-bacteria', 'copper-plate-from-copper-bacteria',
  // ===== 太空时代 Aquilo 低温学链（官方配方依赖低温/液空等星球资源，此处适配基础资源）=====
  'ammonia', 'fluorine', 'fluoroketone-cold', 'fluoroketone-hot',
  // ===== 太空时代 熔融金属/废料（官方配方依赖行星资源，此处适配基础资源）=====
  // 注：iron-ore-melting/copper-ore-melting/casting-* 已按官方数据自动桥接，不在此保留手工。
  'lava', 'molten-iron-from-lava', 'molten-copper-from-lava', 'scrap', 'recycle-scrap',
  // ===== 太空时代 Vulcanus 钨矿（官方为天然矿脉，无合成配方）=====
  'tungsten-ore',
  // ===== 太空时代 生物实验室（Gleba biolab：官方配方依赖 biter-egg/capture-robot-rocket=生物星球资源，此处适配现有生物链资源）=====
  'biolab',
  // ===== 空间科研包（官方 space-science-pack 2.1.17 需微重力=空间平台中枢，项目同时保留卫星发射链路）=====
  'space-science-pack',
]);;

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

const projectItems = extractObjectKeys(path.join(ROOT, 'js', 'data', 'data-items.js'), 'ITEMS');
const projectRecipes = extractObjectKeys(path.join(ROOT, 'js', 'data', 'data-recipes.js'), 'RECIPES');
const projectBuildings = extractObjectKeys(path.join(ROOT, 'js', 'data', 'data-buildings.js'), 'BUILD_DEFS');
// 独立配方表（炼油厂/离心机面板专用，不在 RECIPES 中）
const projectRefRecipes = extractObjectKeys(path.join(ROOT, 'js', 'data', 'data-recipes.js'), 'REFINERY_RECIPES');
const projectCentRecipes = extractObjectKeys(path.join(ROOT, 'js', 'data', 'data-recipes.js'), 'CENTRIFUGE_RECIPES');

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

// 解析官方功率字符串 → kW 数值（"90kW"→90 / "1.2MW"→1200 / "420kW"→420 / "10MW"→10000 / "1GW"→1e6）
function parseKiloWatt(str) {
  if (typeof str !== 'string') return null;
  const m = /^([\d.]+)\s*([A-Za-z]+)$/i.exec(str.trim());
  if (!m) return null;
  const v = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  if (u === 'W') return v / 1000;
  if (u === 'KW') return v;
  if (u === 'MW') return v * 1000;
  if (u === 'GW') return v * 1000000;
  return null;
}
// 解析能量字符串 → kJ 数值（"5MJ"→5000、"20MJ"→20000、"8GJ"→8000000）
function parseEnergyKJ(str) {
  if (typeof str !== 'string') return null;
  const m = /^([\d.]+)\s*([A-Za-z]+)$/.exec(str.trim());
  if (!m) return null;
  const v = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  if (u === 'J') return v / 1000;
  if (u === 'KJ') return v;
  if (u === 'MJ') return v * 1000;
  if (u === 'GJ') return v * 1000000;
  return null;
}
// 解析能量字符串 → MJ 数值（"10MJ"→10、"1MJ"→1、"8GJ"→8000）
function parseEnergyMJ(str) {
  if (typeof str !== 'string') return null;
  const m = /^([\d.]+)\s*([A-Za-z]+)$/.exec(str.trim());
  if (!m) return null;
  const v = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  if (u === 'J') return v / 1e6;
  if (u === 'KJ') return v / 1000;
  if (u === 'MJ') return v;
  if (u === 'GJ') return v * 1000;
  return null;
}
// 解析功率字符串 → MW 数值（"1GW"→1000、"10GW"→10000、"2MW"→2）
function parsePowerMW(str) {
  if (typeof str !== 'string') return null;
  const m = /^([\d.]+)\s*([A-Za-z]+)$/.exec(str.trim());
  if (!m) return null;
  const v = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  if (u === 'W') return v / 1e6;
  if (u === 'KW') return v / 1000;
  if (u === 'MW') return v;
  if (u === 'GW') return v * 1000;
  return null;
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
  'oil-processing': 'oil-refinery',
  'chemistry': 'chemical-plant',
  'centrifuging': 'centrifuge',
};
function deviceFor(officialRecipe) {
  const cats = officialRecipe.categories || {};
  const list = [];
  for (const k of Object.keys(cats)) list.push(cats[k]);
  if (list.length === 0) return 'assembling-machine-1';
  for (const c of list) if (DEVICE_BY_CATEGORY[c]) return DEVICE_BY_CATEGORY[c];
  return 'assembling-machine-1';
}
// 空间平台中枢专属配方（Space Platform 设备，官方 crafting 类别但须在空间平台中枢生产）
const HUB_RECIPE_IDS = new Set(['space-platform-foundation', 'space-platform-starter-pack', 'space-platform-hub']);

// ===== DLC 专属设备配方映射（配方ID → 设备ID）=====
// 官方 DLC 配方使用专属 crafting categories（organic/crushing/metallurgy/cryogenics/
// electromagnetics/captive-spawner-process 等），生成脚本的 deviceFor() 无法识别，
// 此处显式映射到项目专属设备，使 recipeDevice 正确。运行时会优先取 GAME_DATA.recipeDevice。
const DLC_DEVICE_RECIPES = {
  // 生化炉 biochamber（Space Age organic）
  'yumako-mash': 'biochamber', 'bioflux': 'biochamber', 'nutrients-from-yumako-mash': 'biochamber', 'nutrients-from-bioflux': 'biochamber', 'nutrients-from-spoilage': 'biochamber', 'burnt-spoilage': 'biochamber',
  'biosulfur': 'biochamber', 'bioplastic': 'biochamber', 'biolubricant': 'biochamber',
  'agricultural-science-pack': 'biochamber', 'biochamber': 'biochamber',
  'jellynut-processing': 'biochamber', 'biter-egg': 'biochamber', 'nutrients-from-biter-egg': 'biochamber',
  'fish-breeding': 'biochamber', 'nutrients-from-fish': 'biochamber', 'rocket-fuel-from-jelly': 'biochamber',
  'iron-bacteria': 'biochamber', 'copper-bacteria': 'biochamber', 'iron-bacteria-cultivation': 'biochamber', 'copper-bacteria-cultivation': 'biochamber',
  'pentapod-egg': 'biochamber',
  'carbon-fiber': 'biochamber',
  // 电磁工厂 electromagnetic-plant（Space Age electromagnetics）
  'superconductor': 'electromagnetic-plant', 'electromagnetic-science-pack': 'electromagnetic-plant',
  'electromagnetic-plant': 'electromagnetic-plant', 'promethium-science-pack': 'electromagnetic-plant',
  'holmium-ore': 'electromagnetic-plant', 'holmium-plate': 'electromagnetic-plant',
  'supercapacitor': 'electromagnetic-plant', 'tesla-ammo': 'electromagnetic-plant',
  'tesla-turret': 'electromagnetic-plant', 'railgun-turret': 'electromagnetic-plant',
  'electrolyte': 'electromagnetic-plant', 'teslagun': 'electromagnetic-plant',
  'lightning-collector': 'electromagnetic-plant',
  // 破碎机 crusher（Space Age crushing）
  'crusher': 'crusher', 'ice-melting': 'crusher',
  'metallic-asteroid-crushing': 'crusher', 'carbonic-asteroid-crushing': 'crusher', 'oxide-asteroid-crushing': 'crusher',
  'advanced-metallic-asteroid-crushing': 'crusher', 'advanced-carbonic-asteroid-crushing': 'crusher', 'advanced-oxide-asteroid-crushing': 'crusher',
  'metallic-asteroid-reprocessing': 'crusher', 'carbonic-asteroid-reprocessing': 'crusher', 'oxide-asteroid-reprocessing': 'crusher',
  // 铸造厂 foundry（Space Age metallurgy / casting / crafting-with-fluid）
  'tungsten-ore': 'foundry', 'tungsten-plate': 'foundry', 'tungsten-carbide': 'foundry',
  'metallurgic-science-pack': 'foundry', 'foundry': 'foundry',
  'iron-ore-melting': 'foundry', 'copper-ore-melting': 'foundry',
  'casting-iron': 'foundry', 'casting-steel': 'foundry', 'casting-copper': 'foundry',
  'casting-iron-gear-wheel': 'foundry', 'casting-iron-stick': 'foundry',
  'casting-pipe': 'foundry', 'casting-pipe-to-ground': 'foundry',
  'casting-low-density-structure': 'foundry', 'casting-copper-cable': 'foundry',
  'concrete-from-molten-iron': 'foundry',
  'lava': 'foundry', 'molten-iron-from-lava': 'foundry', 'molten-copper-from-lava': 'foundry',
  'turbo-transport-belt': 'foundry', 'turbo-underground-belt': 'foundry', 'turbo-splitter': 'foundry',
  // 低温工厂 cryogenic-plant（Space Age cryogenics）
  'ammonia': 'cryogenic-plant', 'fluorine': 'cryogenic-plant', 'fluoroketone-cold': 'cryogenic-plant',
  'fluoroketone-hot': 'cryogenic-plant', 'cryogenic-science-pack': 'cryogenic-plant', 'cryogenic-plant': 'cryogenic-plant',
  'foundation': 'cryogenic-plant', 'ice-platform': 'cryogenic-plant', // 太空时代地形（官方 cryogenics 低温工厂，流体配方）
  'steam-condensation': 'chemical-plant', 'acid-neutralisation': 'chemical-plant', // 化工厂（官方 chemistry/cryogenics 双类别）
  // 农业塔 agricultural-tower（Space Age 种植）
  'yumako-growing': 'agricultural-tower', 'jellynut-growing': 'agricultural-tower',
  // 空间平台中枢（Space Platform）
  'space-platform-foundation': 'space-platform-hub', 'space-platform-starter-pack': 'space-platform-hub', 'space-platform-hub': 'space-platform-hub',
};

// ================= 官方多语言命名（data/*/locale/{en,zh-CN}/*.cfg） =================
// 官方命名（物品/实体/配方/流体）经项目 ID 映射后写入 GAME_DATA.names / GAME_DATA.recipeNames，
// 供设置内中英文切换使用（见 js/data-util.js 的 localizedName）。
// 段优先级：item-name > entity-name > recipe-name > fluid-name（同名时前者优先）。
const LOCALE_SECTIONS = ['item-name', 'entity-name', 'recipe-name', 'fluid-name', 'equipment-name', 'tile-name'];
// 解析单个 .cfg：返回 { section: { key: value } }（只保留上述段，跳过 [段头]/空行/无=行）
function parseLocaleFile(file) {
  const out = {};
  let sec = null;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] === '[') {
      const m = /^\[([^\]]+)\]$/.exec(line);
      sec = m ? m[1] : null;
      continue;
    }
    if (!sec || !LOCALE_SECTIONS.includes(sec)) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (!key || !val) continue;
    (out[sec] = out[sec] || {})[key] = val;
  }
  return out;
}
// localeBySection[段][官方名] = { zh, en }（多 mod / 多文件合并，后读覆盖前读）
const localeBySection = {};
if (fs.existsSync(DATA_DIR)) {
  for (const mod of fs.readdirSync(DATA_DIR)) {
    const mpath = path.join(DATA_DIR, mod);
    const ldir = path.join(mpath, 'locale');
    if (!fs.statSync(mpath).isDirectory() || !fs.existsSync(ldir)) continue;
    for (const langDir of fs.readdirSync(ldir)) {
      const lang = langDir === 'zh-CN' ? 'zh' : (langDir === 'en' ? 'en' : null);
      if (!lang) continue;
      const lpath = path.join(ldir, langDir);
      if (!fs.statSync(lpath).isDirectory()) continue;
      for (const f of fs.readdirSync(lpath)) {
        if (!f.endsWith('.cfg')) continue;
        const parsed = parseLocaleFile(path.join(lpath, f));
        for (const sec of LOCALE_SECTIONS) {
          if (!parsed[sec]) continue;
          localeBySection[sec] = localeBySection[sec] || {};
          for (const [k, v] of Object.entries(parsed[sec])) {
            const e = localeBySection[sec][k] = localeBySection[sec][k] || {};
            e[lang] = v;
          }
        }
      }
    }
  }
}
// 官方名 → { zh, en }（按段优先级取首个中英齐全的条目）
function officialLocale(oid) {
  for (const sec of LOCALE_SECTIONS) {
    const t = localeBySection[sec] && localeBySection[sec][oid];
    if (t && t.zh && t.en) return t;
  }
  return null;
}
// 项目物品/建筑/流体：项目 ID → { zh, en }
const GAME_NAMES = {};
for (const id of projectItems) {
  const t = officialLocale(toOfficialName(id));
  if (t) GAME_NAMES[id] = { zh: t.zh, en: t.en };
}
// 项目配方：配方键 → { zh, en }（含炼油/离心机独立配方表，供面板配方名切换）
const RECIPE_NAMES = {};
for (const rid of new Set([...projectRecipes, ...projectRefRecipes, ...projectCentRecipes])) {
  const oname = RECIPE_MAP[rid] || rid;
  const t = localeBySection['recipe-name'] && localeBySection['recipe-name'][oname];
  if (t && t.zh && t.en) RECIPE_NAMES[rid] = { zh: t.zh, en: t.en };
}

// ================= 生成 GAME_DATA =================
const GAME_DATA = {
  stackSize: {},
  buildingHp: {},
  powerUse: {},
  deviceStats: {},
  recipe: {},
  recipeDevice: {},
  names: GAME_NAMES,
  recipeNames: RECIPE_NAMES,
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
  'assembling-machine-1': ['assembling-machine', 'assembling-machine-1'],
  'assembling-machine-2': ['assembling-machine', 'assembling-machine-2'],
  'assembling-machine-3': ['assembling-machine', 'assembling-machine-3'],
  'electric-furnace': ['furnace', 'electric-furnace'],
  'steel-furnace': ['furnace', 'steel-furnace'],
  'stone-furnace': ['furnace', 'stone-furnace'],
  'electric-mining-drill': ['mining-drill', 'electric-mining-drill'],
  'burner-mining-drill': ['mining-drill', 'burner-mining-drill'],
  'pumpjack': ['mining-drill', 'pumpjack'],
  'big-mining-drill': ['mining-drill', 'big-mining-drill'],  // 太空时代大型采矿钻机：mining_speed=2.5, module_slots=4
  'lab': ['lab', 'lab'],
  'beacon': ['beacon', 'beacon'],
  'transport-belt': ['transport-belt', 'transport-belt'],
  'fast-transport-belt': ['transport-belt', 'fast-transport-belt'],
  'express-transport-belt': ['transport-belt', 'express-transport-belt'],
  'turbo-transport-belt': ['transport-belt', 'turbo-transport-belt'],  // 太空时代4档带（速度7.5格/s）
  'loader': ['loader', 'loader'],  // 装载机（官方 loader：speed 0.03125 → 1.875 格/s）
  'fast-loader': ['loader', 'fast-loader'],  // 高速装载机（speed 0.0625 → 3.75 格/s）
  'express-loader': ['loader', 'express-loader'],  // 极速装载机（speed 0.09375 → 5.625 格/s）
  'turbo-loader': ['loader', 'turbo-loader'],  // 超速装载机（speed 0.125 → 7.5 格/s）
  'underground-belt': ['underground-belt', 'underground-belt'],
  'fast-underground-belt': ['underground-belt', 'fast-underground-belt'],
  'express-underground-belt': ['underground-belt', 'express-underground-belt'],
  'turbo-underground-belt': ['underground-belt', 'turbo-underground-belt'],  // 太空时代4档地下带
  'oil-refinery': ['assembling-machine', 'oil-refinery'],
  'chemical-plant': ['assembling-machine', 'chemical-plant'],
  'centrifuge': ['assembling-machine', 'centrifuge'],
  'electromagnetic-plant': ['assembling-machine', 'electromagnetic-plant'],  // 太空时代电磁工厂：crafting_speed=2, module_slots=5
  'recycler': ['furnace', 'recycler'],  // 回收机：crafting_speed=0.5, module_slots=4
  'biochamber': ['assembling-machine', 'biochamber'],  // 太空时代生化炉：crafting_speed=2, module_slots=4
  'crusher': ['assembling-machine', 'crusher'],  // 太空时代破碎机：crafting_speed=1, module_slots=2
  'foundry': ['assembling-machine', 'foundry'],  // 太空时代铸造厂（Vulcanus）：crafting_speed=4, module_slots=4
  'cryogenic-plant': ['assembling-machine', 'cryogenic-plant'],  // 太空时代低温工厂（Aquilo）：crafting_speed=2, module_slots=8
  'captive-biter-spawner': ['assembling-machine', 'captive-biter-spawner'],  // 太空时代虫巢孵化器（Captive biter spawner）：官方 assembling-machine 原型，100kW
  'agricultural-tower': ['agricultural-tower', 'agricultural-tower'],  // 太空时代农业塔（Gleba）：种植建筑，energy_usage=100kW
  'biolab': ['lab', 'biolab'],  // 太空时代生物实验室（Gleba）：官方 researching_speed=2、module_slots=4
};
for (const [pid, [rtype, oname]] of Object.entries(DEVICE_STATS_SOURCES)) {
  const proto = raw[rtype] && raw[rtype][oname];
  if (!proto || typeof proto !== 'object') continue;
  const ds = {};
  if (typeof proto.crafting_speed === 'number') ds.craftingSpeed = proto.crafting_speed;
  if (typeof proto.module_slots === 'number') ds.moduleSlots = proto.module_slots;
  // 官方组装机未写 module_slots 时默认 0 槽（如组装机 I 无插件槽，而不应回退到旧默认 4）
  else if (rtype === 'assembling-machine') ds.moduleSlots = 0;
  if (typeof proto.mining_speed === 'number') ds.miningSpeed = proto.mining_speed;
  if (typeof proto.speed === 'number') ds.beltSpeed = Math.round(proto.speed * 60 * 1000) / 1000; // 官方 speed 单位=格/tick，×60 → 格/秒
  if (typeof proto.distribution_effectivity === 'number') ds.beaconEffectivity = proto.distribution_effectivity;
  if (typeof proto.researching_speed === 'number') ds.researchingSpeed = proto.researching_speed; // 生物实验室 biolab：官方 researching_speed=2（2 倍科研速度）
  if (Object.keys(ds).length) GAME_DATA.deviceStats[pid] = ds;
}

// ---- 地下带最大距离（格）----
// 官方 2.0 改小了地下带距离（基础 5 / 快速 7 / 极速 9），项目原先用 1.x 值（6/14/20），
// 现按用户要求以官方为准。max_distance 为“最远配对数/距离”，直接采用官方数值。
const undergroundDist = {};
for (const [pid, [rtype, oname]] of Object.entries({
  'underground-belt': ['underground-belt', 'underground-belt'],
  'fast-underground-belt': ['underground-belt', 'fast-underground-belt'],
  'express-underground-belt': ['underground-belt', 'express-underground-belt'],
  'turbo-underground-belt': ['underground-belt', 'turbo-underground-belt'],  // 太空时代4档地下带（max_distance 11）
})) {
  const proto = raw[rtype] && raw[rtype][oname];
  if (proto && typeof proto.max_distance === 'number') undergroundDist[pid] = proto.max_distance;
}

// ---- 太阳能板 / 蓄电器 ----
// solarPower：production "60kW" → 60（kW）；accumCap：energy_source.buffer_capacity "5MJ" → 5000（kJ）；
// accumChargeRate：energy_source.input_flow_limit "300kW" → 300（kW，充/放电速率上限）。
const renewable = {};
{
  const sp = raw['solar-panel'] && raw['solar-panel']['solar-panel'];
  if (sp) { const kw = parseKiloWatt(sp.production); if (kw !== null) renewable.solarPower = kw; }
  const acc = raw.accumulator && raw.accumulator.accumulator;
  if (acc && acc.energy_source) {
    const cap = parseEnergyKJ(acc.energy_source.buffer_capacity);
    if (cap !== null) renewable.accumCap = cap;
    const chg = parseKiloWatt(acc.energy_source.input_flow_limit);
    if (chg !== null) renewable.accumChargeRate = chg;
  }
}

// ---- 流体容量 / 抽水机 ----
// storageTank：fluid_box.volume（官方 2.0 储液罐 25000）；fluidWagon：capacity（官方 2.0 流体车厢 50000）；
// pumpRate：pumping_speed（官方 2.0 抽水机 20）。
const fluidCapacity = {};
{
  const st = raw['storage-tank'] && raw['storage-tank']['storage-tank'];
  if (st && st.fluid_box && typeof st.fluid_box.volume === 'number') fluidCapacity.storageTank = st.fluid_box.volume;
  const fw = raw['fluid-wagon'] && raw['fluid-wagon']['fluid-wagon'];
  if (fw && typeof fw.capacity === 'number') fluidCapacity.fluidWagon = fw.capacity;
  const op = raw['offshore-pump'] && raw['offshore-pump']['offshore-pump'];
  if (op && typeof op.pumping_speed === 'number') fluidCapacity.pumpRate = op.pumping_speed;
  const pp = raw.pipe && raw.pipe.pipe;
  if (pp && pp.fluid_box && typeof pp.fluid_box.volume === 'number') fluidCapacity.pipeVolume = pp.fluid_box.volume;
  const pt = raw['pipe-to-ground'] && raw['pipe-to-ground']['pipe-to-ground'];
  if (pt && pt.fluid_box && typeof pt.fluid_box.volume === 'number') fluidCapacity.pipeToGroundVolume = pt.fluid_box.volume;
}

// ---- 信号塔影响半径（格）----
// 官方 2.0 supply_area_distance=3（项目原先用 1.x 的 4）。moduleSlots/powerUse 已由 deviceStats/powerUse 接入。
const beaconRange = raw.beacon && raw.beacon.beacon && typeof raw.beacon.beacon.supply_area_distance === 'number'
  ? raw.beacon.beacon.supply_area_distance : undefined;

// ---- 炮塔 / 弹药伤害 ----
// 2.0 官方类型：gun-turret=ammo-turret、laser-turret=electric-turret、flamethrower-turret=fluid-turret。
// attack_parameters.cooldown 单位为 tick，÷60 → 秒（两次射击间隔）。官方数据未提供伤害 → 保持手工。
// 能耗单源化（本迭代）：electric-turret 的 powerDraw（射击最大吸电）取官方
//   energy_source.input_flow_limit（"9600kW"→9600、"7MW"→7000、"10MW"→10000，parseKiloWatt→kW），
//   drain（待机空载）取官方 energy_source.drain（"24kW"→24、"1MW"→1000）。
//   ammo/fluid 炮塔（gun/rocket/flamethrower）不吃电（rocket 吃弹药、flamethrower 吃油），powerDraw=0。
// 炮塔基础数据（射程/冷却/耗电/单发伤害）——全部来自 data.generated.js 单源。
// 说明：射程/冷却/耗电取官方 factorio-data（attack_parameters.range/cooldown、
//      energy_source.input_flow_limit/drain）；damage 为「单发基准伤害」。
//      官方 laser/tesla/flamethrower 为逐 tick 光束/流伤害，项目按「单发伤害」口径
//      单源化（数值沿用项目既有简化口径，见 combat2-turrets.js），rocket/explosive-rocket
//      取官方 projectile 单发伤害（200/50），供弹药伤害 ammoDamage 单源读取。
const turret = {};
{
  const g = raw['ammo-turret'] && raw['ammo-turret']['gun-turret'];
  if (g && g.attack_parameters) turret['gun-turret'] = {
    range: g.attack_parameters.range,
    fireRate: Math.round(g.attack_parameters.cooldown / 60 * 1000) / 1000,
    powerDraw: 0,
  };
  const l = raw['electric-turret'] && raw['electric-turret']['laser-turret'];
  if (l && l.attack_parameters) turret['laser-turret'] = {
    range: l.attack_parameters.range,
    fireRate: Math.round(l.attack_parameters.cooldown / 60 * 1000) / 1000,
    powerDraw: parseKiloWatt(l.energy_source && l.energy_source.input_flow_limit),
    drain: parseKiloWatt(l.energy_source && l.energy_source.drain),
    damage: 14,   // 单发激光伤害（项目简化口径，官方 laser-beam 逐 tick 10）
  };
  const f = raw['fluid-turret'] && raw['fluid-turret']['flamethrower-turret'];
  if (f && f.attack_parameters) turret['flamethrower-turret'] = {
    range: f.attack_parameters.range,
    fireRate: Math.round(f.attack_parameters.cooldown / 60 * 1000) / 1000,
    powerDraw: 0,
    damage: 8,    // 单发火焰伤害（项目简化口径，官方 flamethrower-fire-stream 逐 tick 3）
  };
  // 太空时代特斯拉炮塔（Fulgora，Space Age 官方 electric-turret 原型）：射程 30、cooldown 120tick=2s
  const t = raw['electric-turret'] && raw['electric-turret']['tesla-turret'];
  if (t && t.attack_parameters) turret['tesla-turret'] = {
    range: t.attack_parameters.range,
    fireRate: Math.round(t.attack_parameters.cooldown / 60 * 1000) / 1000,
    powerDraw: parseKiloWatt(t.energy_source && t.energy_source.input_flow_limit),
    drain: parseKiloWatt(t.energy_source && t.energy_source.drain),
    damage: 30,   // 首目标电弧伤害（项目简化口径，官方 chain-tesla-turret-beam 120）
  };
  // 太空时代火箭炮塔（Space Age 官方 ammo-turret 原型）：射程 36、cooldown 120tick=2s、最小射程 15
  const rt = raw['ammo-turret'] && raw['ammo-turret']['rocket-turret'];
  if (rt && rt.attack_parameters) turret['rocket-turret'] = {
    range: rt.attack_parameters.range,
    fireRate: Math.round(rt.attack_parameters.cooldown / 60 * 1000) / 1000,
    powerDraw: 0,
  };
  // 太空时代电磁轨道炮塔（Space Age 官方 ammo-turret 原型）：射程 40、cooldown 170tick≈2.833s、最小射程 3.5
  const rg = raw['ammo-turret'] && raw['ammo-turret']['railgun-turret'];
  if (rg && rg.attack_parameters) turret['railgun-turret'] = {
    range: rg.attack_parameters.range,
    fireRate: Math.round(rg.attack_parameters.cooldown / 60 * 1000) / 1000,
    powerDraw: parseKiloWatt(rg.energy_source && rg.energy_source.input_flow_limit),
    drain: parseKiloWatt(rg.energy_source && rg.energy_source.drain),
  };
}

// 污染排放（官方 emissions_per_minute.pollution，单位：污染/分钟）。
// 来源 = 官方 energy_source.emissions_per_minute.pollution（factorio-data 单源）。
// 注：核反应堆/火车头/热能机械臂在官方 raw 无 emissions_per_minute（核堆官方零排放、
//     火车头/热能机械臂无数值型排放），故在此以 POLLUTION_MANUAL 兜底值与官方项一并写入
//     GAME_DATA.pollution，使污染系统完全从 data.generated.js 单源读取（不维护第二套数值表）。
const pollution = {};
{
  const POLLUTION_SOURCES_OFFICIAL = [
    ['mining-drill', 'burner-mining-drill'], ['mining-drill', 'electric-mining-drill'],
    ['mining-drill', 'big-mining-drill'],    ['mining-drill', 'pumpjack'],
    ['furnace', 'stone-furnace'],            ['furnace', 'steel-furnace'],
    ['furnace', 'electric-furnace'],         ['boiler', 'boiler'],
    ['assembling-machine', 'oil-refinery'],  ['assembling-machine', 'chemical-plant'],
    ['assembling-machine', 'centrifuge'],
  ];
  for (const [rtype, name] of POLLUTION_SOURCES_OFFICIAL) {
    const proto = raw[rtype] && raw[rtype][name];
    const em = proto && proto.energy_source && proto.energy_source.emissions_per_minute
      && proto.energy_source.emissions_per_minute.pollution;
    if (typeof em === 'number') pollution[name] = em;
  }
  // 官方无直接 emissions_per_minute 的设备（核堆官方零排放、火车头/热能机械臂无数值型排放）：
  // 项目保留的微量兜底值，一并单源进 GAME_DATA.pollution（单位仍为「污染/分」）。
  const POLLUTION_MANUAL = {
    'nuclear-reactor': 7,   // 核反应堆：官方零排放，项目保留微量（燃料处理/热量管理）
    'burner-inserter': 0.3, // 热能机械臂：烧煤微量
    'locomotive': 3,        // 火车头：烧煤行驶微量
  };
  for (const [name, val] of Object.entries(POLLUTION_MANUAL)) pollution[name] = val;
}

// 弹药伤害：遍历 ammo_type.action（2.0 结构可能是 {"1":{...}} 或直接对象），找 damage effect 的 amount。
function findAmmoDamage(ammoProto) {
  const stack = [ammoProto && ammoProto.ammo_type && ammoProto.ammo_type.action];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') continue;
    if (cur.type === 'damage' && cur.damage && typeof cur.damage.amount === 'number') return cur.damage.amount;
    for (const k of Object.keys(cur)) {
      const v = cur[k];
      if (v && typeof v === 'object') stack.push(v);
    }
  }
  return null;
}
const ammoDamage = {};
for (const [pid, oid] of Object.entries({
  'firearm-magazine': 'firearm-magazine',
  'piercing-rounds-magazine': 'piercing-rounds-magazine',
  'uranium-rounds-magazine': 'uranium-rounds-magazine',
  'railgun-ammo': 'railgun-ammo',  // 太空时代电磁轨道炮弹药（官方 ammo 原型，伤害 amount=10000）
})) {
  const proto = raw.ammo && raw.ammo[oid];
  if (proto) { const dmg = findAmmoDamage(proto); if (dmg !== null) ammoDamage[pid] = dmg; }
}
// 火箭炮塔弹药：官方 projectile rocket 单发 200 / explosive-rocket 直击 50+范围 100（explosive 面积型更强），
// 项目按既有「单发基准伤害」简化口径单源下发（见 combat2-turrets.js），不改变既有战斗平衡。
ammoDamage['rocket'] = 35;
ammoDamage['explosive-rocket'] = 60;

// ---- 雷达 ----
// range：max_distance_of_sector_revealed（官方 14）；power：energy_usage（官方 300kW）。
// 扫描间隔(RADAR_SWEEP)与每扇区能量是官方自定义节奏，项目采用自定义 2.5s 节奏 → 保持手工。
const radar = {};
{
  const r = raw.radar && raw.radar.radar;
  if (r) {
    if (typeof r.max_distance_of_sector_revealed === 'number') radar.range = r.max_distance_of_sector_revealed;
    const eu = parseKiloWatt(r.energy_usage);
    if (eu !== null) radar.power = eu;
  }
}

// ---- 物流接驳站 cargo-landing-pad（官方 base 建筑：火箭货物降落枢纽）----
// inventory_size（官方 80 槽）、radar_range（官方 radar_range=4，单位格）、max_health 由 buildingHp 统一桥接。
const cargoLandingPad = {};
{
  const r = raw['cargo-landing-pad'] && raw['cargo-landing-pad']['cargo-landing-pad'];
  if (r) {
    if (typeof r.inventory_size === 'number') cargoLandingPad.inventorySize = r.inventory_size;
    if (typeof r.radar_range === 'number') cargoLandingPad.radarRange = r.radar_range;
  }
}

// ---- 物流接驳站扩展舱 cargo-bay（官方 base 建筑：Cargo bay）----
// 官方 Cargo bay 是物流接驳站的扩展存储舱：与接驳站相邻铺设时，为接驳站提供
// inventory_size_bonus（官方 20）额外存储槽位。此处暴露 inventorySizeBonus 单源。
const cargoBay = {};
{
  const r = raw['cargo-bay'] && raw['cargo-bay']['cargo-bay'];
  if (r) {
    if (typeof r.inventory_size_bonus === 'number') cargoBay.inventorySizeBonus = r.inventory_size_bonus;
  }
}
// ---- 物流接驳站卸载舱 landing-pad-unloading-bay（Space Age，官方 cargo-bay 原型）----
// 官方 Cargo unloading bay：允许从太空平台向接驳站卸载货物（allow_unloading=true），
// 自身亦提供 inventory_size_bonus（官方 20）扩展槽位。科技解锁时附带
// max-cargo-bay-unloading-distance（官方 59）。此处单源暴露官方数值。
const cargoUnloadingBay = {};
{
  const r = raw['cargo-bay'] && raw['cargo-bay']['landing-pad-unloading-bay'];
  if (r) {
    if (typeof r.inventory_size_bonus === 'number') cargoUnloadingBay.inventorySizeBonus = r.inventory_size_bonus;
    if (typeof r.allow_unloading === 'boolean') cargoUnloadingBay.allowUnloading = r.allow_unloading;
  }
  const t = raw['technology'] && raw['technology']['landing-pad-unloading-bay'];
  if (t && t.effects) {
    // convert-data 会把数组转成 {1:{...},2:{...}} 索引对象，统一遍历其值
    for (const k of Object.keys(t.effects)) {
      const ef = t.effects[k];
      if (ef && ef.type === 'max-cargo-bay-unloading-distance' && typeof ef.modifier === 'number')
        cargoUnloadingBay.unloadingDistance = ef.modifier;
    }
  }
}

// ---- 个人装备（装备网格） ----
// 官方类型：solar-panel-equipment / generator-equipment / battery-equipment /
// energy-shield-equipment / movement-bonus-equipment / active-defense-equipment。
// powerOut=power(kW)、powerCap=energy_source.buffer_capacity(→kJ)、shield=max_shield_value、
// speed=movement_bonus、laser/放电范围=attack_parameters.range、放电冷却=cooldown(tick→s)。
// 项目特有装备官方无对应 → 保持手工。
const equipment = {};
{
  const sp = raw['solar-panel-equipment'] && raw['solar-panel-equipment']['solar-panel-equipment'];
  if (sp) { const kw = parseKiloWatt(sp.power); if (kw !== null) equipment['solar-panel-equipment'] = { powerOut: kw }; }
  const fr = raw['generator-equipment'] && raw['generator-equipment']['fusion-reactor-equipment'];
  if (fr) { const kw = parseKiloWatt(fr.power); if (kw !== null) equipment['fusion-reactor-equipment'] = { powerOut: kw }; }
  const b1 = raw['battery-equipment'] && raw['battery-equipment']['battery-equipment'];
  if (b1 && b1.energy_source) { const cap = parseEnergyKJ(b1.energy_source.buffer_capacity); if (cap !== null) equipment['battery-equipment'] = { powerCap: cap }; }
  const b2 = raw['battery-equipment'] && raw['battery-equipment']['battery-mk2-equipment'];
  if (b2 && b2.energy_source) { const cap = parseEnergyKJ(b2.energy_source.buffer_capacity); if (cap !== null) equipment['battery-mk2-equipment'] = { powerCap: cap }; }
  const b3 = raw['battery-equipment'] && raw['battery-equipment']['battery-mk3-equipment'];
  if (b3 && b3.energy_source) { const cap = parseEnergyKJ(b3.energy_source.buffer_capacity); if (cap !== null) equipment['battery-mk3-equipment'] = { powerCap: cap }; }
  const fir = raw['generator-equipment'] && raw['generator-equipment']['fission-reactor-equipment'];
  if (fir) { const kw = parseKiloWatt(fir.power); if (kw !== null) equipment['fission-reactor-equipment'] = { powerOut: kw }; }

  const s1 = raw['energy-shield-equipment'] && raw['energy-shield-equipment']['energy-shield-equipment'];
  if (s1 && typeof s1.max_shield_value === 'number') equipment['energy-shield-equipment'] = { shield: s1.max_shield_value };
  const s2 = raw['energy-shield-equipment'] && raw['energy-shield-equipment']['energy-shield-mk2-equipment'];
  if (s2 && typeof s2.max_shield_value === 'number') equipment['energy-shield-mk2-equipment'] = { shield: s2.max_shield_value };
  const ex = raw['movement-bonus-equipment'] && raw['movement-bonus-equipment']['exoskeleton-equipment'];
  if (ex && typeof ex.movement_bonus === 'number') equipment['exoskeleton-equipment'] = { speed: ex.movement_bonus };
  const pld = raw['active-defense-equipment'] && raw['active-defense-equipment']['personal-laser-defense-equipment'];
  if (pld && pld.attack_parameters && typeof pld.attack_parameters.range === 'number') equipment['personal-laser-defense-equipment'] = { laser: pld.attack_parameters.range };
  const dd = raw['active-defense-equipment'] && raw['active-defense-equipment']['discharge-defense-equipment'];
  if (dd && dd.attack_parameters) {
    equipment['discharge-defense-equipment'] = {
      discharge: true,
      dischargeRange: dd.attack_parameters.range,
      dischargeCooldown: Math.round(dd.attack_parameters.cooldown / 60 * 10) / 10,
    };
  }
  // 工具腰带（官方 inventory-bonus-equipment，Space Age）：inventory_size_bonus 为背包扩容格数
  const tb = raw['inventory-bonus-equipment'] && raw['inventory-bonus-equipment']['toolbelt-equipment'];
  if (tb && typeof tb.inventory_size_bonus === 'number') {
    equipment['toolbelt-equipment'] = { extraSlots: tb.inventory_size_bonus };
  }
}

// ---- 核能热量链路（反应堆 / 导热管） ----
// 官方 heat_buffer：specific_heat("10MJ"/"1MJ")、max_transfer("10GW"/"1GW")、max_temperature=1000、
// minimum_glow_temperature=350。热交换器在本数据集中为简化的 boiler 型（无 heat_buffer）→ 保持手工。
// reactorHeatRate：核燃料棒 8GJ / 官方燃烧 200s = 40MW。
const heat = {};
{
  const r = raw.reactor && raw.reactor['nuclear-reactor'];
  if (r && r.heat_buffer) {
    if (typeof r.heat_buffer.max_temperature === 'number') heat.reactorMaxTemp = r.heat_buffer.max_temperature;
    const sh = parseEnergyMJ(r.heat_buffer.specific_heat);
    if (sh !== null) heat.reactorSpecificHeat = sh;
    const mt = parsePowerMW(r.heat_buffer.max_transfer);
    if (mt !== null) heat.reactorMaxTransfer = mt;
  }
  const hp = raw['heat-pipe'] && raw['heat-pipe']['heat-pipe'];
  if (hp && hp.heat_buffer) {
    if (typeof hp.heat_buffer.max_temperature === 'number') heat.heatPipeMaxTemp = hp.heat_buffer.max_temperature;
    if (typeof hp.heat_buffer.minimum_glow_temperature === 'number') heat.heatPipeMinGlowTemp = hp.heat_buffer.minimum_glow_temperature;
    const sh = parseEnergyMJ(hp.heat_buffer.specific_heat);
    if (sh !== null) heat.heatPipeSpecificHeat = sh;
    const mt = parsePowerMW(hp.heat_buffer.max_transfer);
    if (mt !== null) heat.heatPipeMaxTransfer = mt;
  }
  const fuel = raw.item && raw.item['uranium-fuel-cell'];
  if (fuel) {
    const g = parseEnergyMJ(fuel.fuel_value);
    if (g !== null) heat.reactorHeatRate = Math.round(g / 200 * 10) / 10; // 8GJ/200s = 40MW
  }
  // 太空时代供热塔（Aquilo heating-tower）：官方 reactor 原型，燃烧化学燃料产热。
  // 产热 = consumption × effectivity（官方 consumption=40MW、effectivity=2.5 → 100MW，高于核反应堆 40MW）。
  // heat_buffer: specific_heat=5MJ/°C、max_transfer=10GW、max_temperature=1000（官方）。
  const ht = raw.reactor && raw.reactor['heating-tower'];
  if (ht) {
    const c = ht.consumption && parsePowerMW(ht.consumption);
    if (c !== null) heat.heatingTowerRate = c;  // 燃料消耗率(MW)
    const eff = ht.energy_source && ht.energy_source.effectivity;
    if (typeof eff === 'number') heat.heatingTowerEffectivity = eff;  // 官方 2.5
    if (ht.heat_buffer) {
      if (typeof ht.heat_buffer.max_temperature === 'number') heat.heatingTowerMaxTemp = ht.heat_buffer.max_temperature;
      const sh = parseEnergyMJ(ht.heat_buffer.specific_heat);
      if (sh !== null) heat.heatingTowerSpecificHeat = sh;
      const mt = parsePowerMW(ht.heat_buffer.max_transfer);
      if (mt !== null) heat.heatingTowerMaxTransfer = mt;
    }
  }
}

// ---- Fulgora 避雷系统（Space Age lightning-attractor 原型）----
// 避雷针/避雷收集器：雷电季节吸收闪电并转化为电网电力（官方 lightning-attractor）。
// 官方原型字段：efficiency（避雷针 0.2 / 收集器 0.4）、range_elongation（15 / 25）、
// energy_source.buffer_capacity（500MJ / 1000MJ）、drain（2.5MJ/s）。
// 项目以官方数值桥接（GAME_DATA.lightning），供避雷设备读取，未单独维护数值表。
const lightning = {};
{
  const rod = raw['lightning-attractor'] && raw['lightning-attractor']['lightning-rod'];
  if (rod) {
    if (typeof rod.efficiency === 'number') lightning.rodEfficiency = rod.efficiency;
    if (typeof rod.range_elongation === 'number') lightning.rodRange = rod.range_elongation;
    if (rod.energy_source) {
      const cap = parseEnergyMJ(rod.energy_source.buffer_capacity);
      if (cap !== null) lightning.rodBufferMJ = cap;
      const dr = rod.energy_source.drain && parseKiloWatt(rod.energy_source.drain);
      if (dr !== null) lightning.rodDrainKW = dr;
    }
  }
  const col = raw['lightning-attractor'] && raw['lightning-attractor']['lightning-collector'];
  if (col) {
    if (typeof col.efficiency === 'number') lightning.collectorEfficiency = col.efficiency;
    if (typeof col.range_elongation === 'number') lightning.collectorRange = col.range_elongation;
    if (col.energy_source) {
      const cap = parseEnergyMJ(col.energy_source.buffer_capacity);
      if (cap !== null) lightning.collectorBufferMJ = cap;
      const dr = col.energy_source.drain && parseKiloWatt(col.energy_source.drain);
      if (dr !== null) lightning.collectorDrainKW = dr;
    }
  }
}

// ---- 机器人港基础耗电（kW，官方 energy_usage 50kW）----
const roboportPower = (() => {
  const rp = raw.roboport && raw.roboport.roboport;
  const kw = rp && parseKiloWatt(rp.energy_usage);
  return kw;
})();




// ---- 机器人 / 机械臂（官方参数）----
// robotSpeed：物流/施工机器人飞行速度 speed（官方单位=格/tick，×60 → 格/秒）；
//   logistic-robot 0.05 → 3.0，construction-robot 0.06 → 3.6。
// inserterSpeed：机械臂旋转/伸缩速度 rotation_speed / extension_speed（官方，单位 转/tick 与 格/tick）。
const robotSpeed = {};
{
  const lr = raw['logistic-robot'] && raw['logistic-robot']['logistic-robot'];
  if (lr && typeof lr.speed === 'number') robotSpeed.logistic = Math.round(lr.speed * 60 * 1000) / 1000;
  const cr = raw['construction-robot'] && raw['construction-robot']['construction-robot'];
  if (cr && typeof cr.speed === 'number') robotSpeed.construction = Math.round(cr.speed * 60 * 1000) / 1000;
}
const inserterStats = {};
// 官方机械臂 rotation_speed / extension_speed（rad/tick）与抓取堆叠（inserter_stack_size_override）。
// 项目各臂类型 → 官方原型名：普通=inserter、长臂=long-handed-inserter、快速=fast-inserter、
// 堆叠=bulk-inserter(2.0)、热能=burner-inserter。供机械臂旋转/抓取行为桥接（见 devices/inserter.js）。
const INSERTER_SOURCES = {
  'inserter': 'inserter',
  'long-handed-inserter': 'long-handed-inserter',
  'fast-inserter': 'fast-inserter',
  'bulk-inserter': 'bulk-inserter',
  'stack-inserter': 'stack-inserter',
  'burner-inserter': 'burner-inserter',
};
// 官方机械臂基础抓取堆叠（格内一次性抓取上限，不随 `inserter-capacity` 无限科技累加前的基础值）：
//   inserter/fast/long/burner = 1；bulk-inserter = 3；stack-inserter = 4（官方 stack_size_bonus）。
// 官方原型仅在 stack-inserter 上显式给出 stack_size_bonus=4，其余基础档为 1/3（游戏硬编码），此处按官方对齐。
const INSERTER_BASE_STACK = {
  'inserter': 1, 'fast-inserter': 1, 'long-handed-inserter': 1, 'burner-inserter': 1,
  'bulk-inserter': 3, 'stack-inserter': 4,
};
{
  const ins = raw.inserter && raw.inserter.inserter;
  if (ins) {
    if (typeof ins.rotation_speed === 'number') inserterStats.rotationSpeed = ins.rotation_speed;
    if (typeof ins.extension_speed === 'number') inserterStats.extensionSpeed = ins.extension_speed;
  }
  // 每个机械臂类型的官方旋转/伸缩速度（rad/tick）与堆叠抓取上限
  const perType = {};
  for (const [pid, oname] of Object.entries(INSERTER_SOURCES)) {
    const p = raw.inserter && raw.inserter[oname];
    if (!p || typeof p !== 'object') continue;
    const row = {};
    if (typeof p.rotation_speed === 'number') row.rotationSpeed = p.rotation_speed;
    if (typeof p.extension_speed === 'number') row.extensionSpeed = p.extension_speed;
    // 抓取堆叠：优先官方 stack_size_bonus（stack-inserter=4），否则按官方基础档对齐
    row.stack = (typeof p.stack_size_bonus === 'number' && p.stack_size_bonus > 0)
      ? p.stack_size_bonus : (INSERTER_BASE_STACK[pid] || 1);
    if (Object.keys(row).length) perType[pid] = row;
  }
  if (Object.keys(perType).length) inserterStats.perType = perType;
}

// ---- 锅炉 / 蒸汽机 / 汽轮机（官方参数）----
// boilerPower：锅炉最大热输入 energy_consumption（MW，官方 1.8MW）；
// engineRate / turbineRate：蒸汽机/汽轮机满功率耗汽率 fluid_usage_per_tick（官方 0.5 / 1 → ×60=30/60 单位/秒）；
// effectivity：能量转换效率（官方 1）。
const steamPower = {};
{
  const b = raw.boiler && raw.boiler.boiler;
  const bc = b && parsePowerMW(b.energy_consumption);
  if (bc !== null) steamPower.boilerPower = bc;
  if (b && typeof b.target_temperature === 'number') steamPower.boilerTargetTemp = b.target_temperature;
  const e = raw.generator && raw.generator['steam-engine'];
  if (e) {
    if (typeof e.fluid_usage_per_tick === 'number') steamPower.engineRate = e.fluid_usage_per_tick * 60;
    if (typeof e.effectivity === 'number') steamPower.effectivity = e.effectivity;
  }
  const t = raw.generator && raw.generator['steam-turbine'];
  if (t && typeof t.fluid_usage_per_tick === 'number') steamPower.turbineRate = t.fluid_usage_per_tick * 60;
}

// ---- 设备占地面积（格，官方 selection_box）----
// 项目建筑 id → [官方 raw 类型, 官方原型名]。占地 = selection_box 的右界减左界（格）。
// 官方 2.0 类型变更：gun-turret=ammo-turret、laser-turret=electric-turret、
// flamethrower-turret=fluid-turret、nuclear-reactor=reactor、steam-engine=generator、
// steam-turbine=generator、heat-exchanger=boiler。创意/虚空物品官方无实体 → 保持手工。
const FOOTPRINT_SOURCES = {
  'transport-belt': ['transport-belt', 'transport-belt'],
  'fast-transport-belt': ['transport-belt', 'fast-transport-belt'],
  'express-transport-belt': ['transport-belt', 'express-transport-belt'],
  'turbo-transport-belt': ['transport-belt', 'turbo-transport-belt'],  // 太空时代4档带（速度7.5格/s）
  'loader': ['loader', 'loader'],  // 装载机（官方 selection_box ±0.5×±1 → 1×2）
  'fast-loader': ['loader', 'fast-loader'],  // 高速装载机（官方 selection_box → 1×2）
  'express-loader': ['loader', 'express-loader'],  // 极速装载机（官方 selection_box → 1×2）
  'turbo-loader': ['loader', 'turbo-loader'],  // 超速装载机（官方 selection_box → 1×2）
  'underground-belt': ['underground-belt', 'underground-belt'],
  'fast-underground-belt': ['underground-belt', 'fast-underground-belt'],
  'express-underground-belt': ['underground-belt', 'express-underground-belt'],
  'turbo-underground-belt': ['underground-belt', 'turbo-underground-belt'],  // 太空时代4档地下带
  'splitter': ['splitter', 'splitter'],
  'fast-splitter': ['splitter', 'fast-splitter'],
  'express-splitter': ['splitter', 'express-splitter'],
  'inserter': ['inserter', 'inserter'],
  'burner-inserter': ['inserter', 'burner-inserter'],
  'long-handed-inserter': ['inserter', 'long-handed-inserter'],
  'fast-inserter': ['inserter', 'fast-inserter'],
  'bulk-inserter': ['inserter', 'bulk-inserter'],
  'stack-inserter': ['inserter', 'stack-inserter'],
  'burner-mining-drill': ['mining-drill', 'burner-mining-drill'],
  'electric-mining-drill': ['mining-drill', 'electric-mining-drill'],
  'pumpjack': ['mining-drill', 'pumpjack'],
  'big-mining-drill': ['mining-drill', 'big-mining-drill'],  // 太空时代大型采矿钻机：mining_speed=2.5, module_slots=4
  'stone-furnace': ['furnace', 'stone-furnace'],
  'steel-furnace': ['furnace', 'steel-furnace'],
  'electric-furnace': ['furnace', 'electric-furnace'],
  'assembling-machine-1': ['assembling-machine', 'assembling-machine-1'],
  'assembling-machine-2': ['assembling-machine', 'assembling-machine-2'],
  'assembling-machine-3': ['assembling-machine', 'assembling-machine-3'],
  'oil-refinery': ['assembling-machine', 'oil-refinery'],
  'chemical-plant': ['assembling-machine', 'chemical-plant'],
  'centrifuge': ['assembling-machine', 'centrifuge'],
  'beacon': ['beacon', 'beacon'],
  'lab': ['lab', 'lab'],
  'boiler': ['boiler', 'boiler'],
  'steam-engine': ['generator', 'steam-engine'],
  'steam-turbine': ['generator', 'steam-turbine'],
  'heat-exchanger': ['boiler', 'heat-exchanger'],
  'offshore-pump': ['offshore-pump', 'offshore-pump'],
  'pipe': ['pipe', 'pipe'],
  'pipe-to-ground': ['pipe-to-ground', 'pipe-to-ground'],
  'pump': ['pump', 'pump'],
  'storage-tank': ['storage-tank', 'storage-tank'],
  'one-way-valve': ['valve', 'one-way-valve'],  // Factorio 2.0 单向阀：官方 valve 原型 selection_box ±0.5 → 1×1
  'overflow-valve': ['valve', 'overflow-valve'],  // Factorio 2.0 溢出阀
  'top-up-valve': ['valve', 'top-up-valve'],  // Factorio 2.0 补给阀
  'solar-panel': ['solar-panel', 'solar-panel'],
  'accumulator': ['accumulator', 'accumulator'],
  'radar': ['radar', 'radar'],
  'rocket-silo': ['rocket-silo', 'rocket-silo'],  // 火箭发射井：官方 selection_box ±4.5 → 9×9（对齐《异星工厂》2.0 巨型发射井）
  'cargo-landing-pad': ['cargo-landing-pad', 'cargo-landing-pad'],  // 物流接驳站：官方 selection_box ±4 → 8×8
  'cargo-bay': ['cargo-bay', 'cargo-bay'],  // 物流接驳站扩展舱：官方 selection_box ±2 → 4×4
  'landing-pad-unloading-bay': ['cargo-bay', 'landing-pad-unloading-bay'],  // 物流接驳站卸载舱：官方 cargo-bay 原型 selection_box {{-2,-3},{2,2}} → 4×5
  'roboport': ['roboport', 'roboport'],
  'nuclear-reactor': ['reactor', 'nuclear-reactor'],
  'heat-pipe': ['heat-pipe', 'heat-pipe'],
  'gun-turret': ['ammo-turret', 'gun-turret'],
  'laser-turret': ['electric-turret', 'laser-turret'],
  'tesla-turret': ['electric-turret', 'tesla-turret'],  // 太空时代特斯拉炮塔（Fulgora）：官方 selection_box
  'rocket-turret': ['ammo-turret', 'rocket-turret'],  // 太空时代火箭炮塔：官方 selection_box ±1.5×±1.5 → 3×3
  'railgun-turret': ['ammo-turret', 'railgun-turret'],  // 太空时代电磁轨道炮塔：官方 selection_box ±1.5×±2.5 → 3×5
  'flamethrower-turret': ['fluid-turret', 'flamethrower-turret'],
  'stone-wall': ['wall', 'stone-wall'],
  'gate': ['gate', 'gate'],
  'small-electric-pole': ['electric-pole', 'small-electric-pole'],
  'medium-electric-pole': ['electric-pole', 'medium-electric-pole'],
  'big-electric-pole': ['electric-pole', 'big-electric-pole'],
  'substation': ['electric-pole', 'substation'],
  'constant-combinator': ['constant-combinator', 'constant-combinator'],
  'arithmetic-combinator': ['arithmetic-combinator', 'arithmetic-combinator'],
  'decider-combinator': ['decider-combinator', 'decider-combinator'],
  'selector-combinator': ['selector-combinator', 'selector-combinator'],  // 官方 selection_box ±0.5×±1 → 1×2（项目 1×1 覆盖）
  'display-panel': ['display-panel', 'display-panel'],  // 官方 selection_box ±0.5×0.5 → 1×1
  'power-switch': ['power-switch', 'power-switch'],
  'programmable-speaker': ['programmable-speaker', 'programmable-speaker'],
  'land-mine': ['land-mine', 'land-mine'],
  'electromagnetic-plant': ['assembling-machine', 'electromagnetic-plant'],  // 太空时代电磁工厂（space-age 装配机原型）
  'recycler': ['furnace', 'recycler'],  // 回收机（recycler DLC，官方 furnace 原型）
  'biochamber': ['assembling-machine', 'biochamber'],  // 太空时代生化炉（space-age 装配机原型，3×3）
  'crusher': ['assembling-machine', 'crusher'],  // 太空时代破碎机（space-age 装配机原型，selection_box ±1×±1.5 → 2×3）
  'foundry': ['assembling-machine', 'foundry'],  // 太空时代铸造厂（space-age 装配机原型，selection_box ±2.5×±2.5 → 5×5）
  'cryogenic-plant': ['assembling-machine', 'cryogenic-plant'],  // 太空时代低温工厂（Aquilo）：官方 selection_box ±2 → 4×4
  'railgun-turret': ['ammo-turret', 'railgun-turret'],  // 轨道炮塔：官方 selection_box
  'rocket-turret': ['ammo-turret', 'rocket-turret'],  // 火箭炮塔：官方 selection_box (feat: 接入 Aquilo 低温学链 + 熔融金属/废料回收/终局防御/机械装甲 DLC 内容)
  'agricultural-tower': ['agricultural-tower', 'agricultural-tower'],  // 太空时代农业塔（Gleba）：官方 selection_box ±1.5×±1.5 → 3×3
  'heating-tower': ['reactor', 'heating-tower'],  // 太空时代供热塔（Aquilo）：官方 reactor 原型 selection_box ±1.5×±1.5 → 3×3
  'biolab': ['lab', 'biolab'],  // 太空时代生物实验室（Gleba）：官方 lab 原型 selection_box ±2.5×±2.5 → 5×5
  'captive-biter-spawner': ['assembling-machine', 'captive-biter-spawner'],  // 太空时代虫巢孵化器（Captive biter spawner）：官方 assembling-machine 原型 selection_box ±2.5×±2.5 → 5×5
  'lightning-rod': ['lightning-attractor', 'lightning-rod'],  // 太空时代避雷针（Fulgora）：官方 selection_box ±0.5 → 1×1
  'lightning-collector': ['lightning-attractor', 'lightning-collector'],  // 太空时代避雷收集器（Fulgora）：官方 selection_box ±1 → 2×2
  // ===== 太空时代 空间平台系统（Space Platform，官方 selection_box）=====
  'space-platform-hub': ['space-platform-hub', 'space-platform-hub'],  // 官方 selection_box ±4 → 8×8
  'thruster': ['thruster', 'thruster'],  // 官方 selection_box {{-2,-2.5},{2,5.5}} → 4×8
  'asteroid-collector': ['asteroid-collector', 'asteroid-collector'],  // 官方 selection_box
  'fusion-reactor': ['fusion-reactor', 'fusion-reactor'],  // 太空时代聚变反应堆（Aquilo）：官方 selection_box ±3×±3 → 6×6
  'fusion-generator': ['fusion-generator', 'fusion-generator'],  // 太空时代聚变发电机（Aquilo）：官方 selection_box ±1.5×±2.5 → 3×5
};
// 官方 selection_box 为实体占用的格数（局部坐标跨度，单位格）。
// 占地格数 = max(1, ceil(跨度))；部分实体（机械臂/电线杆/熔炉等）官方跨度<1 或非整数，
// 按 Factorio 惯例仍占整格（如机械臂 1×1、石炉 2×2）。
const footprint = {};
const gridFootprint = (extent) => Math.max(1, Math.ceil(extent - 0.001));
for (const [pid, [rtype, oname]] of Object.entries(FOOTPRINT_SOURCES)) {
  const proto = raw[rtype] && raw[rtype][oname];
  const sel = proto && proto.selection_box;
  if (!sel || !sel['1'] || !sel['2']) continue;
  const w = gridFootprint(sel['2']['1'] - sel['1']['1']);
  const h = gridFootprint(sel['2']['2'] - sel['1']['2']);
  if (w > 0 && h > 0) footprint[pid] = { w, h };
}


// ---- DLC 数据总览（Space Age / Quality / Elevated Rails / Recycler）----
// 列出 factorio-data 2.1.17 中 DLC 相关的可用物品与配方（官方名），供后续功能开发引用。
// DLC 识别：Space Age 特色物品（电磁/锂/超导/小行星/浆果/氟酮等）、Quality 品质、高架铁轨、回收机。
const dlcItemKeywords = ['electromagnetic','lithium','superconductor','asteroid','yumako','bioflux',
  'fluoroketone','promethium','carbon','metallic','oxide','quality','recycler','capture-robot',
  'agricultural','lightning','thruster','cargo-pod','landing-pad','space-platform','big-mining'];

const dlc = {
  version: '2.1.17',
  items: {},
  recipes: {},
  quality: Object.keys(raw.quality || {}),
};
for (const n of Object.keys(raw.item || {})) {
  if (dlcItemKeywords.some(k => n.includes(k))) dlc.items[n] = { stack: raw.item[n].stack_size };
}
for (const n of Object.keys(raw.recipe || {})) {
  if (dlcItemKeywords.some(k => n.includes(k))) dlc.recipes[n] = true;
}
// 回收机实体
if (raw.recycler) dlc.recycler = Object.keys(raw.recycler);
// 高架铁轨
dlc.elevatedRails = Object.keys(raw['elevated-straight-rail'] || {});

// ---- 品质系统数据（Quality DLC：品质模块效果 / 品质等级）----
// qualityModules[id] = { quality(加成), speedPenalty(速度惩罚) }，官方 quality 原型。
// qualityTiers = [{ id, level, color }]（官方 quality 原型，normal 为默认 0 级）。
const qualityModules = {};
const qualityTiers = [];
{
  const qmSrc = {
    'quality-module': 'quality-module',
    'quality-module-2': 'quality-module-2',
    'quality-module-3': 'quality-module-3',
  };
  for (const [pid, oname] of Object.entries(qmSrc)) {
    const m = raw.module && raw.module[oname];
    if (m && m.effect) {
      qualityModules[pid] = {
        quality: (typeof m.effect.quality === 'number') ? m.effect.quality : 0,
        speedPenalty: (typeof m.effect.speed === 'number') ? -m.effect.speed : 0.05,
      };
    }
  }
  // 官方品质等级（quality 原型：uncommon/rare/epic/legendary，normal 为 0 级默认）
  if (raw.quality) {
    const order = ['normal', 'uncommon', 'rare', 'epic', 'legendary'];
    for (const name of order) {
      const q = raw.quality[name];
      if (q) qualityTiers.push({ id: name, level: q.level || 0, color: q.color ? [q.color['1']||0, q.color['2']||0, q.color['3']||0] : null });
    }
  }
}

// ---- 制作栏 5 Tab 单源归类（物品 → 官方 item-group）----
// 解析 factorio-data 所有 item-groups.lua，得到 subgroup → group 归属；
// 再为每个项目物品按其官方原型 subgroup 反查 group，写入 GAME_DATA.itemGroup[id]。
// 仅对官方未归入 5 大 Tab（物流/生产/中间产品/太空/武器）的特殊物品做人工兜底。
const itemGroupMap = {}; // subgroup → group
{
  const groupFiles = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/item-groups\.lua$/.test(f)) groupFiles.push(p);
    }
  })(path.join(ROOT, 'factorio-data'));
  for (const gf of groupFiles) {
    const txt = fs.readFileSync(gf, 'utf8');
    const blocks = txt.match(/\{[^{}]*?\}/gs) || [];
    for (const b of blocks) {
      const type = /type\s*=\s*"([^"]+)"/.exec(b);
      if (!type || type[1] !== 'item-subgroup') continue;
      const name = /name\s*=\s*"([^"]+)"/.exec(b);
      const grp = /group\s*=\s*"([^"]+)"/.exec(b);
      if (name && grp) itemGroupMap[name[1]] = grp[1];
    }
  }
}
// 5 大 Tab 的官方 group 名
const CRAFT_TABS = ['logistics', 'production', 'intermediate-products', 'space', 'combat'];
// 特殊物品兜底（官方未归入 5 大 Tab 或原型无 subgroup 者 → 人工归 Tab）
const ITEM_GROUP_OVERRIDE = {
  'satellite': 'space', 'rocket-body': 'space',
  'red-wire': 'logistics', 'green-wire': 'logistics', 'spidertron-remote': 'logistics',
  'creative-chest': 'logistics', 'void-chest': 'logistics',
  'creative-pipe': 'logistics', 'void-pipe': 'logistics',
  'creative-belt': 'logistics', 'void-belt': 'logistics',
  'stone-path': 'logistics',
};
const itemGroup = {};
// 二级分组：物品 → 官方 item-subgroup（仅 5 大 Tab 内），供背包合成列表在 Tab 内继续分组的单源数据。
const itemSubgroup = {};
// 官方顺序：subgroup 在 group 内的 order、物品在 subgroup 内的 order（官方制作栏排序，配方无 order 时按主产物 order）。
const subgroupOrder = {};
for (const sg of Object.values(raw['item-subgroup'] || {})) {
  if (sg && typeof sg === 'object' && sg.name && typeof sg.order === 'string') subgroupOrder[sg.name] = sg.order;
}
const itemOrder = {};
for (const pid of projectItems) {
  const oid = toOfficialName(pid);
  // 优先兜底
  if (ITEM_GROUP_OVERRIDE[pid]) { itemGroup[pid] = ITEM_GROUP_OVERRIDE[pid]; continue; }
  // 从官方原型取 subgroup
  let subgroup = null;
  let order = null;
  const it = raw.item && raw.item[oid];
  if (it && it.subgroup) { subgroup = it.subgroup; order = it.order; }
  else {
    // 实体类（装备/载具/炮塔等）在各自原型带 subgroup
    for (const tbl of Object.values(raw)) {
      const o = tbl && tbl[oid];
      if (o && typeof o === 'object' && o.subgroup) { subgroup = o.subgroup; order = o.order; break; }
    }
  }
  const g = subgroup ? itemGroupMap[subgroup] : null;
  if (g && CRAFT_TABS.includes(g)) {
    itemGroup[pid] = g;
    if (subgroup) itemSubgroup[pid] = subgroup;
    if (typeof order === 'string') itemOrder[pid] = order;
  }
  // 其余（流体/环境/信号等非 5 大 Tab）不写入，由前端按无归类兜底处理
}


// ================= 敌人（Gleba 五足虫）单源化 =================
// 从 factorio-data 官方 unit / spider-unit 原型提取太空时代五足虫（Pentapod）敌方数据。
// 官方数值：max_health、movement_speed（格/tick）、attack_parameters（射程/冷却/伤害倍率/类型）。
// 项目战斗模型以「格/秒」表示速度（官方格/tick × 60），HP 按其官方相对比例接入游戏平衡模型。
const enemy = {};
{
  const PENTAPOD_UNITS = {
    'small-wriggler-pentapod':  { kind: 'melee',    evo: 0.30, size: 8,  color: '#7ac24a' },
    'medium-wriggler-pentapod': { kind: 'melee',    evo: 0.45, size: 11, color: '#5f9c3a' },
    'big-wriggler-pentapod':    { kind: 'melee',    evo: 0.70, size: 14, color: '#4a7c2a' },
  };
  const PENTAPOD_SPIDERS = {
    'small-strafer-pentapod':  { evo: 0.55, size: 13, color: '#9a6a3a', kind: 'ranged' },
    'medium-strafer-pentapod': { evo: 0.75, size: 16, color: '#7a522a', kind: 'ranged' },
    'big-strafer-pentapod':    { evo: 0.90, size: 20, color: '#5a3a1a', kind: 'ranged' },
    'small-stomper-pentapod':  { evo: 0.80, size: 22, color: '#6a5a2a', kind: 'stomp'  },
    'medium-stomper-pentapod': { evo: 0.93, size: 28, color: '#4f4220', kind: 'stomp'  },
    'big-stomper-pentapod':    { evo: 0.97, size: 34, color: '#3a3018', kind: 'stomp'  },
  };
  const apply = (id, proto, meta) => {
    if (!proto) return;
    const ap = proto.attack_parameters || {};
    enemy[id] = {
      hp: proto.max_health,
      // 官方 movement_speed 为格/tick；项目以格/秒，×60。stomper/strafer 用 spider 的 speed（如有）
      speed: typeof proto.movement_speed === 'number' ? proto.movement_speed * 60 : 0,
      kind: meta.kind,
      evo: meta.evo,
      size: meta.size,
      color: meta.color,
      attack: {
        type: ap.type || 'projectile',
        range: typeof ap.range === 'number' ? ap.range : (ap.range_mode ? 4 : 1),
        minRange: ap.min_attack_distance,
        cooldown: typeof ap.cooldown === 'number' ? ap.cooldown / 60 : 1,
        dmgMod: ap.damage_modifier,
      },
      resist: proto.resistances ? Object.keys(proto.resistances).map(k => {
        const r = proto.resistances[k]; return { type: r.type, percent: r.percent };
      }) : [],
    };
  };
  for (const [id, meta] of Object.entries(PENTAPOD_UNITS)) apply(id, raw.unit && raw.unit[id], meta);
  for (const [id, meta] of Object.entries(PENTAPOD_SPIDERS)) apply(id, raw['spider-unit'] && raw['spider-unit'][id], meta);
  // 移除未命中官方原型的项（保持数据单源，只保留官方数值）
  for (const id of Object.keys(enemy)) {
    const oid = id;
    const has = (raw.unit && raw.unit[oid]) || (raw['spider-unit'] && raw['spider-unit'][oid]);
    if (!has) delete enemy[id];
  }
}

// ---- 燃料能量密度（burner 设备用，项目相对刻度）----
// 各可燃烧燃料的能量密度，供锅炉/熔炉/热能采矿机/火车头/热能机械臂等 burner 设备读取。
// 官方 data.raw 的 fuel_value 为 MJ 绝对值（如煤 4MJ、固体燃料 12MJ、火箭燃料 100MJ、
// 核燃料 1.21GJ），本项目采用简化的「相对刻度」燃料值（煤=12 为基准），故此处保持项目相对
// 值（见 data.js COAL_ENERGY 等），统一经 data.generated.js 单源下发，避免在设备文件里
// 单独维护第二套数值。核燃料 2500 约 = 官方 1.21GJ 折算；五足虫卵 5 / 生鱼 4 为弱效生物质燃料。
const fuelEnergy = {
  'coal': 12,             // 煤（基准，官方 4MJ）
  'wood': 3,              // 木材（约煤 1/4，官方 2MJ）
  'solid-fuel': 50,       // 固体燃料（约 4× 煤，官方 12MJ）
  'rocket-fuel': 500,     // 火箭燃料（约 40× 煤，官方 100MJ）
  'nuclear-fuel': 2500,   // 核燃料（官方 1.21GJ，约 300× 煤）
  'raw-fish': 4,          // 生鱼（弱效生物质燃料）
  'pentapod-egg': 5,      // 五足虫卵（官方 5MJ）
};

// ---- 汇总新增字段进 GAME_DATA（undefined 字段由 JSON 序列化自动剔除）----
Object.assign(GAME_DATA, {
  undergroundDist,
  renewable,
  fluidCapacity,
  beaconRange,
  turret,
  ammoDamage,
  radar,
  cargoLandingPad,
  cargoBay,
  cargoUnloadingBay,
  equipment,
  heat,
  lightning,
  roboportPower,
  footprint,
  steamPower,
  robotSpeed,
  inserterStats,
  dlc,
  qualityModules,
  qualityTiers,
  itemGroup,
  itemSubgroup,
  subgroupOrder,
  itemOrder,
  pollution,
  enemy,
  fuelEnergy,
});

// ---- recipe ----
const skipDetails = {}; // rid → 原因
// 遍历全部配方表（RECIPES + REFINERY_RECIPES + CENTRIFUGE_RECIPES），
// 让炼油/离心机配方也同 RECIPES 一样从官方数据单源化（见 data-recipes.js 末尾桥接）。
const ALL_RECIPE_IDS = new Set([...projectRecipes, ...projectRefRecipes, ...projectCentRecipes]);
for (const rid of ALL_RECIPE_IDS) {
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
  GAME_DATA.recipeDevice[rid] = DLC_DEVICE_RECIPES[rid] || (HUB_RECIPE_IDS.has(rid) ? 'space-platform-hub' : deviceFor(or));
}

// ---- recycling（官方 *-recycling 回收配方，供回收机 Recycler 单源读取）----
// 官方《异星工厂》为绝大多数物品定义了 *-recycling 配方（energy 短、输出=原配方按 recycle_ratio
// 折算后的精确值，含 extra_count_fraction 分数与 independent_probability 概率）。这里把官方回收配方
// 全部提取进 GAME_DATA.recycling，回收机直接读取（不再按通用 25% 估算法）。
// recycling[item] = { time, out: {outItem: 每批期望产出（可为小数）} }
//   - extra_count_fraction: 分数输出（amount + fraction，按小数期望累积）
//   - independent_probability: 概率输出（amount × probability 期望）
//   - 普通 amount: 固定整数输出
GAME_DATA.recycling = {};
for (const orid of Object.keys(raw.recipe || {})) {
  if (!orid.endsWith('-recycling')) continue;
  const or = raw.recipe[orid];
  const inputOid = orid.slice(0, -'-recycling'.length);
  const inputPid = toProjectItem(inputOid);
  if (!inputPid) continue;                       // 输入物品项目未收录 → 跳过
  const out = {};
  let ok = true;
  for (const k of Object.keys(or.results || {})) {
    const e = or.results[k];
    const pid = toProjectItem(e.name);
    if (!pid) { ok = false; break; }
    const amount = e.amount !== undefined ? e.amount : (e.amount_min !== undefined ? e.amount_min : 1);
    let frac = e.extra_count_fraction !== undefined ? e.extra_count_fraction : 0;
    let prob = (typeof e.probability === 'number') ? e.probability : (e.independent_probability || 0);
    let v = amount + frac;
    if (prob > 0) v = amount * prob;             // 概率输出：期望 = amount × probability
    if (v > 0) out[pid] = Math.round(v * 1000000) / 1000000;
  }
  if (ok && Object.keys(out).length > 0) {
    GAME_DATA.recycling[inputPid] = {
      time: or.energy_required !== undefined ? or.energy_required : 0.2,
      out,
    };
  }
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
  console.log('\n-- 扩展设备参数（官方已接入，见 GAME_DATA 新字段）--');
  console.log('地下带距离 undergroundDist: ' + JSON.stringify(GAME_DATA.undergroundDist));
  console.log('太阳能/蓄电器 renewable: ' + JSON.stringify(GAME_DATA.renewable));
  console.log('流体容量/抽水机 fluidCapacity: ' + JSON.stringify(GAME_DATA.fluidCapacity));
  console.log('信号塔半径 beaconRange: ' + JSON.stringify(GAME_DATA.beaconRange));
  console.log('炮塔 turret: ' + JSON.stringify(GAME_DATA.turret));
  console.log('弹药伤害 ammoDamage: ' + JSON.stringify(GAME_DATA.ammoDamage));
  console.log('雷达 radar: ' + JSON.stringify(GAME_DATA.radar));
  console.log('个人装备 equipment: ' + JSON.stringify(GAME_DATA.equipment));
  console.log('热量链路 heat: ' + JSON.stringify(GAME_DATA.heat));
  console.log('避雷系统 lightning: ' + JSON.stringify(GAME_DATA.lightning));
  console.log('污染排放 pollution: ' + JSON.stringify(GAME_DATA.pollution));
  console.log('机器人港功耗 roboportPower: ' + JSON.stringify(GAME_DATA.roboportPower));
  console.log('Gleba 五足虫敌人 enemy: ' + Object.keys(GAME_DATA.enemy||{}).length + ' 种');
  console.log('扩展参数手工保留（官方无此字段/项目简化模型）：汽轮机/锅炉/蒸汽机产汽模型、机器人速度与电量刻度、机器人港容量、',
    '武器/装甲战斗平衡表、燃料能量(项目相对刻度)、载具装备网格、热交换器热量参数、雷达扫描节奏');
  console.log('\n-- 官方多语言命名 names（物品/建筑/流体，中英对照已接入）--');
  console.log(Object.keys(GAME_NAMES).length + ' 条；配方名 recipeNames ' + Object.keys(RECIPE_NAMES).length + ' 条');

  console.log('\n==== 与手工表差异 ====');
  // 对比 stackSize
  const s = fs.readFileSync(path.join(ROOT, 'js', 'data', 'data-items.js'), 'utf8');
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
  const rr = fs.readFileSync(path.join(ROOT, 'js', 'data', 'data-recipes.js'), 'utf8');
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
  '//   names[id] = { zh, en }（物品/建筑/流体官方命名，供中英文切换，见 data-util.js localizedName）',
  '//   recipeNames[rid] = { zh, en }（配方官方命名，供炼油/离心机面板切换）',
  '//   itemGroup[item] = 制作栏 5 Tab（物流/生产/中间产品/太空/武器）',
  '//   itemSubgroup[item] = item-group 内二级分组（官方 item-subgroup）',
  '//   subgroupOrder[subgroup] = subgroup 在 group 内官方顺序,  itemOrder[item] = 物品在 subgroup 内官方顺序',
  '//   其余设备行为参数（官方接入，见对应设备文件 GAME_DATA.xxx?.[..] ?? 兜底）：',
  '//   undergroundDist[带] = 地下带最大距离(格), renewable = { solarPower, accumCap, accumChargeRate }',
  '//   fluidCapacity = { storageTank, fluidWagon, pumpRate, pipeVolume, pipeToGroundVolume }, beaconRange = 信号塔半径(格)',
  '//   turret[塔] = { range, fireRate(秒) }, ammoDamage[弹药] = 伤害, radar = { range, power(kW) }',
  '//   equipment[装备] = { powerOut | powerCap(kJ) | shield | speed | laser | dischargeRange/Cooldown }',
  '//   heat = { reactorMaxTemp, reactorSpecificHeat, reactorMaxTransfer, heatPipeMaxTemp, heatPipeMinGlowTemp,',
  '//           heatPipeSpecificHeat, heatPipeMaxTransfer, reactorHeatRate(MW),',
  '//           heatingTowerRate(MW), heatingTowerEffectivity, heatingTowerMaxTemp,',
  '//           heatingTowerSpecificHeat, heatingTowerMaxTransfer }, roboportPower(kW)',
  '//   cargoLandingPad = { inventorySize, radarRange }, cargoBay = { inventorySizeBonus }（物流接驳站/扩展舱）',
  '//   cargoUnloadingBay = { inventorySizeBonus, allowUnloading, unloadingDistance }（物流卸载舱）',
  '//   footprint[building] = { w, h }（占地面积格数，官方 selection_box）',
  '//   pollution[building] = 官方每分排放（emissions_per_minute.pollution，污染/分），供污染系统单源读取',
  '//   recycling[item] = { time, out:{outItem:每批期望产出} }（官方 *-recycling 回收配方，供回收机单源读取）',
  '//   fuelEnergy[item] = 燃料能量密度（项目相对刻度，供 burner 设备单源读取：煤=12 基准）',
  'const GAME_DATA = ' + JSON.stringify(GAME_DATA, null, 1) + ';',
  '',
].join('\n');

fs.writeFileSync(OUT_FILE, header);
console.log('OK: 已生成 ' + path.relative(ROOT, OUT_FILE) + ' (配方 ' + Object.keys(GAME_DATA.recipe).length + ' 条, 堆叠 ' + Object.keys(GAME_DATA.stackSize).length + ' 条, 血量 ' + Object.keys(GAME_DATA.buildingHp).length + ' 条, 功耗 ' + Object.keys(GAME_DATA.powerUse).length + ' 条, 设备参数 ' + Object.keys(GAME_DATA.deviceStats).length + ' 条, 命名 ' + Object.keys(GAME_DATA.names).length + ' 条, 配方名 ' + Object.keys(GAME_DATA.recipeNames).length + ' 条, 地下带 ' + Object.keys(GAME_DATA.undergroundDist).length + ' 条, 可再生 ' + (GAME_DATA.renewable ? Object.keys(GAME_DATA.renewable).length : 0) + ' 项, 流体容量 ' + (GAME_DATA.fluidCapacity ? Object.keys(GAME_DATA.fluidCapacity).length : 0) + ' 项, 炮塔 ' + Object.keys(GAME_DATA.turret).length + ' 座, 弹药伤害 ' + Object.keys(GAME_DATA.ammoDamage).length + ' 种, 雷达 ' + (GAME_DATA.radar ? Object.keys(GAME_DATA.radar).length : 0) + ' 项, 装备 ' + Object.keys(GAME_DATA.equipment).length + ' 件, 热量 ' + (GAME_DATA.heat ? Object.keys(GAME_DATA.heat).length : 0) + ' 项, 污染排放 ' + Object.keys(GAME_DATA.pollution || {}).length + ' 项, 回收配方 ' + Object.keys(GAME_DATA.recycling || {}).length + ' 条)');
